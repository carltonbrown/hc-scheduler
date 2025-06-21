const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

/**
 * Finds issues that have no recent healthchecks (older than maxStalenessInDays).
 * Extracts the enterprise slug from the issue title (format: "slug - number").
 * @param {Array} healthchecks - The list of all healthchecks.
 * @param {Array} issues - The list of issues.
 * @param {number} maxStalenessInDays - The maximum number of days for a healthcheck to be considered non-stale.
 * @returns {Array} - The filtered list of issues with last_healthcheck_date and days_since_healthcheck.
 */
function findOverdueIssues(healthchecks, issues, maxStalenessInDays) {
  const now = new Date();

  const results = issues
    .map(issue => {
      const enterpriseSlug = issue.title.replace(/\s*-\s*\d+.*$/, '');

      // Match healthchecks to this issue by enterprise_slug
      const matchingHealthchecks = healthchecks.filter(
        hc => hc.enterprise_slug === enterpriseSlug
      );

      // Find the most recent healthcheck
      const mostRecentHealthcheck = matchingHealthchecks
        .sort((a, b) => new Date(b.date) - new Date(a.date))[0];

      let last_healthcheck_date = null;
      let days_since_healthcheck = null;

      if (mostRecentHealthcheck) {
        last_healthcheck_date = mostRecentHealthcheck.date;
        days_since_healthcheck = Math.floor((now - new Date(last_healthcheck_date)) / (1000 * 60 * 60 * 24));
      }

      return {
        ...issue,
        enterprise_slug: enterpriseSlug,
        last_healthcheck_date,
        days_since_healthcheck,
      };
    })
    .filter(issue =>
      // Only include issues where the last healthcheck is stale or missing
      issue.last_healthcheck_date === null ||
      issue.days_since_healthcheck > maxStalenessInDays
    );

  return results;
}

/**
 * Scans a directory recursively for files with the `.md` extension.
 * @param {string} dirPath - The directory to scan.
 * @returns {string[]} - A list of `.md` files with their relative paths.
 */
function discoverMarkdownFiles(dirPath) {
  let markdownFiles = [];

  // Read the contents of the directory
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      // Recursively scan subdirectories
      markdownFiles = markdownFiles.concat(discoverMarkdownFiles(fullPath));
    } else if (entry.isFile() && path.extname(entry.name) === '.md') {
      // Add `.md` files to the list
      markdownFiles.push(fullPath);
    }
  }

  return markdownFiles;
}

/**
 * Reads a file with YAML frontmatter and returns a "healthcheck" object
 * with the fields described in the frontmatter.
 * If no frontmatter is found, returns a default object.
 * @param {string} filePath - The path to the file to read.
 * @returns {object} - The healthcheck object with fields from the frontmatter or a default object.
 */
function parseHealthCheckFile(filePath) {
  const rawContent = fs.readFileSync(filePath, 'utf8');

  // Remove trailing whitespace from all lines
  const fileContent = rawContent
  .split(/\r?\n/)
  .map(line => line.replace(/\s+$/, ''))
  .join('\n');

  // Extract the YAML frontmatter (between the first two "---" lines)
  const frontmatterMatch = fileContent.match(/^---\r?\n([\s\S]*?)\r?\n---/);

  if (!frontmatterMatch) {
    // Return a default object if no frontmatter is found
    return { enterprise_id: null };
  }

  const frontmatterText = frontmatterMatch[1];

  try {
    let frontmatter = yaml.load(frontmatterText);

    // ensure slug is downcased
    if (frontmatter && typeof frontmatter.enterprise_slug === 'string') {
      frontmatter.enterprise_slug = frontmatter.enterprise_slug.toLowerCase();
    }
    return frontmatter;
  } catch (error) {
    // Handle YAML parsing errors gracefully
    throw new Error(`Failed to parse YAML frontmatter: ${error.message}`);
  }
}

/**
 * Loads all healthcheck files and parses their content.
 * @param {string} [dirPath='./'] - The directory to search for healthcheck files (default is the current directory).
 * @returns {object[]} - A list of all healthcheck objects.
 */
function loadHealthCheckFiles(hcSubDir = './premium/health-checks') {
  const markdownFiles = discoverMarkdownFiles(hcSubDir);
  const allHealthchecks = [];

  for (const file of markdownFiles) {
    const healthcheck = parseHealthCheckFile(file);

  if (healthcheck) {
      console.log(`Parsed healthcheck from ${file}`);
      allHealthchecks.push(healthcheck);
    } else {
      console.log(`Found no healthcheck in ${file}`);
    }
  }

  return allHealthchecks;
}

module.exports = { 
    findOverdueIssues,
    loadHealthCheckFiles, 
    parseHealthCheckFile,
    discoverMarkdownFiles
};