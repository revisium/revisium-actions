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

test('release train declares package_manager input with default npm', () => {
  assert.match(workflow, /package_manager:/);
  assert.match(workflow, /default: npm/);
});

test('release train declares version_source input with backward-compatible package default', () => {
  assert.match(workflow, /version_source:/);
  assert.match(workflow, /default: package/);
});

test('release train has conditional pnpm setup step', () => {
  assert.match(workflow, /pnpm\/action-setup/);
  assert.match(workflow, /inputs\.package_manager == 'pnpm'/);
});

test('release train passes package_manager to node cache', () => {
  assert.match(workflow, /Setup Node\.js with package cache/);
  assert.match(workflow, /inputs\.package_manager != 'none'/);
  assert.match(workflow, /cache: \$\{\{ inputs\.package_manager \}\}/);
});

test('release train supports package_manager none without setup-node cache', () => {
  assert.match(workflow, /Setup Node\.js without package cache/);
  assert.match(workflow, /inputs\.package_manager == 'none'/);
  assert.match(
    workflow,
    /inputs\.install_command != '' && \(inputs\.package_manager != 'none' \|\| inputs\.install_command != 'npm ci'\)/,
  );
});

test('release train passes version source through release helper steps', () => {
  assert.match(workflow, /VERSION_SOURCE: \$\{\{ inputs\.version_source \}\}/);
});

test('release train fetches refs with github token and publishes with app token', () => {
  assert.match(workflow, /owner: \$\{\{ github\.repository_owner \}\}/);
  assert.match(workflow, /repositories: \$\{\{ github\.event\.repository\.name \}\}/);
  assert.match(workflow, /FETCH_TOKEN: \$\{\{ github\.token \}\}/);
  assert.doesNotMatch(workflow, /FETCH_TOKEN: \$\{\{ inputs\.dry_run == false && steps\.app-token/);
  assert.match(workflow, /GH_TOKEN: \$\{\{ steps\.app-token\.outputs\.token \}\}/);
});
