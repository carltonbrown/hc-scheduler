const core = require('@actions/core');
const github = require('@actions/github');
const { execSync } = require('child_process');
const { loadHealthChecks } = require('./load-hc');
const { findCheckableIssues } = require('./fetch-checkable-issues');
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
 * Fetches all issues in the repository using pagination.
 * @param {string} token - The GitHub token for authentication.
 * @param {string} repoOwner - The owner of the repository.
 * @param {string} repoName - The name of the repository.
 * @param {string} state - The state of the issues to fetch (default is 'open').
 * @returns {Promise<Array>} - A promise that resolves to the list of all issues.
 */
async function fetchIssues(token, repoOwner, repoName, state = 'open') {
  const octokit = github.getOctokit(token);
  const perPage = 100; 
  let page = 1;
  let allIssues = [];

  try {
    while (true) {
      const { data: issues } = await octokit.rest.issues.listForRepo({
        owner: repoOwner,
        repo: repoName,
        state: state,
        per_page: perPage,
        page: page,
      });

      allIssues = allIssues.concat(issues);

      if (issues.length < perPage) {
        break;
      }

      page++;
    }
    return allIssues;
  } catch (error) {
    throw new Error(`Failed to fetch issues: ${error.message}`);
  }
}

async function run() {
  try {
    const maxStalenessInDays = core.getInput('max-staleness-days') || 60;
    const ghToken = core.getInput('github-token', { required: true });
    const hcDataSecret = core.getInput('hc-data-secret', { required: true });
    const dryRun = core.getInput('dry-run') === 'true';
    const dirPath = core.getInput('dir-path');
    const hcDataRepo = core.getInput('hc-data-repo', { required: true });
    const { owner: repoOwner, repo: repoName } = github.context.repo;

    console.log('Fetching all issues from the repository:');
    const issues = await fetchIssues(ghToken, repoOwner, repoName);
    console.log(`Fetched ${issues.length} issues.`);

    console.log('Fetching checkable customer issues:');
    const checkableIssues = findCheckableIssues(issues); 
    console.log(`Filtered ${checkableIssues.length} checkable issues.`);

    const dataCheckoutDir = './hc-data-checkout';

    cloneRepo(hcDataSecret, hcDataRepo, dataCheckoutDir);
    console.log('Current Working Directory:', process.cwd());
    console.log('Contents of Current Directory:', fs.readdirSync(process.cwd()));

    const allHealthchecks = loadHealthChecks(dataCheckoutDir);

    console.log(`Found ${allHealthchecks.length} healthchecks.`);

    console.log('Finding customer issues needing healthchecks:');
    const staleIssues = findStaleIssues(allHealthchecks, checkableIssues, maxStalenessInDays);
    console.log(`Found ${staleIssues.length} customers needing healthchecks.`);

    for (const enterpriseIssue of staleIssues) {
      await updateIssue(ghToken, repoOwner, repoName, enterpriseIssue, dryRun);
    }
  } catch (error) {
    core.setFailed(`Action failed with error: ${error.message}`);
  }
}name: "Notify when healthchecks are due"

on:
  workflow_dispatch: # Allows manual triggering of the workflow

  schedule:
    - cron: '0 19 * * *' # Runs daily at 19:00 UTC (6:00 AM Sydney time during daylight saving)

jobs:
  healthcheck:
    runs-on: ubuntu-latest

    permissions:
      issues: write
      contents: read

    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Run Healthcheck Scheduler Action
        uses: carltonbrown/hc-scheduler@main
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          hc-data-secret: ${{ secrets.HC_DATA_SECRET }}
          max-staleness-days: "60"
          hc-data-repo: "github/helphub-knowledge-base"
          dir-path: "./premium/health-checks"
          dry-run: true

run();