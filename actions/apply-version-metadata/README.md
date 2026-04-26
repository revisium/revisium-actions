# apply-version-metadata

Updates `package.json`, `package-lock.json`, and optional JSON version metadata
files to the target release version.

```yaml
- uses: revisium/revisium-actions/actions/apply-version-metadata@v0
  with:
    target-version: ${{ steps.release.outputs.target_version }}
    version-files: |
      src/api/rest-api/openapi.json
```
