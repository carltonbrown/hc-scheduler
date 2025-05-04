/**
 * Finds issues that have no non-stale healthchecks.
 * @param {Array} healthchecks - The list of all healthchecks.
 * @param {Array} issues - The list of issues.
 * @param {number} maxStalenessInDays - The maximum number of days for a healthcheck to be considered non-stale.
 * @returns {Array} - The filtered list of issues with last_healthcheck_date added where applicable.
 */
function findStaleIssues(healthchecks, issues, maxStalenessInDays) {
  const now = new Date();

  return issues
    .filter((issue) => {
      // Skip issues where skip_healthcheck is true
      if (issue.skip_healthcheck) {
        return false;
      }

      // Find all healthchecks for the issue's enterprise_slug
      const matchingHealthchecks = healthchecks.filter(
        (healthcheck) => healthcheck.enterprise_slug === issue.enterprise_slug
      );

      // Check if there are any non-stale healthchecks
      const hasNonStaleHealthcheck = matchingHealthchecks.some((healthcheck) => {
        const healthcheckDate = new Date(healthcheck.date);
        const ageInDays = (now - healthcheckDate) / (1000 * 60 * 60 * 24);
        return ageInDays <= maxStalenessInDays; // Non-stale if within maxStalenessInDays
      });

      return !hasNonStaleHealthcheck; // Include issue if no non-stale healthchecks exist
    })
    .map((issue) => {
      // Find the most recent stale healthcheck (if any)
      const matchingHealthchecks = healthchecks.filter(
        (healthcheck) => healthcheck.enterprise_slug === issue.enterprise_slug
      );

      const mostRecentStaleHealthcheck = matchingHealthchecks
        .filter((healthcheck) => {
          const healthcheckDate = new Date(healthcheck.date);
          const ageInDays = (now - healthcheckDate) / (1000 * 60 * 60 * 24);
          return ageInDays > maxStalenessInDays; // Stale if older than maxStalenessInDays
        })
        .sort((a, b) => new Date(b.date) - new Date(a.date))[0]; // Get the most recent stale healthcheck

      // Set last_healthcheck_date to the date of the most recent stale healthcheck, or null if none exist
      const healthcheckDate = mostRecentStaleHealthcheck
        ? mostRecentStaleHealthcheck.date
        : null;

      return {
        ...issue,
        last_healthcheck_date: healthcheckDate, // Add the new field
      };
    });
}

module.exports = { findStaleIssues };