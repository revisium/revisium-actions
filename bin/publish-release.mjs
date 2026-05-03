#!/usr/bin/env node
import { appendFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

import {
  publishRelease,
  releaseCommitFiles,
  releaseCommitSummary,
} from '../src/release-publish.js';
import { requiredEnv } from '../src/version-metadata.js';

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

const files = releaseCommitFiles(process.env.VERSION_FILES || '');
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

console.log('Created verified GitHub App release commit.');
console.log('Created release branch and tag refs.');
console.log(`Verification reason: ${result.verificationReason || 'unknown'}`);
console.log(releaseCommitSummary({ files, refMode, targetBranch, targetVersion }));
