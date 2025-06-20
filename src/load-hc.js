const path = require('path');
const { scanForMarkdownFiles } = require('./scanner');
const parseHealthcheckFile = require('./parse-frontmatter');

/**
 * Loads all healthcheck files and parses their content.
 * @param {string} [dirPath='./'] - The directory to search for healthcheck files (default is the current directory).
 * @returns {object[]} - A list of all healthcheck objects.
 */
function loadHealthChecks(hcSubDir = './premium/health-checks') {
  const markdownFiles = scanForMarkdownFiles(hcSubDir);
  const allHealthchecks = [];

  for (const file of markdownFiles) {
    const healthcheck = parseHealthcheckFile(file);

    if (healthcheck) {
      allHealthchecks.push(healthcheck);
    }
  }

  return allHealthchecks;
}

module.exports = { loadHealthChecks };