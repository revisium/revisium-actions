#!/usr/bin/env node
import { appendFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

import {
  publishRelease,
  releaseCommitFiles,
  releaseCommitSummary,
} from '../src/release-publish.js';
import { hasPackageMetadata, requiredEnv } from '../src/version-metadata.js';

const gitBinary = '/usr/bin/git';

function git(args) {
  return execFileSync(gitBinary, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function appendOutput(name, value) {
  if (!process.env.GITHUB_OUTPUT) return;
  appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
}

const packagePath = process.env.PACKAGE_PATH || 'package.json';
const versionSource = process.env.VERSION_SOURCE || 'package';

if (!['package', 'tag'].includes(versionSource)) {
  throw new Error(`VERSION_SOURCE must be package or tag, got ${versionSource}`);
}

const includePackageMetadata =
  versionSource === 'package' || hasPackageMetadata(process.cwd(), packagePath);
const files = releaseCommitFiles(process.env.VERSION_FILES || '', process.cwd(), {
  includePackageMetadata,
  packagePath,
});
const refMode = requiredEnv('REF_MODE');
const targetBranch = requiredEnv('TARGET_BRANCH');
const targetVersion = requiredEnv('TARGET_VERSION');
const result = await publishRelease({
  baseSha: git(['rev-parse', 'HEAD']),
  files,
  refMode,
  repository: requiredEnv('GITHUB_REPOSITORY'),
  tag: requiredEnv('TAG'),
  targetBranch,
  targetVersion,
  token: requiredEnv('GH_TOKEN'),
});

appendOutput('branch_ref', result.branchRef);
appendOutput('commit_sha', result.commitSha);
appendOutput('tag_ref', result.tagRef);
appendOutput('verification_reason', result.verificationReason);

if (files.length > 0) {
  console.log('Created verified GitHub App release commit.');
} else {
  console.log('No release metadata files changed; publishing refs at checked-out HEAD.');
}
console.log('Created release branch and tag refs.');
console.log(`Verification reason: ${result.verificationReason || '(none)'}`);
console.log(releaseCommitSummary({ files, refMode, targetBranch, targetVersion }));
