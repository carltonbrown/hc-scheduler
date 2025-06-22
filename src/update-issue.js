/**
 * Adds a comment to a GitHub issue, or logs the intended comment if dry run is enabled.
 * @param {object} repoApiContext - An object containing octokit, repoOwner, and repoName.
 * @param {Object} issue - The issue object from notifiableIssues.
 * @param {string} skipLabelName - The label that suppresses notifications.
 * @param {boolean} [isDryRun=true] - If true, the function will only log the comment instead of posting it.
 * @returns {Promise<{ok: boolean, message: string}>} - An object indicating success and a message.
 */
async function addIssueComment(repoApiContext, issue, skipLabelName, isDryRun = true) {
  let result = false;
  let returnMessage = '';
  const notificationComment = composeNotificationComment(issue, skipLabelName);
  const issueDescription = `#${issue.number} ${issue.title} in ${repoApiContext.repoOwner}/${repoApiContext.repoName}: ${notificationComment}`;

  try {
    if (isDryRun) {
      returnMessage = `[DRY-RUN] Would have commented on issue ${issueDescription}`;
    } else {
      await repoApiContext.octokit.rest.issues.createComment({
        owner: repoApiContext.repoOwner,
        repo: repoApiContext.repoName,
        issue_number: issue.number,
        body: notificationComment,
      });

      returnMessage = `Commented on issue ${issueDescription}`;
    }
    result = true;
  } catch (error) {
    returnMessage = `Failed to comment issue ${issueDescription} - ${error.message}`;
  }
  return { ok: result, message: returnMessage };
}

/**
 * Composes the notification comment for a health check issue.
 * @param {Object} issue - The issue object from notifiableIssues.
 * @param {string} skipLabelName - The label that suppresses notifications.
 * @returns {string} - The notification comment message.
 */
function composeNotificationComment(issue, skipLabelName) {
  if (!issue || !issue.title) {
    return `Could not determine healthcheck status because the issue is missing some fields: ${JSON.stringify(issue)}`;
  }
  const { enterprise_slug, last_healthcheck_date, assignees = [] } = issue;

  let baseMessage;

  const healthcheckDate = new Date(last_healthcheck_date);
  if (last_healthcheck_date == null || isNaN(healthcheckDate)) {
    baseMessage = 
      `No healthchecks were found for the issue titled '${issue.title}'
    This may reflect a mismatch between the issue title and the healthcheck's YAML frontmatter.
    To fix this, ensure the next healthcheck frontmatter matches the issue, or update the title of ${issue.url}`;
    } else {
    const now = new Date();
    const ageInDays = Math.floor((now - healthcheckDate) / (1000 * 60 * 60 * 24));

    const formattedDate = new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(healthcheckDate);

    baseMessage = `The enterprise ${issue.title} is due for a health check because its last check was ${ageInDays} days ago on ${formattedDate}.`;
  }

    const suppressionAdvice =
        `If you'd like to suppress this message temporarily, add the label \`${skipLabelName}\` to the issue ${issue.url}.
      If the issue should never get healthchecks, close the issue.
      If you think the issue is mis-assigned, ensure that the right people are assigned`;

    const finalMessage = `${baseMessage} ${suppressionAdvice}`;

  if (assignees.length > 0) {
    // build assigneeMentions as a space-separated list of @handles
    const assigneeMentions = assignees.map((assignee) => `@${assignee}`).join(' ');
    return `Heads-up ${assigneeMentions}! ${finalMessage}.`;
  } else {
    return finalMessage;
  }
}

/**
 * Removes a label from a GitHub issue, or logs the intended action if dry run is enabled.
 * Handles errors gracefully and returns a status object.
 *
 * @param {object} context - An object containing octokit, repoOwner, and repoName.
 * @param {Object} issue - The issue object containing issue details.
 * @param {string} labelName - The name of the label to remove.
 * @param {boolean} [isDryRun=true] - If true, logs the intended action instead of performing it.
 * @returns {Promise<{ok: boolean, message: string}>} - An object indicating success and a message.
 */
async function unlabelIssue(context, issue, labelName, isDryRun = true) {
  const baseMessage = `\`${labelName}\` from issue #${issue.number} in \`${context.repoOwner}/${context.repoName}\` (${issue.title})`;
  let returnMessage = '';
  let result = false;

  try {
    if (isDryRun) {
      returnMessage = `[DRY-RUN] Would have removed label ${baseMessage}`;
    } else {
      returnMessage = `Removing label ${baseMessage}`;
      await context.octokit.rest.issues.removeLabel({
        owner: context.repoOwner,
        repo: context.repoName,
        issue_number: issue.number,
        name: labelName,
      });
    }
    result = true;
  } catch (error) {
    returnMessage = `Error removing label ${baseMessage}: ${error.message}`;
  }
  return { ok: result, message: returnMessage };
}

module.exports = { addIssueComment, composeNotificationComment, unlabelIssue };
