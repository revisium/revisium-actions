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

## Example

```yaml
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
- [Release metadata example workflow](examples/workflows/release-metadata.yml)
