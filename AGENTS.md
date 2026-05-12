# AGENTS.md - revisium-actions

This repository contains shared GitHub Actions, reusable workflows, and release
automation helpers for Revisium repositories.

`CLAUDE.md` must stay a symlink to this file so all coding agents use the same
repo instructions.

## Canonical documentation

- Use [README.md](README.md) for the public repository overview, supported
  helpers, reusable workflow examples, and validation summary.
- Use [docs/releasing.md](docs/releasing.md) as the canonical release
  documentation for versioning policy, caller release trains, manual releases,
  major aliases, and dogfooding rules.
- Do not duplicate release tables or command checklists here. Link to the
  canonical docs instead.

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

## Agent working rules

- Keep reusable workflow changes backward compatible for existing tagged
  callers unless the change is explicitly a breaking release.
- Do not make release automation depend on `revisium-actions@master` or on an
  unpublished action from the same commit.
- Keep release-critical behavior deterministic and script-backed; avoid
  hand-written workflow shell logic when shared JavaScript helpers already
  exist.
- Do not edit `package-lock.json` manually. Generate lockfile changes through
  npm.
- Prefer exact tags, for example `@v0.3.8`, in reproducible examples. Use the
  moving major alias, for example `@v0`, only when documenting the compatibility
  alias.
- For release work in this repository, follow `docs/releasing.md`: validate,
  tag, create a GitHub Release, and move the major alias only after the exact
  tag is pushed.

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

`npm run validate` is the full local gate and should pass before release tags
are pushed.
