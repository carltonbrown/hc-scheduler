const { findOverdueIssues } = require('../src/healthcheck-helpers');

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