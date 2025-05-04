## Healthcheck scheduler

This GitHub Action scans `github/helphub-knowledge-base` for healthchecks that are coming due.

## To do

- Determine what action to take - for example, add an issue comment, create a new issue, or potentially even execute/post a complete GHEC healthcheck.

## Usage

Parameters:
- `max-staleness-days` - take action when the healthcheck is N days old
- `dir-path` - the directory file where healthchecks are stored in `github/helphub-knowledge-base`

name: "Do something when healthchecks are coming due for an enterprise."

```
on:
  schedule:
    - cron: '0 0 * * *' # Daily at midnight UTC

  workflow_dispatch: # Manual triggering

jobs:
  healthcheck:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Run Healthcheck Scheduler Action
        uses: carltonbrown/hc-scheduler@main
        with:
          max-staleness-days: "85"
          dir-path: "./premium/health-checks"
```
