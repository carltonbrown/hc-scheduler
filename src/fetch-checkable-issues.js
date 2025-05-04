/**
 * Filters a list of issues to extract checkable issues.
 * @param {Array} issues - The list of issues to filter.
 * @param {string} skipLabel - The label used to identify issues to skip (default is 'skip-hc').
 * @returns {Array} - A list of filtered and restructured issues.
 */
function findCheckableIssues(issues, skipLabel = 'skip-hc') {
  // Define the regex pattern for extracting enterprise_slug and enterprise_id
  const titleRegex = /^\s*([\w-]+)\s*-\s*(\d+)\s*$/;

  // Map the issues to a smaller data structure
  const restructuredIssues = issues.map((issue) => {
    const match = issue.title.match(titleRegex); // Match the title against the regex
    const enterprise_slug = match ? match[1] : null; // Extract enterprise_slug (group 1)
    const enterprise_id = match ? parseInt(match[2], 10) : null; // Extract enterprise_id (group 2) and convert to number

    // Check if the issue has the skip label
    const skipHealthcheck = issue.labels.some((label) =>
      typeof label === 'string' ? label === skipLabel : label.name === 'skip-hc'
    );

    return {
      number: issue.number,
      title: issue.title,
      assignees: issue.assignees.map((assignee) => assignee.login), // Extract assignee usernames
      enterprise_slug, // Add extracted enterprise_slug
      enterprise_id,   // Add extracted enterprise_id
      skip_healthcheck: skipHealthcheck, // Add skip_healthcheck field
    };
  });

  // Return the list of filtered issues
  return restructuredIssues;
}

module.exports = { findCheckableIssues };