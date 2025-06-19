const core = require('@actions/core');
const github = require('@actions/github');
const { execSync } = require('child_process');
const { loadHealthChecks } = require('./load-hc');
const { findStaleIssues } = require('./find-stale-issues');
const { updateIssue } = require('./update-issue');
const fs = require('fs');

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
 * Maps issues to a more convenient data structure, adding skip_healthcheck based on the skipLabel.
 * @param {Array} issues - Array of issue objects.
 * @param {string} skipLabel - The label to check for skipping healthchecks.
 * @returns {Array} - Array of mapped issue objects.
 */
function mapCheckableIssues(issues, skipLabel = 'pause-healthcheck-reminders') {
  const results = issues.map((issue) => {
    const skipHealthcheck = issue.labels.some((label) =>
      typeof label === 'string' ? label === skipLabel : label.name === skipLabel
    );

    return {
      number: issue.number,
      title: issue.title,
      assignees: issue.assignees,
      labels: issue.labels,
      skip_healthcheck: skipHealthcheck,
    };
  });
  return results;
}

/**
 * Fetches issues from a GitHub Projects (v2/Next Gen) board using GraphQL.
 * Only returns issues with the specified project Status, issue state, and at least one assignee.
 * 
 * @param {string} token - The GitHub token for authentication.
 * @param {string} org - The organization login (required).
 * @param {number} projectNumber - The project number (not ID).
 * @param {string} issueStatus - The project Status field value to match (default: "Active").
 * @param {string} issueState - The GitHub issue state to match (default: "OPEN").
 * @returns {Promise<Array>} - A promise that resolves to an array of matching issues.
 */
async function fetchIssuesFromV2Project(token, org, projectNumber, issueStatus = "Active", issueState = "OPEN") {
  if (!org) throw new Error("Organization (org) is required");
  const octokit = github.getOctokit(token);
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

    // TODO: Go back and determine if this can be gotten from the GraphQL query
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

async function run() {
  try {
    const maxStalenessInDays = core.getInput('max-staleness-days') || 60;
    const ghToken = core.getInput('github-token', { required: true });
    const hcDataSecret = core.getInput('hc-data-secret', { required: true });
    const dryRun = core.getInput('dry-run') === 'true';
    const dirPath = core.getInput('dir-path');
    const hcDataRepo = core.getInput('hc-data-repo', { required: true });
    const projectNumber = core.getInput('issues-project-number', { required: true });
    const projectOrg = core.getInput('issues-project-org', { required: true });
    const projectRepo = core.getInput('issues-project-repo', { required: true });
    const issueStatus = core.getInput('notifiable-issue-status');
    const issueState = core.getInput('notifiable-issue-state');

    console.log(`Fetching candidate issues for org=${projectOrg}, projectNumber=${projectNumber}, issueStatus=${issueStatus}, issueState=${issueState}`);
    const issues = await fetchIssuesFromV2Project(hcDataSecret, projectOrg, projectNumber, issueStatus, issueState);
    console.log(`Fetched ${issues.length} issues.`);


    const checkableIssues = mapCheckableIssues(issues)

    const dataCheckoutDir = './hc-data-checkout';

    cloneRepo(hcDataSecret, hcDataRepo, dataCheckoutDir);
    console.log('Current Working Directory:', process.cwd());
    console.log('Contents of Current Directory:', fs.readdirSync(process.cwd()));

    const allHealthchecks = loadHealthChecks(dataCheckoutDir);

    console.log(`Found ${allHealthchecks.length} historical healthchecks.`);

    console.log(`Finding customer issues where the most recent healthcheck is greater than ${maxStalenessInDays} days old`);
    const staleIssues = findStaleIssues(allHealthchecks, checkableIssues, maxStalenessInDays);

    console.log(`Found ${staleIssues.length} customers needing healthchecks.`);

    for (const enterpriseIssue of staleIssues) {
      await updateIssue(ghToken, projectOrg, projectRepo, enterpriseIssue, dryRun);
    }
  } catch (error) {
    core.setFailed(`Action failed with error: ${error.message}`);
  }
}

run();
