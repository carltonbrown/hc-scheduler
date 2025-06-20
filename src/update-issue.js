const github = require('@actions/github');

/**
 * Composes the notification comment for a health check issue.
 * @param {Object} enterpriseIssue - The issue object from notifiableIssues.
 * @returns {string} - The notification comment message.
 */
function composeNotificationComment(enterpriseIssue, skipLabel) {
  const { enterprise_slug, last_healthcheck_date, assignees } = enterpriseIssue;

  let baseMessage;

  if (last_healthcheck_date === null) {
    baseMessage = `The enterprise ${enterpriseIssue.title} is due for a health check because it's never had one.`;
  } else {
    const healthcheckDate = new Date(last_healthcheck_date);
    if (isNaN(healthcheckDate)) {
      throw new Error(`Invalid date: ${last_healthcheck_date}`);
    }

    const now = new Date();
    const ageInDays = Math.floor((now - healthcheckDate) / (1000 * 60 * 60 * 24));

    const formattedDate = new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(healthcheckDate);

    baseMessage = `The enterprise ${enterpriseIssue.title} is due for a health check because its last check was ${ageInDays} days ago on ${formattedDate}.`;
  }

  const assigneeMentions = assignees.length > 0
    ? assignees.map((assignee) => `@${assignee}`).join(' ')
    : '';

  return assignees.length > 0
    ? `Heads-up ${assigneeMentions}! ${baseMessage}  If you'd like to suppress this message for 30 days, add the label \`${skipLabel}\`  to the issue ${enterpriseIssue.url}`
    : baseMessage;
}

/**
 * Adds a comment to a GitHub issue.
 * @param {string} token - The GitHub token for authentication.
 * @param {string} repoOwner - The owner of the repository.
 * @param {string} repoName - The name of the repository.
 * @param {Object} enterpriseIssue - The issue object from notifiableIssues.
 * @param {boolean} isDryRun - If true, the function will only log the comment instead of posting it.
 * @returns {Promise<void>} - A promise that resolves when the comment is added or logged.
 */
async function updateIssue(token, repoOwner, repoName, enterpriseIssue, isDryRun = false, ratePauseSec = 1, skipLabel) {
  try {
    const octokit = github.getOctokit(token);

    let notificationComment = composeNotificationComment(enterpriseIssue, skipLabel);

    if (isDryRun) {
      console.log(`[DRY-RUN] Would have commented on issue #${enterpriseIssue.number} ${enterpriseIssue.title} in ${repoOwner}/${repoName}: ${notificationComment}`);
    } else {
      await octokit.rest.issues.createComment({
        owner: repoOwner,
        repo: repoName,
        issue_number: enterpriseIssue.number,
        body: notificationComment,
      });

      console.log(`Commented on issue #${enterpriseIssue.number}: ${notificationComment}`);
      await new Promise(resolve => setTimeout(resolve, ratePauseSec * 1000));
    }
  } catch (error) {
    console.error(`Failed to update issue #${enterpriseIssue.number}: ${error.message}`);
    throw error;
  }
}

module.exports = { updateIssue, composeNotificationComment };
