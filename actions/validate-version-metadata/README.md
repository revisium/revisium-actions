# validate-version-metadata

Validates that `package.json`, `package-lock.json`, and optional JSON version
metadata files match the target release version.

```yaml
- uses: revisium/revisium-actions/actions/validate-version-metadata@v0
  with:
    target-version: ${{ env.TARGET_VERSION }}
    version-files: |
      src/api/rest-api/openapi.json
```
