import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const readme = fs.readFileSync('README.md', 'utf8');
const releasing = fs.readFileSync('docs/releasing.md', 'utf8');

test('README documents the release workflow architecture', () => {
  assert.match(readme, /## Release Workflow State Diagram/);
  assert.match(
    readme,
    /```mermaid[\s\S]*stateDiagram-v2[\s\S]*start-minor-alpha[\s\S]*rc-bump[\s\S]*stable/,
  );
  assert.match(readme, /helper SHA from GitHub's workflow-run metadata/);
  assert.match(readme, /### Branch Model/);
  assert.match(readme, /### Action Options/);
  assert.match(readme, /Runs from/);
  assert.match(readme, /2\.4\.0-alpha\.1/);
});

test('release instructions document the same workflow architecture', () => {
  assert.match(releasing, /## Release Workflow State Diagram/);
  assert.match(
    releasing,
    /```mermaid[\s\S]*stateDiagram-v2[\s\S]*start-minor-alpha[\s\S]*rc-bump[\s\S]*stable/,
  );
  assert.match(releasing, /verified release refs in write mode/);
  assert.match(releasing, /### Branch Model/);
  assert.match(releasing, /Runs from/);
  assert.match(releasing, /3\.0\.0-rc\.0/);
});
