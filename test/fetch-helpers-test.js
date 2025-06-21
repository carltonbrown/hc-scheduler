const { cloneRepo, mapCheckableIssues, fetchIssuesFromV2Project, getIssueLabeledDate } = require('../src/fetch-helpers');
const child_process = require('child_process');

jest.mock('child_process');

describe('cloneRepo', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('throws an error if token is not provided', () => {
    expect(() => cloneRepo('', 'owner/repo', '/tmp/target')).toThrow('Cannot clone; no token is not set');
  });

  it('calls execSync with the correct git clone command', () => {
    cloneRepo('mytoken', 'grubhub/super-support', '/tmp/target');
    expect(child_process.execSync).toHaveBeenCalledWith(
      'git clone https://mytoken@github.com/grubhub/super-support.git /tmp/target',
      { stdio: 'inherit' }
    );
  });
});

describe('mapCheckableIssues', () => {
  it('maps issues and sets skip_healthcheck_notification correctly', () => {
    const issues = [
      {
        number: 1,
        title: 'Issue 1',
        assignees: ['alice'],
        labels: ['skip', 'foo'],
        url: 'http://example.com/1'
      },
      {
        number: 2,
        title: 'Issue 2',
        assignees: [],
        labels: ['bar'],
        url: 'http://example.com/2'
      }
    ];
    const skipLabel = 'skip';
    const result = mapCheckableIssues(issues, skipLabel);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      number: 1,
      skip_healthcheck_notification: true
    });
    expect(result[1]).toMatchObject({
      number: 2,
      skip_healthcheck_notification: false
    });
  });
});

describe('fetchIssuesFromV2Project', () => {
  it('fetches and maps issues from the GraphQL API', async () => {
    const octokit = {
      graphql: jest.fn().mockResolvedValue({
        organization: {
          projectV2: {
            items: {
              nodes: [
                {
                  id: 'item1',
                  content: {
                    title: 'Issue 1',
                    number: 1,
                    url: 'http://example.com/1',
                    state: 'OPEN',
                    assignees: { nodes: [{ login: 'alice' }] },
                    labels: { nodes: [{ name: 'foo' }] }
                  },
                  fieldValues: {
                    nodes: [
                      {
                        field: { name: 'Status' },
                        name: 'Active'
                      }
                    ]
                  }
                }
              ],
              pageInfo: {
                hasNextPage: false,
                endCursor: null
              }
            }
          }
        }
      })
    };

    const issues = await fetchIssuesFromV2Project(octokit, 'grubhub', 1, 'Active', 'OPEN');
    expect(octokit.graphql).toHaveBeenCalled();
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      title: 'Issue 1',
      number: 1,
      url: 'http://example.com/1',
      assignees: ['alice'],
      labels: ['foo'],
      status: 'Active'
    });
  });

  it('returns an empty array if no issues match', async () => {
    const octokit = {
      graphql: jest.fn().mockResolvedValue({
        organization: {
          projectV2: {
            items: {
              nodes: [],
              pageInfo: {
                hasNextPage: false,
                endCursor: null
              }
            }
          }
        }
      })
    };

    const issues = await fetchIssuesFromV2Project(octokit, 'grubhub', 1, 'Active', 'OPEN');
    expect(issues).toEqual([]);
  });
});

describe('getIssueLabeledDate', () => {
  it('returns the date when the label was added', async () => {
    const octokit = {
      rest: {
        issues: {
          listEventsForTimeline: jest.fn()
            .mockResolvedValueOnce({
              data: [
                {
                  event: 'labeled',
                  label: { name: 'foo' },
                  created_at: '2024-01-01T00:00:00Z'
                },
                {
                  event: 'labeled',
                  label: { name: 'bar' },
                  created_at: '2024-02-01T00:00:00Z'
                }
              ]
            })
        }
      }
    };

    const date = await getIssueLabeledDate(octokit, 'grubhub', 'super-support', 1, 'foo');
    expect(date).toEqual(new Date('2024-01-01T00:00:00Z'));
  });

  it('returns undefined if the label is never found', async () => {
    const octokit = {
      rest: {
        issues: {
          listEventsForTimeline: jest.fn()
            .mockResolvedValueOnce({
              data: [
                {
                  event: 'labeled',
                  label: { name: 'not-this' },
                  created_at: '2024-01-01T00:00:00Z'
                }
              ]
            })
        }
      }
    };

    const date = await getIssueLabeledDate(octokit, 'grubhub', 'super-support', 1, 'foo');
    expect(date).toBeUndefined();
  });

  it('handles pagination', async () => {
    const octokit = {
      rest: {
        issues: {
          listEventsForTimeline: jest
            .fn()
            .mockResolvedValueOnce({
              data: new Array(100).fill({
                event: 'labeled',
                label: { name: 'foo' },
                created_at: '2024-01-01T00:00:00Z'
              })
            })
            .mockResolvedValueOnce({
              data: [
                {
                  event: 'labeled',
                  label: { name: 'foo' },
                  created_at: '2024-02-01T00:00:00Z'
                }
              ]
            })
        }
      }
    };

    const date = await getIssueLabeledDate(octokit, 'grubhub', 'super-support', 1, 'foo');
    // Should return the last occurrence (from the last page)
    expect(date).toEqual(new Date('2024-02-01T00:00:00Z'));
    expect(octokit.rest.issues.listEventsForTimeline).toHaveBeenCalledTimes(2);
  });
});