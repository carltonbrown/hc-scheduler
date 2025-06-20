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
  // Read the file content
  const fileContent = fs.readFileSync(filePath, 'utf8');

  // Extract the YAML frontmatter (between the first two "---" lines)
  const frontmatterMatch = fileContent.match(/^---\r?\n([\s\S]*?)\r?\n---/);

  if (!frontmatterMatch) {
    // Return a default object if no frontmatter is found
    return { enterprise_id: null };
  }

  try {
    // Parse the YAML frontmatter
    return yaml.load(frontmatterMatch[1]);
  } catch (error) {
    // Handle YAML parsing errors gracefully
    throw new Error(`Failed to parse YAML frontmatter: ${error.message}`);
  }
}

module.exports = parseHealthcheckFile;