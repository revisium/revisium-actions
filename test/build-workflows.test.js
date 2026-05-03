import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));

const readme = fs.readFileSync(`${repoRoot}/README.md`, 'utf8');
const dockerBuild = fs.readFileSync(`${repoRoot}/.github/workflows/docker-build.yml`, 'utf8');
const nodeBuild = fs.readFileSync(`${repoRoot}/.github/workflows/node-build.yml`, 'utf8');
const deployWorkflow = fs.readFileSync(`${repoRoot}/.github/workflows/deploy.yml`, 'utf8');
const npmPublishWorkflow = fs.readFileSync(`${repoRoot}/.github/workflows/npm-publish.yml`, 'utf8');
const dockerExample = fs.readFileSync(`${repoRoot}/examples/workflows/docker-build.yml`, 'utf8');
const nodeExample = fs.readFileSync(`${repoRoot}/examples/workflows/node-build.yml`, 'utf8');
const deployExample = fs.readFileSync(`${repoRoot}/examples/workflows/deploy.yml`, 'utf8');
const npmPublishExample = fs.readFileSync(`${repoRoot}/examples/workflows/npm-publish.yml`, 'utf8');

test('README documents the shared build workflow helpers', () => {
  assert.match(readme, /\.github\/workflows\/docker-build\.yml/);
  assert.match(readme, /\.github\/workflows\/node-build\.yml/);
  assert.match(readme, /\.github\/workflows\/deploy\.yml/);
  assert.match(readme, /\.github\/workflows\/npm-publish\.yml/);
  assert.match(readme, /build workflows follow the same pattern/i);
  assert.match(readme, /docker-build\.yml@v0\.3\.1/);
  assert.match(readme, /node-build\.yml@v0\.3\.1/);
  assert.match(readme, /deploy\.yml@v0\.3\.1/);
  assert.match(readme, /npm-publish\.yml@v0\.3\.1/);
});

test('docker build reusable workflow exposes the service build shape', () => {
  assert.match(dockerBuild, /workflow_call/);
  assert.match(dockerBuild, /DOCKERHUB_USERNAME/);
  assert.match(dockerBuild, /docker\/metadata-action/);
  assert.match(dockerBuild, /type=raw,value=latest,enable=\$\{\{ inputs\.emit_latest_tag/);
  assert.match(dockerBuild, /file: \$\{\{ inputs\.dockerfile \}\}/);
  assert.match(dockerBuild, /context: \$\{\{ inputs\.context \}\}/);
});

test('node build reusable workflow exposes the package build shape', () => {
  assert.match(nodeBuild, /workflow_call/);
  assert.match(nodeBuild, /node_version/);
  assert.match(nodeBuild, /install_command/);
  assert.match(nodeBuild, /run_commands/);
  assert.match(nodeBuild, /actions\/setup-node/);
  assert.match(nodeBuild, /Running: \$command/);
});

test('deploy reusable workflow exposes the Kubernetes deployment shape', () => {
  assert.match(deployWorkflow, /workflow_call/);
  assert.match(deployWorkflow, /kube_namespace/);
  assert.match(deployWorkflow, /kube_service_name/);
  assert.match(deployWorkflow, /Create GitHub deployment/);
  assert.match(deployWorkflow, /Rollout restart deployment/);
  assert.match(deployWorkflow, /Set deployment status to success/);
});

test('npm publish reusable workflow exposes the publish shape', () => {
  assert.match(npmPublishWorkflow, /workflow_call/);
  assert.match(npmPublishWorkflow, /package_path/);
  assert.match(npmPublishWorkflow, /pre_publish_commands/);
  assert.match(npmPublishWorkflow, /Create GitHub Release/);
  assert.match(npmPublishWorkflow, /Determine npm tag/);
  assert.match(npmPublishWorkflow, /Publish to npm/);
});

test('examples point at the reusable build workflows', () => {
  assert.match(dockerExample, /docker-build\.yml@v0\.3\.1/);
  assert.match(dockerExample, /emit_latest_tag: true/);
  assert.match(nodeExample, /node-build\.yml@v0\.3\.1/);
  assert.match(nodeExample, /npm run build/);
  assert.match(deployExample, /deploy\.yml@v0\.3\.1/);
  assert.match(deployExample, /KUBE_CONFIG/);
  assert.match(npmPublishExample, /npm-publish\.yml@v0\.3\.1/);
  assert.match(npmPublishExample, /create_github_release: true/);
});
