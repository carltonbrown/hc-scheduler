const { execSync } = require('child_process');

/**
 * Clones a GitHub repository into a specified directory.
 * @param {string} token - The authentication token for the repository.
 * @param {string} repo - The repository in the format "owner/repo".
 * @param {string} targetDir - The directory to clone the repository into.
 */
function cloneRepo(token, repo, targetDir) {
  if (!token) {
    throw new Error('Cannot clone; no token is not set');
  }

  const repoUrl = `https://${token}@github.com/${repo}.git`;
  console.log(`Cloning repository ${repo} into ${targetDir}...`);
  execSync(`git clone ${repoUrl} ${targetDir}`, { stdio: 'inherit' });
}

/**
 * Maps issues to a more convenient data structure, adding skip_healthcheck_notification based on the skipLabel.
 * @param {Array} issues - Array of issue objects.
 * @param {string} skipLabel - The label to check for skipping healthchecks.
 * @returns {Array} - Array of mapped issue objects.
 */
function mapCheckableIssues(issues, skipLabel) {
  return issues.map((issue) => {
    const hasSkipLabel = issue.labels && issue.labels.includes(skipLabel);
    return {
      number: issue.number,
      title: issue.title,
      assignees: issue.assignees,
      labels: issue.labels,
      url: issue.url,
      skip_healthcheck_notification: hasSkipLabel
    };
  });
}

async function fetchIssuesFromV2Project(octokit, org, projectNumber, issueStatus = "Active", issueState = "OPEN") {
  if (!org) throw new Error("Organization (org) is required");
  const query = `
    query ($org: String!, $projectNumber: Int!, $after: String) {
      organization(login: $org) {
        projectV2(number: $projectNumber) {
          items(first: 100, after: $after) {
            pageInfo {
              hasNextPage
              endCursor
            }
            nodes {
              id
              content {
                ... on Issue {
                  title
                  number
                  url
                  state
                  assignees(first: 10) {
                    nodes { login }
                  }
                  labels(first: 20) {
                    nodes { name }
                  }
                }
              }
              fieldValues(first: 20) {
                nodes {
                  ... on ProjectV2ItemFieldSingleSelectValue {
                    field {
                      ... on ProjectV2FieldCommon {
                        name
                      }
                    }
                    name
                  }
                }
              }
            }
          }
        }
      }
    }
  `;

  let after = null;
  let issues = [];
  let hasNextPage = true;

  while (hasNextPage) {
    const variables = {
      org,
      projectNumber: Number(projectNumber),
      after,
    };

    const response = await octokit.graphql(query, variables);

    const items = response.organization?.projectV2?.items?.nodes || [];

    for (const item of items) {
      const issue = item.content;
      if (
        issue &&
        issue.state === issueState &&
        Array.isArray(issue.assignees?.nodes) &&
        issue.assignees.nodes.length > 0
      ) {
        // Find the Status field value
        const statusField = item.fieldValues.nodes.find(
          (field) =>
            field &&
            field.field &&
            field.field.name === "Status" &&
            field.name === issueStatus
        );
        if (statusField) {
          issues.push({
            id: item.id,
            title: issue.title,
            number: issue.number,
            url: issue.url,
            state: issue.state,
            assignees: issue.assignees.nodes.map(a => a.login),
            labels: issue.labels.nodes.map(l => l.name),
            status: statusField.name,
          });
        }
      }
    }

    hasNextPage = response.organization?.projectV2?.items?.pageInfo?.hasNextPage;
    after = response.organization?.projectV2?.items?.pageInfo?.endCursor;
  }

  return issues;
}

/**
 * Fetches the timeline events for an issue and returns the created_at date
 * for when the specified label was added.
 * 
 * @param {object} octokit - An authenticated Octokit REST client.
 * @param {string} owner - The repository owner.
 * @param {string} repo - The repository name.
 * @param {number} issueNumber - The issue number.
 * @param {string} labelName - The label to search for.
 * @returns {Promise<Date|null>} - The Date when the label was added, or null if not found.
 */
async function getIssueLabeledDate(octokit, owner, repo, issueNumber, labelName) {
  const per_page = 100;
  let page = 1;
  let result;
  while (true) {
    const { data: events } = await octokit.rest.issues.listEventsForTimeline({
      owner,
      repo,
      issue_number: issueNumber,
      per_page,
      page,
      mediaType: { previews: ['mockingbird'] }, // Required for timeline API
    });

    for (const event of events) {
      if (
        event.event === 'labeled' &&
        event.label &&
        event.label.name === labelName
      ) {
        result = new Date(event.created_at);
      }
    }

    if (events.length < per_page) break;
    page += 1;
  }
  return result;
}

module.exports = {
  cloneRepo,
  mapCheckableIssues,
  fetchIssuesFromV2Project,
  getIssueLabeledDate
};
