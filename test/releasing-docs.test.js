import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const readme = fs.readFileSync(`${repoRoot}/README.md`, 'utf8');
const releasing = fs.readFileSync(`${repoRoot}/docs/releasing.md`, 'utf8');

function getMermaidBlock(doc) {
  const match = doc.match(/```mermaid\s*([\s\S]*?)```/);
  assert.ok(match, 'Missing Mermaid diagram block');
  return match[1];
}

test('README documents the release workflow architecture', () => {
  assert.match(readme, /## Release Workflow State Diagram/);
  const diagram = getMermaidBlock(readme);
  assert.match(diagram, /stateDiagram-v2/);
  assert.match(diagram, /Stable --> AlphaTrain: start-minor-alpha/);
  assert.match(diagram, /RCTrain --> RCTrain: rc-bump/);
  assert.match(diagram, /RCTrain --> Stable: stable/);
  assert.match(readme, /helper SHA from GitHub's workflow-run metadata/);
  assert.match(readme, /### Branch Model/);
  assert.match(readme, /### Action Options/);
  assert.match(readme, /Runs from/);
  assert.match(readme, /2\.4\.0-alpha\.1/);
});

test('release instructions document the same workflow architecture', () => {
  assert.match(releasing, /## Release Workflow State Diagram/);
  const diagram = getMermaidBlock(releasing);
  assert.match(diagram, /stateDiagram-v2/);
  assert.match(diagram, /Stable --> AlphaTrain: start-minor-alpha/);
  assert.match(diagram, /RCTrain --> RCTrain: rc-bump/);
  assert.match(diagram, /RCTrain --> Stable: stable/);
  assert.match(releasing, /verified release refs in write mode/);
  assert.match(releasing, /### Branch Model/);
  assert.match(releasing, /Runs from/);
  assert.match(releasing, /3\.0\.0-rc\.0/);
});
