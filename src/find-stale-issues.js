/**
 * Finds issues that have no recent healthchecks (older than maxStalenessInDays).
 * Extracts the enterprise slug from the issue title (format: "slug - number").
 * @param {Array} healthchecks - The list of all healthchecks.
 * @param {Array} issues - The list of issues.
 * @param {number} maxStalenessInDays - The maximum number of days for a healthcheck to be considered non-stale.
 * @returns {Array} - The filtered list of issues with last_healthcheck_date and days_since_healthcheck.
 */
function findStaleIssues(healthchecks, issues, maxStalenessInDays) {
  const now = new Date();

  const results = issues
    .filter(issue => !issue.skip_healthcheck)
    .map(issue => {
      const enterpriseSlug = issue.title.replace(/\s*-\s*\d+.*$/, '');

      // Match healthchecks to this issue by enterprise_slug
      const matchingHealthchecks = healthchecks.filter(
        hc => hc.enterprise_slug === enterpriseSlug
      );

      // Find the most recent healthcheck
      const mostRecentHealthcheck = matchingHealthchecks
        .sort((a, b) => new Date(b.date) - new Date(a.date))[0];

      let last_healthcheck_date = null;
      let days_since_healthcheck = null;

      if (mostRecentHealthcheck) {
        last_healthcheck_date = mostRecentHealthcheck.date;
        days_since_healthcheck = Math.floor((now - new Date(last_healthcheck_date)) / (1000 * 60 * 60 * 24));
      }

      return {
        ...issue,
        enterprise_slug: enterpriseSlug,
        last_healthcheck_date,
        days_since_healthcheck,
      };
    })
    .filter(issue =>
      // Only include issues where the last healthcheck is stale or missing
      issue.last_healthcheck_date === null ||
      issue.days_since_healthcheck > maxStalenessInDays
    );

  return results;
}

module.exports = { findStaleIssues };
