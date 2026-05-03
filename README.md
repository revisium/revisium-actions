<div align="center">

# revisium-actions

Shared GitHub Actions, reusable workflows, and release automation helpers for
Revisium repositories.

[![License](https://img.shields.io/github/license/revisium/revisium-actions?color=blue)](LICENSE)
[![CI](https://github.com/revisium/revisium-actions/actions/workflows/ci.yml/badge.svg)](https://github.com/revisium/revisium-actions/actions/workflows/ci.yml)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=revisium_revisium-actions&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=revisium_revisium-actions)
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=revisium_revisium-actions&metric=coverage)](https://sonarcloud.io/summary/new_code?id=revisium_revisium-actions)

</div>

## Current Scope

This repository is being built in small migrations. The first supported helpers
cover release metadata that is currently duplicated across service repositories:

| Helper                              | Purpose                                                                      |
| ----------------------------------- | ---------------------------------------------------------------------------- |
| `actions/apply-version-metadata`    | Update `package.json`, `package-lock.json`, and optional JSON version files. |
| `actions/validate-version-metadata` | Validate package and optional JSON version files against a target version.   |
| `actions/check-prerelease-deps`     | Reject prerelease runtime dependencies before stable publication.            |
| `actions/plan-release`              | Compute release-train branch, version, tag, and channel transitions.         |

The release train reusable workflow supports dry runs and real branch/tag
publishing through the release GitHub App:

```yaml
jobs:
  release-train:
    uses: revisium/revisium-actions/.github/workflows/release-train.yml@v0.3.0
    with:
      action: ${{ inputs.action }}
      dry_run: true
      node_version: 24.11.1
    secrets: inherit
```

The workflow checks out its helper scripts from the same pinned
`revisium-actions` ref used by `uses`, so caller repositories do not need to pass
a second helper ref. Set `dry_run: false` and configure
`RELEASE_BOT_CLIENT_ID` / `RELEASE_BOT_PRIVATE_KEY` to publish a GitHub-verified
release commit, release branch, and tag.

## Example

```yaml
- uses: revisium/revisium-actions/actions/plan-release@v0.3.0
  id: release
  with:
    action: start-minor-alpha
    dry-run: true

- uses: revisium/revisium-actions/actions/apply-version-metadata@v0
  with:
    target-version: ${{ steps.release.outputs.target_version }}
    version-files: |
      src/api/rest-api/openapi.json

- uses: revisium/revisium-actions/actions/validate-version-metadata@v0
  with:
    target-version: ${{ steps.release.outputs.target_version }}
    version-files: |
      src/api/rest-api/openapi.json

- uses: revisium/revisium-actions/actions/check-prerelease-deps@v0
  with:
    target-version: ${{ steps.release.outputs.target_version }}
```

## Validation

```bash
npm ci
npm run validate
```

`npm run validate` runs ESLint, Prettier, Node tests, action metadata docs
checks, and actionlint when an `actionlint` binary is installed locally. CI runs
the real actionlint check in a separate job.

## Documentation

- [Release instructions](docs/releasing.md)
- [Release bot integration](docs/release-bot.md)
- [Dry-run release train example](examples/workflows/release-train-dry-run.yml)
- [Release metadata example workflow](examples/workflows/release-metadata.yml)
