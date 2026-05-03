import fs from 'node:fs';

import { buildReleaseCommitMessage } from './release-train.js';
import { splitFileList } from './version-metadata.js';

const apiVersion = '2022-11-28';
const remoteRefPattern = /^[A-Za-z0-9._/-]+$/;

export class GitHubError extends Error {
  constructor(message, status, responseBody) {
    super(message);
    this.name = 'GitHubError';
    this.status = status;
    this.responseBody = responseBody;
  }
}

export function assertSafeGitRef(ref) {
  if (
    !remoteRefPattern.test(ref) ||
    ref.includes('..') ||
    ref.startsWith('/') ||
    ref.endsWith('/')
  ) {
    throw new Error(`Unsafe git ref: ${ref}`);
  }
}

export function releaseCommitFiles(versionFiles = '') {
  return ['package.json', 'package-lock.json', ...splitFileList(versionFiles)];
}

export function releaseCommitSummary({ files, refMode, targetBranch, targetVersion }) {
  return [
    `Target branch: ${targetBranch}`,
    `Target version: ${targetVersion}`,
    `Ref mode: ${refMode}`,
    `Files: ${files.join(', ')}`,
  ].join('\n');
}

export async function githubRequest({ method, path, token, repository, body, fetchImpl = fetch }) {
  const response = await fetchImpl(`https://api.github.com/repos/${repository}${path}`, {
    method,
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      'x-github-api-version': apiVersion,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new GitHubError(
      `${method} ${path} failed with ${response.status}: ${text}`,
      response.status,
      text,
    );
  }

  return text ? JSON.parse(text) : null;
}

async function commitFileEntries({ files, github }) {
  const entries = [];

  for (const path of files) {
    const blob = await github('POST', '/git/blobs', {
      content: fs.readFileSync(path, 'utf8'),
      encoding: 'utf-8',
    });

    entries.push({
      path,
      mode: '100644',
      type: 'blob',
      sha: blob.sha,
    });
  }

  return entries;
}

async function updateBranchRef({ github, refMode, targetBranch, commitSha }) {
  const ref = `refs/heads/${targetBranch}`;

  if (refMode === 'create') {
    await github('POST', '/git/refs', { ref, sha: commitSha });
    return;
  }

  await github('PATCH', `/git/refs/heads/${targetBranch}`, {
    sha: commitSha,
    force: false,
  });
}

async function readBranchRefSha({ github, targetBranch }) {
  const branchRef = await github('GET', `/git/ref/heads/${targetBranch}`);
  return branchRef.object.sha;
}

async function rollbackBranchRef({ github, refMode, targetBranch, commitSha, originalBranchSha }) {
  const currentBranchSha = await readBranchRefSha({ github, targetBranch });

  if (currentBranchSha !== commitSha) {
    throw new Error(
      `Ref ${targetBranch} moved after release publish wrote ${commitSha}; current SHA is ${currentBranchSha}`,
    );
  }

  if (refMode === 'create') {
    await github('DELETE', `/git/refs/heads/${targetBranch}`);
    return;
  }

  await github('PATCH', `/git/refs/heads/${targetBranch}`, {
    sha: originalBranchSha,
    force: true,
  });
}

async function createTagRef({ github, refMode, targetBranch, commitSha, originalBranchSha, tag }) {
  try {
    await github('POST', '/git/refs', {
      ref: `refs/tags/${tag}`,
      sha: commitSha,
    });
  } catch (tagError) {
    try {
      await rollbackBranchRef({
        github,
        refMode,
        targetBranch,
        commitSha,
        originalBranchSha,
      });
    } catch (rollbackError) {
      const tagMessage = tagError instanceof Error ? tagError.message : String(tagError);
      throw new Error(
        `Failed to create tag ${tag} (${tagMessage}) and roll back ${targetBranch}: ${rollbackError.message}`,
        { cause: rollbackError },
      );
    }

    throw tagError;
  }
}

export async function publishRelease({
  baseSha,
  files,
  refMode,
  repository,
  tag,
  targetBranch,
  targetVersion,
  token,
  fetchImpl,
}) {
  assertSafeGitRef(targetBranch);
  assertSafeGitRef(tag);

  if (!['create', 'update'].includes(refMode)) {
    throw new Error(`refMode must be create or update, got ${refMode}`);
  }

  const github = (method, path, body) =>
    githubRequest({ method, path, body, repository, token, fetchImpl });
  const baseCommit = await github('GET', `/git/commits/${baseSha}`);
  const tree = await github('POST', '/git/trees', {
    base_tree: baseCommit.tree.sha,
    tree: await commitFileEntries({ files, github }),
  });
  const commit = await github('POST', '/git/commits', {
    message: buildReleaseCommitMessage(targetVersion),
    tree: tree.sha,
    parents: [baseSha],
  });

  if (!commit.verification?.verified) {
    const reason = commit.verification?.reason || 'unknown';
    throw new Error(`GitHub did not verify the release bot commit (${reason})`);
  }

  const originalBranchSha =
    refMode === 'update' ? await readBranchRefSha({ github, targetBranch }) : null;

  await updateBranchRef({
    github,
    refMode,
    targetBranch,
    commitSha: commit.sha,
  });
  const branchRef = `refs/heads/${targetBranch}`;
  const tagRef = `refs/tags/${tag}`;
  await createTagRef({
    github,
    refMode,
    targetBranch,
    commitSha: commit.sha,
    originalBranchSha,
    tag,
  });

  return {
    branchRef,
    commitSha: commit.sha,
    tagRef,
    verificationReason: commit.verification.reason || '',
  };
}
