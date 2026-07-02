# apply-version-metadata

Updates `package.json`, `package-lock.json`, and optional JSON version metadata
files to the target release version.

Set `version-source: tag` to make package metadata optional. In that mode,
repositories without `package.json` update only `version-files`.

```yaml
- uses: revisium/revisium-actions/actions/apply-version-metadata@v0
  with:
    target-version: ${{ steps.release.outputs.target_version }}
    version-source: package
    version-files: |
      src/api/rest-api/openapi.json
```
