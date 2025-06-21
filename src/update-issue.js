/**
 * Composes the notification comment for a health check issue.
 * @param {Object} enterpriseIssue - The issue object from notifiableIssues.
 * @returns {string} - The notification comment message.
 */
function composeNotificationComment(enterpriseIssue, skipLabelName) {
  const { enterprise_slug, last_healthcheck_date, assignees = [] } = enterpriseIssue;
  let baseMessage;

  if (last_healthcheck_date === null) {
    baseMessage =
      `No healthchecks were found for the issue titled '${enterpriseIssue.title}'. `
      "This may reflect a mismatch between the issue title and the healthcheck's frontmatter.";  } else {

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

  const suppressionAdvice = `If you'd like to suppress this message temporarily, add the label \`${skipLabelName}\` to the issue ${enterpriseIssue.url}`;
  const finalMessage = `${baseMessage} ${suppressionAdvice}`;

  const assigneeMentions = assignees.length > 0
    ? assignees.map((assignee) => `@${assignee}`).join(' ')
    : '';

  return assignees.length > 0
    ? `Heads-up ${assigneeMentions}! ${finalMessage}.`
    : finalMessage;
}

/**
 * Adds a comment to a GitHub issue, or logs the intended comment if dry run is enabled.
 * @param {object} octokit - An authenticated Octokit REST client.
 * @param {string} repoOwner - The owner of the repository.
 * @param {string} repoName - The name of the repository.
 * @param {Object} enterpriseIssue - The issue object from notifiableIssues.
 * @param {boolean} [isDryRun=false] - If true, the function will only log the comment instead of posting it.
 * @param {number} [ratePauseSec=1] - Number of seconds to pause after commenting.
 * @param {string} skipLabel - The label that suppresses notifications.
 * @returns {Promise<{ok: boolean, message: string}>} - An object indicating success and a message. */
async function addIssueComment(octokit, repoOwner, repoName, enterpriseIssue, isDryRun = true, ratePauseSec = 1, skipLabelName) {
  try {
    const notificationComment = composeNotificationComment(enterpriseIssue, skipLabelName);
    const issueDescription = `#${enterpriseIssue.number} ${enterpriseIssue.title} in ${repoOwner}/${repoName}: ${notificationComment}`
    
    let returnMessage;
    let result = false;
    
    if (isDryRun) {
      returnMessage = `[DRY-RUN] Would have commented on issue ${issueDescription}`;
    } else {
      await octokit.rest.issues.createComment({
        owner: repoOwner,
        repo: repoName,
        issue_number: enterpriseIssue.number,
        body: notificationComment,
      });

      returnMessage = `Commented on issue ${issueDescription}`;
      await new Promise(resolve => setTimeout(resolve, ratePauseSec * 1000));
    }
    result = true;
  } catch (error) {
    returnMessage = `Failed to comment issue ${issueDescription} - ${error.message}`;
  }
  return { ok: result, message: returnMessage };
}

/**
 * Removes a label from a GitHub issue, or logs the intended action if dry run is enabled.
 * Handles errors gracefully and returns a status object.
 *
 * @param {object} octokit - An authenticated Octokit REST client.
 * @param {string} repoOwner - The owner of the repository.
 * @param {string} repoName - The name of the repository.
 * @param {Object} enterpriseIssue - The issue object containing issue details.
 * @param {boolean} [isDryRun=false] - If true, logs the intended action instead of performing it.
 * @param {number} [ratePauseSec=1] - Number of seconds to pause after removing the label.
 * @param {string} labelName - The name of the label to remove.
 * @returns {Promise<{ok: boolean, message: string}>} - An object indicating success and a message.
 */
async function unlabelIssue(octokit, repoOwner, repoName, enterpriseIssue, isDryRun = true, ratePauseSec = 1, labelName) {
  const baseMessage = `\`${labelName}\` from issue #${enterpriseIssue.number} in \`${repoOwner}/${repoName}\` (${enterpriseIssue.title})`;
  let returnMessage = '';
  let result = false;

  try {
    if (isDryRun) {
      returnMessage = `[DRY-RUN] Would have removed label ${baseMessage}`;
    } else {
      returnMessage = `Removing label ${baseMessage}`;
      await octokit.rest.issues.removeLabel({
        owner: repoOwner,
        repo: repoName,
        issue_number: enterpriseIssue.number,
        name: labelName,
      });
      await new Promise(resolve => setTimeout(resolve, ratePauseSec * 1000));
    }
    result = true;
  } catch (error) {
    returnMessage = `Unexpected error removing label ${baseMessage}: ${error.message}`;
  }
  return { ok: result, message: returnMessage };
}

module.exports = { addIssueComment, composeNotificationComment, unlabelIssue };
