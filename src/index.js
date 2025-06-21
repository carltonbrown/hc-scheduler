const core = require('@actions/core');
const github = require('@actions/github');
const { loadHealthChecks } = require('./load-hc');
const { findOverdueIssues } = require('./healthcheck-helpers');
const { addIssueComment, unlabelIssue } = require('./update-issue');
const { cloneRepo, mapCheckableIssues, fetchIssuesFromV2Project, getIssueLabeledDate } = require('./fetch-helpers');
const fs = require('fs');
const path = require('path');

async function run() {
  try {
    const maxStalenessInDays = Number(core.getInput('max-staleness-days') || 60);
    const ratePauseSec = Number(core.getInput('ratelimit-pause-sec'));
    const hcDataSecret = core.getInput('hc-data-secret', { required: true });
    const dryRunInput = core.getInput('dry-run') || '';
    const isDryRun = ['true', '1'].includes(dryRunInput.trim().toLowerCase()) // ensure sloppy inputs get cast correctly;
    const hcSubDir = core.getInput('dir-path');
    const hcDataRepo = core.getInput('hc-data-repo', { required: true });
    const projectNumber = core.getInput('issues-project-number', { required: true });
    const projectOrg = core.getInput('issues-project-org', { required: true });
    const projectRepo = core.getInput('issues-project-repo', { required: true });
    const issueStatus = core.getInput('notifiable-issue-status');
    const issueState = core.getInput('notifiable-issue-state');
    const skipLabelName = core.getInput('skip-label-name');
    const octokit = github.getOctokit(hcDataSecret);

    console.log(`Fetching candidate issues for org=${projectOrg}, projectNumber=${projectNumber}, issueStatus=${issueStatus}, issueState=${issueState}`);
    const issues = await fetchIssuesFromV2Project(octokit, projectOrg, projectNumber, issueStatus, issueState);
    console.log(`Fetched ${issues.length} issues.`);
    const checkableIssues = mapCheckableIssues(issues, skipLabelName)

    const dataCheckoutDir = './hc-data-checkout';
    cloneRepo(hcDataSecret, hcDataRepo, dataCheckoutDir);
    console.log('Current Working Directory:', process.cwd());
    console.log('Contents of Current Directory:', fs.readdirSync(process.cwd()));
    const hcRelPath = path.join(dataCheckoutDir, hcSubDir);
    const allHealthchecks = loadHealthChecks(hcRelPath);
    console.log(`Found ${allHealthchecks.length} historical healthchecks.`);

    console.log(`Finding customer issues where the most recent healthcheck is greater than ${maxStalenessInDays} days old`);
    const overdueIssues = findOverdueIssues(allHealthchecks, checkableIssues, maxStalenessInDays);
    console.log(`Found ${overdueIssues.length} customers needing healthchecks.`);

    for (const enterpriseIssue of overdueIssues) {
      // Remove the notification pause if it's paused too long and there are no recent comments.
      if (enterpriseIssue.skip_healthcheck_notification) {
        const skipLabeledDate = await getIssueLabeledDate(octokit, projectOrg, projectRepo, enterpriseIssue.number, skipLabelName);
        const now = new Date();
        const daysSkipped = (now - skipLabeledDate) / (1000 * 60 * 60 * 24);
        let result;
        console.log(`skipLabeledDate is ${skipLabeledDate} for \'${enterpriseIssue.title}\'`)
        if (daysSkipped > 30) {
          result = await unlabelIssue(octokit, projectOrg, projectRepo, enterpriseIssue, isDryRun, ratePauseSec, skipLabelName);
        }
        if (result) {
          if (!result.ok) {
            console.error(result.message);
          } else {
            console.log(result.message);
          }
        }
      }

      // Make the appropriate notification reminder
      if (!enterpriseIssue.skip_healthcheck_notification) {
        const result = await addIssueComment(octokit, projectOrg, projectRepo, enterpriseIssue, isDryRun, skipLabelName);
        if (!result.ok) {
          console.error(result.message);
        } else {
          console.log(result.message)
        }
      }

      // If this a dry run (not a production run), pause ${ratePauseSec} to avoid saturating secondary rate budgets 
      if (!isDryRun) {
        await new Promise(resolve => setTimeout(resolve, ratePauseSec * 1000));
      }
    }
  } catch (error) {
    core.setFailed(`Action failed with error: ${error.message} || ${error.stack}`);
  }
}

run();
