# AGENTS.md - revisium-actions

This repository contains shared GitHub Actions, reusable workflows, and release
automation helpers for Revisium repositories.

`CLAUDE.md` must stay a symlink to this file so all coding agents use the same
repo instructions.

## Repository scope

- `actions/*` contains composite actions used by caller repositories.
- `.github/workflows/*.yml` contains reusable workflows consumed with
  `uses: revisium/revisium-actions/.github/workflows/<name>.yml@<tag>`.
- `bin/*.mjs` contains command-line entry points used by actions and reusable
  workflows.
- `src/*` contains the shared implementation behind those entry points.
- `scripts/*` contains local validation helpers.
- `docs/*` and `examples/*` document supported usage patterns.

The package is private and intentionally keeps `package.json` at
`0.0.0-development`. This repository is versioned by Git tags such as
`v0.3.8`, not by package metadata.

## Working rules

- Keep reusable workflow changes backward compatible for existing tagged
  callers unless the change is explicitly a breaking release.
- Do not make release automation depend on `revisium-actions@master` or on an
  unpublished action from the same commit.
- Keep release-critical behavior deterministic and script-backed; avoid
  hand-written workflow shell logic when shared JavaScript helpers already
  exist.
- Do not edit `package-lock.json` manually. Generate lockfile changes through
  npm.
- Prefer exact tags, for example `@v0.3.8`, in examples that must be
  reproducible. Use the moving major alias, for example `@v0`, only when
  documenting the compatibility alias.

## Local commands

Use the scripts from `package.json`:

```bash
npm run lint
npm run format:check
npm test
npm run actionlint
npm run docs:check
npm run validate
```

`npm run validate` is the full local gate:

```bash
npm run lint && npm run format:check && npm test && npm run actionlint && npm run docs:check
```

## Caller release-train model

Caller repositories use `.github/workflows/release-train.yml` to calculate and
publish release commits, release branches, and tags.

Branch rules:

- `start-minor-*`, `start-major-*`, and `patch-*` actions that create a new
  release train run from `master`.
- `alpha-bump`, `promote-rc`, `rc-bump`, `stable`, and `patch` run from the
  matching `release/X.Y.x` branch.

Common transitions:

- `start-minor-alpha`: `2.3.4` -> `2.4.0-alpha.0`
- `start-major-alpha`: `2.3.4` -> `3.0.0-alpha.0`
- `start-minor-rc`: `2.3.4` -> `2.4.0-rc.0`
- `start-major-rc`: `2.3.4` -> `3.0.0-rc.0`
- `start-minor-stable`: `2.3.4` -> `2.4.0`
- `start-major-stable`: `2.3.4` -> `3.0.0`
- `alpha-bump`: `2.4.0-alpha.0` -> `2.4.0-alpha.1`
- `promote-rc`: `2.4.0-alpha.1` -> `2.4.0-rc.0`
- `rc-bump`: `2.4.0-rc.0` -> `2.4.0-rc.1`
- `stable`: `2.4.0-rc.1` -> `2.4.0`
- `patch`: `2.4.0` -> `2.4.1`
- `patch-alpha-start`: `2.4.0` -> `2.4.1-alpha.0`
- `patch-rc-start`: `2.4.0` -> `2.4.1-rc.0`

New caller repositories need one stable baseline tag before release trains can
start. Use `.github/workflows/bootstrap-stable.yml` once from the base branch
to validate the repository and create the initial `vX.Y.Z` tag.

## Release process for this repository

This repository releases itself with plain Git tags and GitHub Releases. Keep
the process small: validate, tag, create a GitHub Release, and move the major
alias.

Patch release checklist:

1. Confirm the change is merged to `master`.
2. Update local `master`.
3. Run `npm run validate`.
4. Find the next patch tag from the latest stable tag, for example
   `v0.3.7` -> `v0.3.8`.
5. Create an annotated exact tag:

```bash
git tag -a v0.3.8 -m "v0.3.8"
```

6. Move the major alias to the exact tag:

```bash
git tag -f v0 v0.3.8
```

7. Push the exact tag and the updated major alias:

```bash
git push origin v0.3.8
git push --force origin v0
```

8. Create the GitHub Release:

```bash
gh release create v0.3.8 \
  --repo revisium/revisium-actions \
  --title "Release v0.3.8" \
  --notes-file RELEASE_NOTES.md
```

The exact tag is immutable release history. The `v0` tag is a moving
compatibility alias for callers that intentionally track the latest compatible
`v0.x` release.

## GitHub Release notes

Use concise notes with:

- A `Changes in vX.Y.Z` heading.
- Short bullets for user-visible workflow/action changes.
- A link to the merged PR.
- Installation examples for the exact tag and, when relevant, the moving major
  alias.

Example:

```markdown
## Changes in v0.3.8

- Bumped `softprops/action-gh-release` to `v3.0.0` in the npm publish workflow.

Merged PR: https://github.com/revisium/revisium-actions/pull/13

### Installation

Use the exact release tag:

```yaml
uses: revisium/revisium-actions/<workflow-or-action-path>@v0.3.8
```

Or use the moving major alias:

```yaml
uses: revisium/revisium-actions/<workflow-or-action-path>@v0
```
```
