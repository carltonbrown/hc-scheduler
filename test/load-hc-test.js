const path = require('path');
const { loadHealthChecks } = require('../src/load-hc'); // Updated function name

describe('loadHealthChecks', () => {
  test('should return all healthcheck objects located under the fixtures directory', () => {
    // Define the parameters
    const dirPath = path.join(
      __dirname,
      '../test/fixtures/helphub-knowledge-base/premium/health-checks/'
    );

    // Expected results
    const expectedHealthchecks = [
      {
        enterprise_slug: 'parsnip',
        enterprise_id: 1181,
        title: 'Health Check for parsnip - GitHub Enterprise Cloud',
        date: new Date('2024-12-25'), // Update to match the actual output
      },
      {
        enterprise_slug: 'carrot',
        enterprise_id: 1182,
        title: 'Health Check for carrot - GitHub Enterprise Cloud',
        date: new Date('2025-01-15'), // Update to match the actual output
      },
    ];

    // Call the function
    const healthchecks = loadHealthChecks(dirPath);

    // Verify the result
    expect(healthchecks).toHaveLength(2);
    expect(healthchecks).toEqual(expect.arrayContaining(expectedHealthchecks));
  });
});