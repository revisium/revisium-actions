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
- name: Create release app token
  id: app-token
  uses: actions/create-github-app-token@v3
  with:
    client-id: ${{ vars.RELEASE_BOT_CLIENT_ID }}
    private-key: ${{ secrets.RELEASE_BOT_PRIVATE_KEY }}
    permission-contents: write

- uses: revisium/revisium-actions/actions/create-verified-release-commit@v1.0.0
  env:
    GH_TOKEN: ${{ steps.app-token.outputs.token }}
```

The verified commit and tag helper actions will be added after the metadata
helpers are migrated and tested.
