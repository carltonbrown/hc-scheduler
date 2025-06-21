const fs = require('fs');
const yaml = require('js-yaml');

/**
 * Reads a file with YAML frontmatter and returns a "healthcheck" object
 * with the fields described in the frontmatter.
 * If no frontmatter is found, returns a default object.
 * @param {string} filePath - The path to the file to read.
 * @returns {object} - The healthcheck object with fields from the frontmatter or a default object.
 */
function parseHealthcheckFile(filePath) {
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

module.exports = parseHealthcheckFile;