const path = require('path');
const { scanForMarkdownFiles } = require('../src/scanner');

test('should find 2 markdown files in test/fixtures', () => {
  // Define the path to the fixtures directory
  const fixturesDir = path.join(__dirname, 'fixtures');

  // Run the scanner
  const markdownFiles = scanForMarkdownFiles(fixturesDir);

  // Verify that it finds the correct number of `.md` files
  expect(markdownFiles.length).toBe(3);

  // Verify that the correct files are found
  const expectedFiles = [
    path.join(fixturesDir, 'helphub-knowledge-base/premium/health-checks/2024/parsnip-2024-12.md'),
    path.join(fixturesDir, 'helphub-knowledge-base/premium/health-checks/2025/avocado-2025-02.md'),
    path.join(fixturesDir, 'missing-frontmatter-hc.md')
  ];
  expect(markdownFiles).toEqual(expect.arrayContaining(expectedFiles));
});
