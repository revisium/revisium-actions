#!/usr/bin/env node
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

import { readJsonFile, requiredEnv } from '../src/version-metadata.js';
import {
  computeReleasePlan,
  formatReleasePlanSummary,
  normalizeBranchRef,
} from '../src/release-train.js';

const gitBinary = '/usr/bin/git';

function git(args, options = {}) {
  try {
    return execFileSync(gitBinary, args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', options.allowFailure ? 'ignore' : 'pipe'],
    }).trim();
  } catch (error) {
    if (options.allowFailure) return '';
    throw error;
  }
}

function lines(value) {
  return String(value)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function coerceBoolean(value) {
  return value === true || String(value).toLowerCase() === 'true';
}

function getCurrentBranch() {
  return (
    process.env.CURRENT_BRANCH ||
    process.env.GITHUB_REF_NAME ||
    git(['branch', '--show-current'], { allowFailure: true })
  );
}

function getReleaseRefs() {
  return lines(
    git(
      [
        'for-each-ref',
        '--format=%(refname:short)',
        'refs/heads/release/*',
        'refs/remotes/origin/release/*',
      ],
      { allowFailure: true },
    ),
  );
}

function getReleaseBranchVersions(refs) {
  const versions = {};

  for (const ref of refs) {
    const branch = normalizeBranchRef(ref);
    if (versions[branch]) continue;

    const packageJson = git(['show', `${ref}:${process.env.PACKAGE_PATH || 'package.json'}`]);
    versions[branch] = JSON.parse(packageJson).version;
  }

  return versions;
}

function writeOutputs(outputs) {
  if (!process.env.GITHUB_OUTPUT) return;

  const linesToWrite = Object.entries(outputs).map(([key, value]) => `${key}=${value}`);
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `${linesToWrite.join('\n')}\n`);
}

const action = requiredEnv('RELEASE_ACTION');
const packagePath = process.env.PACKAGE_PATH || 'package.json';
const releaseRefs = getReleaseRefs();
const currentVersion = readJsonFile(packagePath).version;
const plan = computeReleasePlan({
  action,
  baseBranch: process.env.BASE_BRANCH || 'master',
  currentBranch: getCurrentBranch(),
  currentVersion,
  dryRun: coerceBoolean(process.env.DRY_RUN ?? true),
  releaseBranches: releaseRefs,
  releaseBranchVersions: getReleaseBranchVersions(releaseRefs),
  tags: lines(git(['tag', '--list', 'v*'])),
});

console.log(formatReleasePlanSummary(plan));

writeOutputs({
  action: plan.action,
  base_branch: plan.baseBranch,
  channel: plan.channel,
  current_branch: plan.currentBranch,
  current_version: plan.currentVersion,
  dry_run: String(plan.dryRun),
  is_prerelease: String(plan.isPrerelease),
  last_stable_tag: plan.lastStableTag,
  ref_mode: plan.refMode,
  should_release: String(plan.shouldRelease),
  tag: plan.tag,
  target_branch: plan.targetBranch,
  target_version: plan.targetVersion,
});
