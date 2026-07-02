# validate-version-metadata

Validates that `package.json`, `package-lock.json`, and optional JSON version
metadata files match the target release version.

Set `version-source: tag` to make package metadata optional. In that mode,
repositories without `package.json` validate only `version-files`.

```yaml
- uses: revisium/revisium-actions/actions/validate-version-metadata@v0
  with:
    target-version: ${{ env.TARGET_VERSION }}
    version-source: package
    version-files: |
      src/api/rest-api/openapi.json
```
