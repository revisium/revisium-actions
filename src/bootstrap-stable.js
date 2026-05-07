import { GitHubError, githubRequest, assertSafeGitRef } from './release-publish.js';
import { normalizeBranchRef, normalizeTagRef, parseVersion } from './release-train.js';

export function assertStableVersion(version) {
  const parsed = parseVersion(version);
  if (parsed.prerelease) {
    throw new Error(`bootstrap-stable requires a stable X.Y.Z version, got ${version}`);
  }

  return parsed;
}

export function planBootstrapStable({
  baseBranch = 'master',
  currentBranch,
  currentVersion,
  tags = [],
  targetVersion,
}) {
  const normalizedBaseBranch = normalizeBranchRef(baseBranch);
  const normalizedCurrentBranch = normalizeBranchRef(currentBranch);

  if (normalizedCurrentBranch !== normalizedBaseBranch) {
    throw new Error(
      `bootstrap-stable must run from ${normalizedBaseBranch}. Current branch: ${normalizedCurrentBranch}`,
    );
  }

  assertStableVersion(targetVersion);

  if (currentVersion !== targetVersion) {
    throw new Error(
      `package.json version ${currentVersion} must match bootstrap-stable target ${targetVersion}`,
    );
  }

  const existingReleaseTags = tags.map(normalizeTagRef).filter((tag) => tag.startsWith('v'));
  if (existingReleaseTags.length > 0) {
    throw new Error(
      `bootstrap-stable can only run before any v* tags exist. Existing tags:\n${existingReleaseTags
        .map((tag) => `- ${tag}`)
        .join('\n')}`,
    );
  }

  const tag = `v${targetVersion}`;
  assertSafeGitRef(tag);

  return {
    baseBranch: normalizedBaseBranch,
    currentBranch: normalizedCurrentBranch,
    currentVersion,
    tag,
    targetVersion,
  };
}

export function formatBootstrapStableSummary(plan) {
  return [
    'Bootstrap stable plan',
    `Base branch: ${plan.baseBranch}`,
    `Current branch: ${plan.currentBranch}`,
    `Current version: ${plan.currentVersion}`,
    `Target version: ${plan.targetVersion}`,
    `Tag: ${plan.tag}`,
  ].join('\n');
}

function assertBootstrapPublishTag({ tag, targetVersion }) {
  assertStableVersion(targetVersion);
  const expectedTag = `v${targetVersion}`;
  if (tag !== expectedTag) {
    throw new Error(`tag ${tag} must match targetVersion ${targetVersion} (${expectedTag})`);
  }

  assertSafeGitRef(tag);
}

function appendRollbackFailure(error, rollbackError) {
  if (!(error instanceof Error)) {
    return;
  }

  const rollbackMessage =
    rollbackError instanceof Error ? rollbackError.message : String(rollbackError);
  error.message = `${error.message} (rollback failed: ${rollbackMessage})`;
}

async function rollbackTagRef({ error, github, tag }) {
  try {
    await github('DELETE', `/git/refs/tags/${tag}`);
  } catch (rollbackError) {
    appendRollbackFailure(error, rollbackError);
  }
}

async function createBootstrapGithubRelease({
  github,
  releaseNotes,
  releaseTitle,
  tag,
  targetVersion,
}) {
  try {
    const release = await github('POST', '/releases', {
      tag_name: tag,
      name: releaseTitle || tag,
      body:
        releaseNotes || `Initial stable baseline ${targetVersion} for release train automation.`,
      draft: false,
      prerelease: false,
    });
    return release.html_url || '';
  } catch (error) {
    if (error instanceof GitHubError) {
      await rollbackTagRef({ error, github, tag });
    }
    throw error;
  }
}

export async function publishBootstrapStable({
  createGithubRelease = true,
  fetchImpl,
  releaseNotes,
  releaseTitle,
  repository,
  tag,
  targetSha,
  targetVersion,
  token,
}) {
  assertBootstrapPublishTag({ tag, targetVersion });

  const github = (method, path, body) =>
    githubRequest({ method, path, body, repository, token, fetchImpl });
  const tagObject = await github('POST', '/git/tags', {
    tag,
    message: `${tag}\n`,
    object: targetSha,
    type: 'commit',
    tagger: {
      name: 'revisium-release-bot',
      email: 'release-bot@revisium.io',
      date: new Date().toISOString(),
    },
  });

  await github('POST', '/git/refs', {
    ref: `refs/tags/${tag}`,
    sha: tagObject.sha,
  });

  const releaseUrl = createGithubRelease
    ? await createBootstrapGithubRelease({
        github,
        releaseNotes,
        releaseTitle,
        tag,
        targetVersion,
      })
    : '';

  return {
    releaseUrl,
    tag,
    tagObjectSha: tagObject.sha,
    tagRef: `refs/tags/${tag}`,
  };
}
