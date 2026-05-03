# Release Bot Integration

Release-critical caller repositories should use the Revisium release GitHub App
instead of `GITHUB_TOKEN` when creating release commits, release branches, and
release tags.

## Required Repository Configuration

Install the release bot on each caller repository and configure:

| Name                      | Type             | Purpose                    |
| ------------------------- | ---------------- | -------------------------- |
| `RELEASE_BOT_CLIENT_ID`   | Actions variable | GitHub App client ID       |
| `RELEASE_BOT_PRIVATE_KEY` | Actions secret   | GitHub App private key PEM |

The GitHub App needs:

- `Contents: read and write`
- `Pull requests: read and write` only when opening stable-version-sync PRs

Repository rules must allow the app to:

- create `release/**` branches
- fast-forward existing `release/**` branches
- create `v*` tags
- create stable sync branches such as `chore/sync-stable-v1.2.3`

## Why Not `GITHUB_TOKEN`

Tags pushed with the repository `GITHUB_TOKEN` do not trigger ordinary downstream
workflows in the same way as tags pushed with a GitHub App installation token.
Caller repositories use tag pushes to start npm and Docker publication, so the
release tag must be pushed with the release bot token.

## Caller Workflow Pattern

```yaml
permissions:
  actions: read
  contents: read

jobs:
  release-train:
    uses: revisium/revisium-actions/.github/workflows/release-train.yml@v0.3.1
    with:
      action: ${{ inputs.action }}
      dry_run: false
    secrets:
      RELEASE_BOT_PRIVATE_KEY: ${{ secrets.RELEASE_BOT_PRIVATE_KEY }}
```

The reusable workflow creates a GitHub App installation token from
`RELEASE_BOT_CLIENT_ID` and `RELEASE_BOT_PRIVATE_KEY`. It uses the GitHub Git API
to create the release commit and verifies that GitHub marked the commit as
verified before creating the release branch and tag. Dry-run jobs can keep
`dry_run: true`; the GitHub App credentials are required only when publishing.
