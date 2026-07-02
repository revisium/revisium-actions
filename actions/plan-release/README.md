# plan-release

Computes a release train transition from local Git branches, tags, and package
metadata. This action only plans the transition. It does not create commits,
branches, tags, or releases.

By default, current versions come from `package.json`. Set
`version-source: tag` for repositories that use only release tags and
`release/X.Y.x` branches for version state.

```yaml
- uses: revisium/revisium-actions/actions/plan-release@v0.3.1
  id: release
  with:
    action: start-minor-alpha
    dry-run: true
    base-branch: master
    version-source: package

- run: echo "Would release ${{ steps.release.outputs.target_version }}"
```

Supported actions:

- `start-minor-alpha`
- `start-major-alpha`
- `start-minor-rc`
- `start-major-rc`
- `start-minor-stable`
- `start-major-stable`
- `alpha-bump`
- `promote-rc`
- `rc-bump`
- `stable`
- `patch`
- `patch-alpha-start`
- `patch-rc-start`
