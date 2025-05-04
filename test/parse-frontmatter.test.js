const path = require('path');
const parseHealthcheckFile = require('../src/parse-frontmatter');

describe('parseHealthcheckFile', () => {
  test('should correctly parse YAML frontmatter from a markdown file', () => {
    // Define the path to the test fixture
    const fixturePath = path.join(
      __dirname,
      '../test/fixtures/helphub-knowledge-base/premium/health-checks/2025/avocado-2025-02.md'
    );

    // Expected result based on the YAML frontmatter in the fixture
    const expectedHealthcheck = {
      enterprise_slug: "avocado",
      enterprise_id: 8086,
      title: 'Health Check for avocado - GitHub Enterprise Cloud',
      date: new Date('2025-02-24'),
    };

    // Parse the file and verify the result
    const healthcheck = parseHealthcheckFile(fixturePath);
    expect(healthcheck).toEqual(expectedHealthcheck);
  });

  test('should return a default object with null enterprise_id if no YAML frontmatter is found', () => {
    // Define the path to a file without YAML frontmatter
    const invalidFixturePath = path.join(
      __dirname,
      '../test/fixtures/missing-frontmatter-hc.md'
    );

    // Parse the file and verify the result
    const healthcheck = parseHealthcheckFile(invalidFixturePath);
    expect(healthcheck).toEqual({ enterprise_id: null });
  });
});