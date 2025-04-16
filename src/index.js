const core = require('@actions/core');

async function run() {
  try {
    // Get the input value for max-staleness
    const maxStaleness = core.getInput('max-staleness');

    // Log the message
    console.log(`I received a max-staleness value of ${maxStaleness}`);
  } catch (error) {
    // Fail the action if an error occurs
    core.setFailed(`Action failed with error: ${error.message}`);
  }
}

run();
