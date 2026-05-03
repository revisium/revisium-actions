import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertSafeGitRef,
  GitHubError,
  githubRequest,
  publishRelease,
  releaseCommitFiles,
  releaseCommitSummary,
} from '../src/release-publish.js';

const plan = {
  refMode: 'create',
  tag: 'v0.2.0-alpha.0',
  targetBranch: 'release/0.2.x',
  targetVersion: '0.2.0-alpha.0',
};

test('releaseCommitFiles includes package metadata and optional version files', () => {
  assert.deepEqual(releaseCommitFiles('src/openapi.json\nsrc/system.json'), [
    'package.json',
    'package-lock.json',
    'src/openapi.json',
    'src/system.json',
  ]);
});

test('releaseCommitSummary describes publish metadata', () => {
  assert.match(
    releaseCommitSummary({
      files: releaseCommitFiles('src/openapi.json'),
      ...plan,
    }),
    /Target branch: release\/0\.2\.x/,
  );
});

test('assertSafeGitRef rejects unsafe refs', () => {
  assert.throws(() => assertSafeGitRef('../release/0.2.x'), /Unsafe git ref/);
  assert.throws(() => assertSafeGitRef('release/0.2.x --force'), /Unsafe git ref/);
});

test('githubRequest throws GitHubError for failed API calls', async () => {
  await assert.rejects(
    () =>
      githubRequest({
        method: 'GET',
        path: '/git/commits/base',
        repository: 'revisium/docs',
        token: 'token',
        fetchImpl: async () =>
          new Response('bad request', {
            status: 400,
          }),
      }),
    (error) =>
      error instanceof GitHubError &&
      error.status === 400 &&
      /bad request/.test(error.responseBody),
  );
});

test('publishRelease creates verified commit, branch ref, and tag ref', async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({
      body: options.body ? JSON.parse(options.body) : null,
      method: options.method,
      path: new URL(url).pathname.replace('/repos/revisium/docs', ''),
    });

    const path = calls.at(-1).path;
    if (path === '/git/commits/base-sha') {
      return Response.json({ tree: { sha: 'base-tree-sha' } });
    }
    if (path === '/git/blobs') {
      return Response.json({ sha: `blob-${calls.length}` });
    }
    if (path === '/git/trees') {
      return Response.json({ sha: 'tree-sha' });
    }
    if (path === '/git/commits') {
      return Response.json({
        sha: 'commit-sha',
        verification: {
          reason: 'valid',
          verified: true,
        },
      });
    }
    if (path === '/git/refs') {
      return Response.json({});
    }

    throw new Error(`Unexpected API path: ${path}`);
  };

  const result = await publishRelease({
    baseSha: 'base-sha',
    files: ['package.json'],
    repository: 'revisium/docs',
    token: 'token',
    fetchImpl,
    ...plan,
  });

  assert.deepEqual(result, {
    branchRef: 'refs/heads/release/0.2.x',
    commitSha: 'commit-sha',
    tagRef: 'refs/tags/v0.2.0-alpha.0',
    verificationReason: 'valid',
  });
  assert.deepEqual(
    calls.map(({ method, path }) => `${method} ${path}`),
    [
      'GET /git/commits/base-sha',
      'POST /git/blobs',
      'POST /git/trees',
      'POST /git/commits',
      'POST /git/refs',
      'POST /git/refs',
    ],
  );
  assert.deepEqual(calls[3].body, {
    message: 'chore: release 0.2.0-alpha.0',
    parents: ['base-sha'],
    tree: 'tree-sha',
  });
});

test('publishRelease rolls back an updated branch when tag creation fails', async () => {
  const calls = [];
  let branchReads = 0;
  const fetchImpl = async (url, options) => {
    const call = {
      body: options.body ? JSON.parse(options.body) : null,
      method: options.method,
      path: new URL(url).pathname.replace('/repos/revisium/docs', ''),
    };
    calls.push(call);

    if (call.path === '/git/commits/base-sha') {
      return Response.json({ tree: { sha: 'base-tree-sha' } });
    }
    if (call.path === '/git/blobs') {
      return Response.json({ sha: 'blob-sha' });
    }
    if (call.path === '/git/trees') {
      return Response.json({ sha: 'tree-sha' });
    }
    if (call.path === '/git/commits') {
      return Response.json({
        sha: 'commit-sha',
        verification: {
          reason: 'valid',
          verified: true,
        },
      });
    }
    if (call.path === '/git/ref/heads/release/0.2.x') {
      branchReads += 1;
      return Response.json({
        object: {
          sha: branchReads === 1 ? 'previous-branch-sha' : 'commit-sha',
        },
      });
    }
    if (call.path === '/git/refs/heads/release/0.2.x') {
      return Response.json({});
    }
    if (call.path === '/git/refs') {
      return new Response('tag already exists', { status: 422 });
    }

    throw new Error(`Unexpected API path: ${call.path}`);
  };

  await assert.rejects(
    () =>
      publishRelease({
        baseSha: 'base-sha',
        files: ['package.json'],
        ...plan,
        refMode: 'update',
        repository: 'revisium/docs',
        token: 'token',
        fetchImpl,
      }),
    (error) => error instanceof GitHubError && error.status === 422,
  );
  assert.deepEqual(
    calls.map(({ method, path }) => `${method} ${path}`),
    [
      'GET /git/commits/base-sha',
      'POST /git/blobs',
      'POST /git/trees',
      'POST /git/commits',
      'GET /git/ref/heads/release/0.2.x',
      'PATCH /git/refs/heads/release/0.2.x',
      'POST /git/refs',
      'GET /git/ref/heads/release/0.2.x',
      'PATCH /git/refs/heads/release/0.2.x',
    ],
  );
  assert.deepEqual(calls[5].body, {
    force: false,
    sha: 'commit-sha',
  });
  assert.deepEqual(calls[8].body, {
    force: true,
    sha: 'previous-branch-sha',
  });
});

test('publishRelease deletes a created branch when tag creation fails', async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    const call = {
      body: options.body ? JSON.parse(options.body) : null,
      method: options.method,
      path: new URL(url).pathname.replace('/repos/revisium/docs', ''),
    };
    calls.push(call);

    if (call.path === '/git/commits/base-sha') {
      return Response.json({ tree: { sha: 'base-tree-sha' } });
    }
    if (call.path === '/git/blobs') {
      return Response.json({ sha: 'blob-sha' });
    }
    if (call.path === '/git/trees') {
      return Response.json({ sha: 'tree-sha' });
    }
    if (call.path === '/git/commits') {
      return Response.json({
        sha: 'commit-sha',
        verification: {
          reason: 'valid',
          verified: true,
        },
      });
    }
    if (call.path === '/git/ref/heads/release/0.2.x') {
      return Response.json({ object: { sha: 'commit-sha' } });
    }
    if (call.path === '/git/refs/heads/release/0.2.x') {
      return Response.json({});
    }
    if (call.path === '/git/refs' && call.body.ref === 'refs/heads/release/0.2.x') {
      return Response.json({});
    }
    if (call.path === '/git/refs' && call.body.ref === 'refs/tags/v0.2.0-alpha.0') {
      return new Response('tag already exists', { status: 422 });
    }

    throw new Error(`Unexpected API path: ${call.path}`);
  };

  await assert.rejects(
    () =>
      publishRelease({
        baseSha: 'base-sha',
        files: ['package.json'],
        repository: 'revisium/docs',
        token: 'token',
        fetchImpl,
        ...plan,
      }),
    (error) => error instanceof GitHubError && error.status === 422,
  );
  assert.deepEqual(
    calls.map(({ method, path }) => `${method} ${path}`),
    [
      'GET /git/commits/base-sha',
      'POST /git/blobs',
      'POST /git/trees',
      'POST /git/commits',
      'POST /git/refs',
      'POST /git/refs',
      'GET /git/ref/heads/release/0.2.x',
      'DELETE /git/refs/heads/release/0.2.x',
    ],
  );
});

test('publishRelease fails closed when rollback sees a moved branch', async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    const call = {
      body: options.body ? JSON.parse(options.body) : null,
      method: options.method,
      path: new URL(url).pathname.replace('/repos/revisium/docs', ''),
    };
    calls.push(call);

    if (call.path === '/git/commits/base-sha') {
      return Response.json({ tree: { sha: 'base-tree-sha' } });
    }
    if (call.path === '/git/blobs') {
      return Response.json({ sha: 'blob-sha' });
    }
    if (call.path === '/git/trees') {
      return Response.json({ sha: 'tree-sha' });
    }
    if (call.path === '/git/commits') {
      return Response.json({
        sha: 'commit-sha',
        verification: {
          reason: 'valid',
          verified: true,
        },
      });
    }
    if (call.path === '/git/ref/heads/release/0.2.x') {
      return Response.json({ object: { sha: calls.length < 8 ? 'previous-sha' : 'newer-sha' } });
    }
    if (call.path === '/git/refs/heads/release/0.2.x') {
      return Response.json({});
    }
    if (call.path === '/git/refs') {
      return new Response('tag already exists', { status: 422 });
    }

    throw new Error(`Unexpected API path: ${call.path}`);
  };

  await assert.rejects(
    () =>
      publishRelease({
        baseSha: 'base-sha',
        files: ['package.json'],
        ...plan,
        refMode: 'update',
        repository: 'revisium/docs',
        token: 'token',
        fetchImpl,
      }),
    /Failed to create tag v0\.2\.0-alpha\.0 .* and roll back release\/0\.2\.x/,
  );
  assert.equal(calls.filter((call) => call.method === 'PATCH').length, 1);
});

test('publishRelease refuses unverified GitHub App commits', async () => {
  const fetchImpl = async (url) => {
    const path = new URL(url).pathname.replace('/repos/revisium/docs', '');
    if (path === '/git/commits/base-sha') {
      return Response.json({ tree: { sha: 'base-tree-sha' } });
    }
    if (path === '/git/blobs') return Response.json({ sha: 'blob-sha' });
    if (path === '/git/trees') return Response.json({ sha: 'tree-sha' });
    if (path === '/git/commits') {
      return Response.json({
        sha: 'commit-sha',
        verification: {
          reason: 'unsigned',
          verified: false,
        },
      });
    }

    throw new Error(`Unexpected API path: ${path}`);
  };

  await assert.rejects(
    () =>
      publishRelease({
        baseSha: 'base-sha',
        files: ['package.json'],
        repository: 'revisium/docs',
        token: 'token',
        fetchImpl,
        ...plan,
      }),
    /GitHub did not verify the release bot commit \(unsigned\)/,
  );
});
