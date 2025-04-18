// Import necessary modules
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

/**
 * Reads a file with YAML frontmatter and returns a "healthcheck" object
 * with the fields described in the frontmatter.
 * @param {string} filePath - The path to the file to read.
 * @returns {object} - The healthcheck object with fields from the frontmatter.
 */
function parseHealthcheckFile(filePath) {
  // Read the file content
  const fileContent = fs.readFileSync(filePath, 'utf8');

  // Extract the YAML frontmatter (between the first two "---" lines)
  const frontmatterMatch = fileContent.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) {
    throw new Error('No YAML frontmatter found in the file.');
  }

  // Parse the YAML frontmatter
  const frontmatter = yaml.load(frontmatterMatch[1]);

  // Return the healthcheck object
  return frontmatter;
}

// Example usage
const filePath = path.join(__dirname, 'example.md'); // Replace with your file path
try {
  const healthcheck = parseHealthcheckFile(filePath);
  console.log('Healthcheck:', healthcheck);
} catch (error) {
  console.error('Error parsing healthcheck file:', error.message);
}