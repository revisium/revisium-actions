# plan-release

Computes a release train transition from local Git branches, tags, and package
metadata. This action only plans the transition. It does not create commits,
branches, tags, or releases.

```yaml
- uses: revisium/revisium-actions/actions/plan-release@v0.3.0
  id: release
  with:
    action: start-minor-alpha
    dry-run: true
    base-branch: master

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
