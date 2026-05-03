import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const workflow = fs.readFileSync('.github/workflows/release-train.yml', 'utf8');
const dryRunExample = fs.readFileSync('examples/workflows/release-train-dry-run.yml', 'utf8');

test('release train resolves helper checkout from referenced workflow metadata', () => {
  assert.match(workflow, /\n {2}actions: read\n/);
  assert.match(workflow, /referenced_workflows/);
  assert.match(workflow, /ref: \$\{\{ steps\.helper-ref\.outputs\.sha \}\}/);
  assert.doesNotMatch(workflow, /ref: \$\{\{ github\.workflow_sha \}\}/);
  assert.doesNotMatch(workflow, /ref: v0\.3\.1/);
});

test('release train dry-run example cannot dispatch write mode', () => {
  assert.match(dryRunExample, /dry_run: true/);
  assert.doesNotMatch(dryRunExample, /dry_run: \$\{\{ inputs\.dry_run \}\}/);
  assert.doesNotMatch(dryRunExample, /description: Validate and show the computed release/);
});
