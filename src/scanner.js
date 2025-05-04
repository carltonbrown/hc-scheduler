const fs = require('fs');
const path = require('path');

/**
 * Scans a directory recursively for files with the `.md` extension.
 * @param {string} dirPath - The directory to scan.
 * @returns {string[]} - A list of `.md` files with their relative paths.
 */
function scanForMarkdownFiles(dirPath) {
  let markdownFiles = [];

  // Read the contents of the directory
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      // Recursively scan subdirectories
      markdownFiles = markdownFiles.concat(scanForMarkdownFiles(fullPath));
    } else if (entry.isFile() && path.extname(entry.name) === '.md') {
      // Add `.md` files to the list
      markdownFiles.push(fullPath);
    }
  }

  return markdownFiles;
}

module.exports = { scanForMarkdownFiles };
