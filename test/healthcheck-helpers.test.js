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
    const fixturesDir = path.join(__dirname, 'fixtures');
    const markdownFiles = discoverMarkdownFiles(fixturesDir);
    expect(markdownFiles.length).toBe(3);

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
      { enterprise_slug: 'beta', date: daysAgo(40) }
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
      { enterprise_slug: 'gamma', date: daysAgo(10) }
    ];
    const result = findOverdueIssues(healthchecks, issues, 30);
    expect(result).toHaveLength(0);
  });

  it('extracts the correct enterprise_slug from issue title', () => {
    const issues = [
      { title: 'Epsilon - 202', skip_healthcheck: false }
    ];
    const healthchecks = [
      { enterprise_slug: 'epsilon', date: daysAgo(50) }
    ];
    const result = findOverdueIssues(healthchecks, issues, 30);
    expect(result[0].enterprise_slug).toBe('epsilon');
  });

  it('handles multiple issues and healthchecks', () => {
    const issues = [
      { title: 'Zeta - 1', skip_healthcheck: false },
      { title: 'Eta - 2', skip_healthcheck: false }
    ];
    const healthchecks = [
      { enterprise_slug: 'zeta', date: daysAgo(31) },
      { enterprise_slug: 'eta', date: daysAgo(10) }
    ];
    const result = findOverdueIssues(healthchecks, issues, 30);
    expect(result).toHaveLength(1);
    expect(result[0].enterprise_slug).toBe('zeta');
  });
});

describe('loadHealthCheckFiles', () => {
  test('should return all healthcheck objects located under the fixtures directory', () => {
    const dirPath = path.join(
      __dirname,
      '../test/fixtures/helphub-knowledge-base/premium/health-checks/'
    );

    const expectedHealthchecks = [
      {
        enterprise_slug: 'parsnip',
        enterprise_id: 1181,
        title: 'Health Check for parsnip - GitHub Enterprise Cloud',
        date: new Date('2024-12-25'),
      },
      {
        enterprise_slug: 'avocado',
        enterprise_id: 8086,
        title: 'Health Check for avocado - GitHub Enterprise Cloud',
        date: new Date('2025-02-24'),
      },
    ];

    const healthchecks = loadHealthCheckFiles(dirPath);

    expect(healthchecks).toHaveLength(2);
    expect(healthchecks).toEqual(expect.arrayContaining(expectedHealthchecks));
  });
});

describe('parseHealthCheckFile', () => {
  test('should correctly parse YAML frontmatter from a markdown file', () => {
    const fixturePath = path.join(
      __dirname,
      '../test/fixtures/helphub-knowledge-base/premium/health-checks/2025/avocado-2025-02.md'
    );

    const expectedHealthcheck = {
      enterprise_slug: "avocado",
      enterprise_id: 8086,
      title: 'Health Check for avocado - GitHub Enterprise Cloud',
      date: new Date('2025-02-24'),
    };

    const healthcheck = parseHealthCheckFile(fixturePath);
    expect(healthcheck).toEqual(expectedHealthcheck);
  });

  test('should return a default object with null enterprise_id if no YAML frontmatter is found', () => {
    const invalidFixturePath = path.join(
      __dirname,
      '../test/fixtures/missing-frontmatter-hc.md'
    );

    const healthcheck = parseHealthCheckFile(invalidFixturePath);
    expect(healthcheck).toEqual({ enterprise_id: null });
  });
});