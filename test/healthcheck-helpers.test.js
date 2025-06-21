const path = require('path');
const fs = require('fs');
const {
  discoverMarkdownFiles,
  findOverdueIssues,
  loadHealthCheckFiles,
  parseHealthCheckFile
} = require('../src/healthcheck-helpers');

describe('discoverMarkdownFiles', () => {
  test('should find 3 markdown files in test/fixtures', () => {
    // Define the path to the fixtures directory
    const fixturesDir = path.join(__dirname, 'fixtures');

    // Run the scanner
    const markdownFiles = discoverMarkdownFiles(fixturesDir);

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
});

describe('findOverdueIssues', () => {
  const now = new Date();
  const daysAgo = (n) => {
    const d = new Date(now);
    d.setDate(d.getDate() - n);
    return d.toISOString().split('T')[0];
  };

  it('returns issues with no matching healthchecks', () => {
    const issues = [
      { title: 'Acme - 123', skip_healthcheck: false }
    ];
    const healthchecks = [];
    const result = findOverdueIssues(healthchecks, issues, 30);
    expect(result).toHaveLength(1);
    expect(result[0].last_healthcheck_date).toBeNull();
    expect(result[0].days_since_healthcheck).toBeNull();
  });

  it('returns issues with stale healthchecks', () => {
    const issues = [
      { title: 'Beta - 456', skip_healthcheck: false }
    ];
    const healthchecks = [
      { enterprise_slug: 'Beta', date: daysAgo(40) }
    ];
    const result = findOverdueIssues(healthchecks, issues, 30);
    expect(result).toHaveLength(1);
    expect(result[0].last_healthcheck_date).toBe(daysAgo(40));
    expect(result[0].days_since_healthcheck).toBeGreaterThan(30);
  });

  it('does not return issues with recent healthchecks', () => {
    const issues = [
      { title: 'Gamma - 789', skip_healthcheck: false }
    ];
    const healthchecks = [
      { enterprise_slug: 'Gamma', date: daysAgo(10) }
    ];
    const result = findOverdueIssues(healthchecks, issues, 30);
    expect(result).toHaveLength(0);
  });

  it('ignores issues with skip_healthcheck set to true', () => {
    const issues = [
      { title: 'Delta - 101', skip_healthcheck: true }
    ];
    const healthchecks = [
      { enterprise_slug: 'Delta', date: daysAgo(100) }
    ];
    const result = findOverdueIssues(healthchecks, issues, 30);
    expect(result).toHaveLength(0);
  });

  it('extracts the correct enterprise_slug from issue title', () => {
    const issues = [
      { title: 'Epsilon - 202', skip_healthcheck: false }
    ];
    const healthchecks = [
      { enterprise_slug: 'Epsilon', date: daysAgo(50) }
    ];
    const result = findOverdueIssues(healthchecks, issues, 30);
    expect(result[0].enterprise_slug).toBe('Epsilon');
  });

  it('handles multiple issues and healthchecks', () => {
    const issues = [
      { title: 'Zeta - 1', skip_healthcheck: false },
      { title: 'Eta - 2', skip_healthcheck: false }
    ];
    const healthchecks = [
      { enterprise_slug: 'Zeta', date: daysAgo(31) },
      { enterprise_slug: 'Eta', date: daysAgo(10) }
    ];
    const result = findOverdueIssues(healthchecks, issues, 30);
    expect(result).toHaveLength(1);
    expect(result[0].enterprise_slug).toBe('Zeta');
  });
});

describe('loadHealthCheckFiles', () => {
  test('should return all healthcheck objects located under the fixtures directory', () => {
    // Define the parameters
    const dirPath = path.join(
      __dirname,
      '../test/fixtures/helphub-knowledge-base/premium/health-checks/'
    );

    // Expected results
    const expectedHealthchecks = [
      {
        enterprise_slug: 'parsnip',
        enterprise_id: 1181,
        title: 'Health Check for parsnip - GitHub Enterprise Cloud',
        date: new Date('2024-12-25'), // Update to match the actual output
      },
      {
        enterprise_slug: 'avocado',
        enterprise_id: 8086,
        title: 'Health Check for avocado - GitHub Enterprise Cloud',
        date: new Date('2025-02-24'), // Update to match the actual outpu
      },
    ];

    // Call the function
    const healthchecks = loadHealthCheckFiles(dirPath);

    // Verify the result
    expect(healthchecks).toHaveLength(2);
    expect(healthchecks).toEqual(expect.arrayContaining(expectedHealthchecks));
  });
});

describe('parseHealthCheckFile', () => {
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
    const healthcheck = parseHealthCheckFile(fixturePath);
    expect(healthcheck).toEqual(expectedHealthcheck);
  });

  test('should return a default object with null enterprise_id if no YAML frontmatter is found', () => {
    // Define the path to a file without YAML frontmatter
    const invalidFixturePath = path.join(
      __dirname,
      '../test/fixtures/missing-frontmatter-hc.md'
    );

    // Parse the file and verify the result
    const healthcheck = parseHealthCheckFile(invalidFixturePath);
    expect(healthcheck).toEqual({ enterprise_id: null });
  });
});