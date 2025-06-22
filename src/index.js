const core = require('@actions/core');
const github = require('@actions/github');
const { loadHealthCheckFiles, findOverdueIssues } = require('./healthcheck-helpers');
const { addIssueComment, unlabelIssue } = require('./update-issue');
const { cloneRepo, mapCheckableIssues, fetchIssuesFromV2Project, getIssueLabeledDate } = require('./fetch-helpers');
const fs = require('fs');
const path = require('path');

/**
 * Creates a callback that fetches the date when a specific label was added to an issue.
 *
 * @param {object} repoApiContext - Context containing octokit, repoOwner, and repoName.
 * @param {string} labelName - The label to search for on the issue.
 * @returns {function} - A function that takes an issue and returns a Promise<Date|null>.
 */
function makeLabeledDateCallback(repoApiContext, labelName) {
  return function(issue) {
    return getIssueLabeledDate(repoApiContext, issue.number, labelName);
  };
}

async function run() {
  try {
    const maxStalenessInDays = Number(core.getInput('max-staleness-days') || 60);
    const ratePauseSec = Number(core.getInput('ratelimit-pause-sec'));
    const hcDataSecret = core.getInput('hc-data-secret', { required: true });
    const dryRunInput = core.getInput('dry-run') || '';
    const isDryRun = ['true', '1'].includes(dryRunInput.trim().toLowerCase());
    const hcSubDir = core.getInput('dir-path');
    const hcDataRepo = core.getInput('hc-data-repo', { required: true });
    const projectNumber = core.getInput('issues-project-number', { required: true });
    const projectOrg = core.getInput('issues-project-org', { required: true });
    const projectRepo = core.getInput('issues-project-repo', { required: true });
    const issueStatus = core.getInput('notifiable-issue-status');
    const issueState = core.getInput('notifiable-issue-state');
    const skipLabelName = core.getInput('skip-label-name');

    // Clone the repo containing healthcheck .md files
    const dataCheckoutDir = './hc-data-checkout';
    cloneRepo(hcDataSecret, hcDataRepo, dataCheckoutDir);
    console.log('Current Working Directory:', process.cwd());
    console.log('Contents of Current Directory:', fs.readdirSync(process.cwd()));

    // Parse the healthcheck files
    const hcRelPath = path.join(dataCheckoutDir, hcSubDir);
    const allHealthchecks = loadHealthCheckFiles(hcRelPath);
    console.log(`Found ${allHealthchecks.length} historical healthchecks.`);

    // Fetch issues having the correct state and status from the project board
    console.log(`Fetching candidate issues for org=${projectOrg}, projectNumber=${projectNumber}, issueStatus=${issueStatus}, issueState=${issueState}`);
    const octokit = github.getOctokit(hcDataSecret);
    const projectBoardIssues = await fetchIssuesFromV2Project(
      octokit,
      projectOrg,
      projectNumber,
      issueStatus,
      issueState
    );
    console.log(`Fetched ${projectBoardIssues.length} issues.`);

    // Convenience object to encapsulate required vars for repo-related apis
    const repoApiContext = {
      octokit,
      repoOwner: projectOrg,
      repoName: projectRepo
    };

    // Map the issues API response to a more usable object
    const checkableIssues = await mapCheckableIssues(
      projectBoardIssues,
      skipLabelName,
      makeLabeledDateCallback(repoApiContext, skipLabelName)
    );

    // Relate healthcheck files to issue objects
    console.log(`Finding customer issues where the most recent healthcheck is greater than ${maxStalenessInDays} days old`);
    const overdueIssues = findOverdueIssues(allHealthchecks, checkableIssues, maxStalenessInDays);
    console.log(`Found ${overdueIssues.length} issues with overdue healthchecks.`);

    for (const issue of overdueIssues) {
      // Unlabel the skip notification label if it was created >30 days ago.
      if (issue.skip_labeled_since) {
        const now = new Date();
        const daysSkipped = Math.floor((now - issue.skip_labeled_since) / (1000 * 60 * 60 * 24));
        let unlabelResult;
        if (daysSkipped > 30) {
          unlabelResult = await unlabelIssue(repoApiContext, issue, skipLabelName, isDryRun);
        } else {
          console.log(`[INFO] - not removing label ${skipLabelName} on overdue issue '${issue.title}' which has been skipped for only ${daysSkipped} days (since ${issue.skip_labeled_since})`);
        }
        if (unlabelResult) {
          if (!unlabelResult.ok) {
            console.error(unlabelResult.message);
          } else {
            issue.skip_labeled_since = null;
            console.log(unlabelResult.message);
          }
        }
      }

      // Add issue comment with the appropriate notification reminder
      if (!issue.skip_labeled_since) {
        const result = await addIssueComment(repoApiContext, issue, skipLabelName, isDryRun);
        if (!result.ok) {
          console.error(result.message);
        } else {
          console.log(result.message);
        }
      }

      // If this is a production run (not a dry run), pause to avoid saturating secondary rate budgets
      if (!isDryRun) {
        await new Promise(resolve => setTimeout(resolve, ratePauseSec * 1000));
      }
    }
  } catch (error) {
    core.setFailed(`Action failed with error: ${error.message} || ${error.stack}`);
  }
}

run();