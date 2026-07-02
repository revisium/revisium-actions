#!/usr/bin/env node
import { coerceBoolean, getCurrentBranch, git, lines, writeOutputs } from '../src/cli-utils.js';
import { readJsonFile, requiredEnv } from '../src/version-metadata.js';
import {
  computeReleasePlan,
  formatVersion,
  inferLatestReleaseBranchVersion,
  formatReleasePlanSummary,
  normalizeBranchRef,
  parseVersion,
} from '../src/release-train.js';

const versionSources = new Set(['package', 'tag']);

function normalizeVersionSource(source = 'package') {
  if (!versionSources.has(source)) {
    throw new Error(`VERSION_SOURCE must be package or tag, got ${source}`);
  }
  return source;
}

function sanitizeVersion(version) {
  return formatVersion(parseVersion(version));
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

function readPackageVersion(packagePath) {
  return sanitizeVersion(readJsonFile(packagePath).version);
}

function readPackageVersionAtRef(ref, packagePath) {
  const packageJson = git(['show', `${ref}:${packagePath}`]);
  return sanitizeVersion(JSON.parse(packageJson).version);
}

function getReachableTags(ref) {
  return lines(git(['tag', '--merged', ref, '--list', 'v*'], { allowFailure: true }));
}

function getPackageReleaseBranchVersions(refs, packagePath) {
  const versions = {};

  for (const ref of refs) {
    const branch = normalizeBranchRef(ref);
    if (versions[branch]) continue;

    versions[branch] = readPackageVersionAtRef(ref, packagePath);
  }

  return versions;
}

function getTagReleaseBranchVersions(refs) {
  const versions = {};

  for (const ref of refs) {
    const branch = normalizeBranchRef(ref);
    if (versions[branch]) continue;

    const version = inferLatestReleaseBranchVersion({
      branch,
      tags: getReachableTags(ref),
    });
    if (!version) {
      throw new Error(`Cannot infer current version for ${branch} from reachable release tags`);
    }

    versions[branch] = version;
  }

  return versions;
}

function resolveCurrentVersion({ action, currentBranch, packagePath, versionSource }) {
  if (versionSource === 'package') {
    return readPackageVersion(packagePath);
  }

  if (action.startsWith('start-')) {
    return '';
  }

  const version = inferLatestReleaseBranchVersion({
    branch: currentBranch,
    tags: getReachableTags('HEAD'),
  });
  if (!version) {
    throw new Error(
      `Cannot infer current version for ${currentBranch} from reachable release tags`,
    );
  }

  return version;
}

function getReleaseBranchVersions({ refs, packagePath, versionSource }) {
  return versionSource === 'package'
    ? getPackageReleaseBranchVersions(refs, packagePath)
    : getTagReleaseBranchVersions(refs);
}

const action = requiredEnv('RELEASE_ACTION');
const packagePath = process.env.PACKAGE_PATH || 'package.json';
const versionSource = normalizeVersionSource(process.env.VERSION_SOURCE);
const releaseRefs = getReleaseRefs();
const currentBranch = getCurrentBranch();
const currentVersion = resolveCurrentVersion({
  action,
  currentBranch,
  packagePath,
  versionSource,
});
const plan = computeReleasePlan({
  action,
  baseBranch: process.env.BASE_BRANCH || 'master',
  currentBranch,
  currentVersion,
  dryRun: coerceBoolean(process.env.DRY_RUN ?? true),
  releaseBranches: releaseRefs,
  releaseBranchVersions: getReleaseBranchVersions({
    refs: releaseRefs,
    packagePath,
    versionSource,
  }),
  sourceTags:
    versionSource === 'tag' && !action.startsWith('start-') ? getReachableTags('HEAD') : null,
  tags: lines(git(['tag', '--list', 'v*'])),
});

console.log(formatReleasePlanSummary(plan));

writeOutputs({
  action: plan.action,
  base_branch: plan.baseBranch,
  channel: plan.channel,
  current_branch: plan.currentBranch,
  current_version: plan.currentVersion || '',
  dry_run: String(plan.dryRun),
  is_prerelease: String(plan.isPrerelease),
  last_stable_tag: plan.lastStableTag,
  ref_mode: plan.refMode,
  should_release: String(plan.shouldRelease),
  tag: plan.tag,
  target_branch: plan.targetBranch,
  target_version: plan.targetVersion,
});
