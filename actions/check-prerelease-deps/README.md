# check-prerelease-deps

Fails stable release jobs when runtime dependencies point at prerelease semver
versions.

```yaml
- uses: revisium/revisium-actions/actions/check-prerelease-deps@v0
  with:
    target-version: ${{ steps.release.outputs.target_version }}
```

By default, the action checks `package.json`. It intentionally ignores
`devDependencies`. When `target-version` is an alpha or rc prerelease, the check
is skipped.
