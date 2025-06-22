## Healthcheck scheduler

This GitHub Action is intended to send notifications when healthchecks are almost due.

## How it works

* Scans a directory of healthcheck files in the subdir `dir-path` in `issues-project-repo` to determine which are older than max-staleness-days
* Retrieves open & active issues from the relevant project board and adds comments to issues that correspond to overdue healthchecks
* Uses @handle tagging for the assignees
* Honors a skip-label-name that will skip issues for N days (after which time the label will be removed)

## Usage

Parameters:
- `max-staleness-days` - take action when the healthcheck is N days old
- `dir-path` - the directory file where healthchecks are stored in `github/helphub-knowledge-base`



## Example

```
name: "Do something when healthchecks are coming due for an enterprise."

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
        uses: carltonbrown/hc-scheduler@v99.99
        with:
          max-staleness-days: "85"
          dir-path:                 # the subdirectory of the repo containing the healthchecks
          issues-project-org:       # name of the org owning the project board, repo, and healthcheck repo
          issues-project-repo:      # name of the repo containing the issues
          issues-project-number:    # number of the project board
          notifiable-issue-status:  # "Active" or suitable status
          notifiable-issue-state:   # "OPEN" or suitable state
          max-staleness-days: "60"  # notifiable age of healthchecks
          skip-label-name:          # name of the skip label
          hc-data-repo:             # name of the repo containing healthcheck files
          dir-path:                 # relative path of subdir containing the healthcheck files
          dry-run:                  # if true, only echo debug messages, do not update any issues.
```
