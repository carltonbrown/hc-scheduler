const { unlabelIssue, addIssueComment, composeNotificationComment } = require('../src/update-issue');

describe('composeNotificationComment', () => {
  it('returns a message with assignee mentions and healthcheck date when valid date and assignees exist', () => {
    const issue = {
      number: 1,
      title: 'Test Enterprise',
      url: 'https://github.com/grubhub/super-support/issues/1',
      last_healthcheck_date: '2024-05-01T00:00:00Z',
      assignees: ['alice', 'bob'],
    };
    const skipLabelName = 'pause-healthcheck-notifications';
    const comment = composeNotificationComment(issue, skipLabelName);

    expect(comment).toMatch(/Heads-up @alice @bob!/);
    expect(comment).toContain('Test Enterprise');
    expect(comment).toContain('2024');
    expect(comment).toContain(skipLabelName);
  });

  it('returns a message without assignee mentions when no assignees', () => {
    const issue = {
      number: 2,
      title: 'No Assignees',
      url: 'https://github.com/grubhub/super-support/issues/2',
      last_healthcheck_date: '2024-05-01T00:00:00Z',
      assignees: [],
    };
    const skipLabelName = 'pause-healthcheck-notifications';
    const comment = composeNotificationComment(issue, skipLabelName);

    expect(comment).not.toMatch(/Heads-up/);
    expect(comment).toContain('No Assignees');
    expect(comment).toContain(skipLabelName);
  });

  it('returns a message about missing healthchecks if last_healthcheck_date is invalid', () => {
    const issue = {
      number: 3,
      title: 'Missing Healthcheck',
      url: 'https://github.com/grubhub/super-support/issues/3',
      assignees: ['alice'],
      last_healthcheck_date: undefined,
    };
    const skipLabelName = 'pause-healthcheck-notifications';
    const comment = composeNotificationComment(issue, skipLabelName);

    expect(comment).toMatch(/No healthchecks were found/);
    expect(comment).toContain('Missing Healthcheck');
    expect(comment).toContain(skipLabelName);
  });

  it('returns a message about missing healthchecks if last_healthcheck_date is null', () => {
    const issue = {
      number: 4,
      title: 'Null Healthcheck',
      url: 'https://github.com/grubhub/super-support/issues/4',
      assignees: [],
      last_healthcheck_date: null,
    };
    const skipLabelName = 'pause-healthcheck-notifications';
    const comment = composeNotificationComment(issue, skipLabelName);

    expect(comment).toMatch(/No healthchecks were found/);
    expect(comment).toContain('Null Healthcheck');
    expect(comment).toContain(skipLabelName);
  });
});

describe('addIssueComment', () => {
  const repoApiContext = {
    octokit: null, // will be set in beforeEach
    repoOwner: 'grubhub',
    repoName: 'super-support',
  };
  const skipLabelName = 'pause-healthcheck-notifications';
  const issue = {
    number: 42,
    title: 'Test Issue',
    url: 'https://github.com/grubhub/super-support/issues/42',
    assignees: ['alice', 'bob'],
    labels: [skipLabelName, 'other-label'],
    last_healthcheck_date: '2024-05-01T00:00:00Z',
  };

  beforeEach(() => {
    repoApiContext.octokit = {
      rest: {
        issues: {
          createComment: jest.fn().mockResolvedValue({}),
        },
      },
    };
  });

  it('should return dry-run message and not call octokit when isDryRun is true', async () => {
    const result = await addIssueComment(
      repoApiContext,
      issue,
      skipLabelName,
      true // isDryRun
    );

    expect(result.ok).toBe(true);
    expect(result.message).toContain('[DRY-RUN] Would have commented on issue');
    expect(result.message).toContain(`#${issue.number}`);
    expect(repoApiContext.octokit.rest.issues.createComment).not.toHaveBeenCalled();
  });

  it('should call octokit and return success message when isDryRun is false', async () => {
    const result = await addIssueComment(
      repoApiContext,
      issue,
      skipLabelName,
      false // isDryRun
    );

    expect(result.ok).toBe(true);
    expect(result.message).toContain('Commented on issue');
    expect(result.message).toContain(`#${issue.number}`);
    expect(repoApiContext.octokit.rest.issues.createComment).toHaveBeenCalledWith({
      owner: repoApiContext.repoOwner,
      repo: repoApiContext.repoName,
      issue_number: issue.number,
      body: expect.any(String),
    });
  });

  it('should handle errors and return error message', async () => {
    const errorMsg = 'API error!';
    repoApiContext.octokit.rest.issues.createComment.mockRejectedValueOnce(new Error(errorMsg));

    const result = await addIssueComment(
      repoApiContext,
      issue,
      skipLabelName,
      false // isDryRun
    );

    expect(result.ok).toBe(false);
    expect(result.message).toContain('Failed to add comment to');
    expect(result.message).toContain(errorMsg);
  });
});

describe('unlabelIssue', () => {
  const context = {
    octokit: null, // will be set in beforeEach
    repoOwner: 'grubhub',
    repoName: 'super-support',
  };
  const labelName = 'pause-healthcheck-notifications';
  const issue = {
    number: 42,
    title: 'Test Issue',
    url: 'https://github.com/grubhub/super-support/issues/42',
    assignees: ['alice', 'bob'],
    labels: ['pause-healthcheck-notifications', 'other-label'],
  };

  beforeEach(() => {
    context.octokit = {
      rest: {
        issues: {
          removeLabel: jest.fn().mockResolvedValue({}),
        },
      },
    };
  });

  it('should return dry-run message and not call octokit when isDryRun is true', async () => {
    const result = await unlabelIssue(
      context,
      issue,
      labelName,
      true // isDryRun
    );

    expect(result.ok).toBe(true);
    expect(result.message).toContain('[DRY-RUN] Would have removed label');
    expect(result.message).toContain(labelName);
    expect(context.octokit.rest.issues.removeLabel).not.toHaveBeenCalled();
  });

  it('should call octokit and return success message when isDryRun is false', async () => {
    const result = await unlabelIssue(
      context,
      issue,
      labelName,
      false // isDryRun
    );

    expect(result.ok).toBe(true);
    expect(result.message).toContain('Removing label');
    expect(result.message).toContain(labelName);
    expect(context.octokit.rest.issues.removeLabel).toHaveBeenCalledWith({
      owner: context.repoOwner,
      repo: context.repoName,
      issue_number: issue.number,
      name: labelName,
    });
  });

  it('should handle errors and return error message', async () => {
    const errorMsg = 'API error!';
    context.octokit.rest.issues.removeLabel.mockRejectedValueOnce(new Error(errorMsg));

    const result = await unlabelIssue(
      context,
      issue,
      labelName,
      false // isDryRun
    );

    expect(result.ok).toBe(false);
    expect(result.message).toContain('Error removing label');
    expect(result.message).toContain(errorMsg);
  });
});