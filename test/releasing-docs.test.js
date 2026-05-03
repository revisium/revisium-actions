import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const readme = fs.readFileSync('README.md', 'utf8');
const releasing = fs.readFileSync('docs/releasing.md', 'utf8');

test('README documents the release workflow architecture', () => {
  assert.match(readme, /## Release Workflow Architecture/);
  assert.match(
    readme,
    /```mermaid[\s\S]*flowchart LR[\s\S]*dry_run\?[\s\S]*Revisium release GitHub App/,
  );
  assert.match(readme, /helper SHA from GitHub's workflow-run metadata/);
});

test('release instructions document the same workflow architecture', () => {
  assert.match(releasing, /## Release Workflow Architecture/);
  assert.match(
    releasing,
    /```mermaid[\s\S]*flowchart LR[\s\S]*dry_run\?[\s\S]*Revisium release GitHub App/,
  );
  assert.match(releasing, /verified release refs in write mode/);
});
