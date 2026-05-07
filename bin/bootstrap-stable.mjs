#!/usr/bin/env node
import {
  formatBootstrapStableSummary,
  planBootstrapStable,
  publishBootstrapStable,
} from '../src/bootstrap-stable.js';
import { appendOutput, coerceBoolean, getCurrentBranch, git, lines } from '../src/cli-utils.js';
import { readJsonFile, requiredEnv } from '../src/version-metadata.js';

const packagePath = process.env.PACKAGE_PATH || 'package.json';
const targetVersion = requiredEnv('TARGET_VERSION');
const dryRun = coerceBoolean(process.env.DRY_RUN ?? true);
const plan = planBootstrapStable({
  baseBranch: process.env.BASE_BRANCH || 'master',
  currentBranch: getCurrentBranch(),
  currentVersion: readJsonFile(packagePath).version,
  tags: lines(git(['tag', '--list', 'v*'])),
  targetVersion,
});

console.log(formatBootstrapStableSummary(plan));

appendOutput('tag', plan.tag);
appendOutput('target_version', plan.targetVersion);

if (dryRun) {
  console.log('Dry run only. No tag or GitHub Release was created.');
  appendOutput('release_url', '');
  process.exit(0);
}

const result = await publishBootstrapStable({
  createGithubRelease: coerceBoolean(process.env.CREATE_GITHUB_RELEASE ?? true),
  releaseNotes: process.env.RELEASE_NOTES || '',
  releaseTitle: process.env.RELEASE_TITLE || '',
  repository: requiredEnv('GITHUB_REPOSITORY'),
  tag: plan.tag,
  targetSha: git(['rev-parse', 'HEAD']),
  targetVersion: plan.targetVersion,
  token: requiredEnv('GH_TOKEN'),
});

appendOutput('release_url', result.releaseUrl);
appendOutput('tag_object_sha', result.tagObjectSha);
appendOutput('tag_ref', result.tagRef);

console.log(`Created bootstrap stable tag ${result.tag}.`);
if (result.releaseUrl) {
  console.log('Created GitHub Release.');
}
