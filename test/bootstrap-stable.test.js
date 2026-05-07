import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  formatBootstrapStableSummary,
  planBootstrapStable,
  publishBootstrapStable,
} from '../src/bootstrap-stable.js';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const workflow = fs.readFileSync(`${repoRoot}/.github/workflows/bootstrap-stable.yml`, 'utf8');
const example = fs.readFileSync(`${repoRoot}/examples/workflows/bootstrap-stable.yml`, 'utf8');

test('planBootstrapStable validates a new repository baseline', () => {
  const plan = planBootstrapStable({
    baseBranch: 'refs/heads/master',
    currentBranch: 'origin/master',
    currentVersion: '0.1.0',
    tags: [],
    targetVersion: '0.1.0',
  });

  assert.deepEqual(plan, {
    baseBranch: 'master',
    currentBranch: 'master',
    currentVersion: '0.1.0',
    tag: 'v0.1.0',
    targetVersion: '0.1.0',
  });

  assert.match(formatBootstrapStableSummary(plan), /Bootstrap stable plan/);
});

test('planBootstrapStable rejects unsafe bootstrap inputs', () => {
  assert.throws(
    () =>
      planBootstrapStable({
        baseBranch: 'master',
        currentBranch: 'release/0.1.x',
        currentVersion: '0.1.0',
        tags: [],
        targetVersion: '0.1.0',
      }),
    /bootstrap-stable must run from master/,
  );

  assert.throws(
    () =>
      planBootstrapStable({
        baseBranch: 'master',
        currentBranch: 'master',
        currentVersion: '0.1.0-alpha.0',
        tags: [],
        targetVersion: '0.1.0-alpha.0',
      }),
    /stable X\.Y\.Z version/,
  );

  assert.throws(
    () =>
      planBootstrapStable({
        baseBranch: 'master',
        currentBranch: 'master',
        currentVersion: '0.1.1',
        tags: [],
        targetVersion: '0.1.0',
      }),
    /must match bootstrap-stable target/,
  );

  assert.throws(
    () =>
      planBootstrapStable({
        baseBranch: 'master',
        currentBranch: 'master',
        currentVersion: '0.1.0',
        tags: ['refs/tags/v0.0.1'],
        targetVersion: '0.1.0',
      }),
    /before any v\* tags exist/,
  );
});

test('publishBootstrapStable creates an annotated tag and release', async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    const path = new URL(url).pathname.replace('/repos/revisium/revisium-payment', '');
    const body = init.body ? JSON.parse(init.body) : null;
    calls.push({ method: init.method, path, body });

    if (path === '/git/tags') {
      return new Response(JSON.stringify({ sha: 'tag-object-sha' }), { status: 201 });
    }

    if (path === '/git/refs') {
      return new Response(JSON.stringify({ ref: body.ref, object: { sha: body.sha } }), {
        status: 201,
      });
    }

    if (path === '/releases') {
      return new Response(JSON.stringify({ html_url: 'https://github.test/releases/v0.1.0' }), {
        status: 201,
      });
    }

    return new Response('unexpected request', { status: 500 });
  };

  const result = await publishBootstrapStable({
    fetchImpl,
    repository: 'revisium/revisium-payment',
    tag: 'v0.1.0',
    targetSha: 'commit-sha',
    targetVersion: '0.1.0',
    token: 'token',
  });

  assert.equal(result.releaseUrl, 'https://github.test/releases/v0.1.0');
  assert.deepEqual(
    calls.map((call) => `${call.method} ${call.path}`),
    ['POST /git/tags', 'POST /git/refs', 'POST /releases'],
  );
  assert.equal(calls[0].body.object, 'commit-sha');
  assert.equal(calls[1].body.ref, 'refs/tags/v0.1.0');
  assert.equal(calls[2].body.tag_name, 'v0.1.0');
});

test('publishBootstrapStable rejects mismatched tag and targetVersion before API writes', async () => {
  const calls = [];

  await assert.rejects(
    () =>
      publishBootstrapStable({
        fetchImpl: async (url, init) => {
          calls.push(`${init.method} ${new URL(url).pathname}`);
          return new Response('unexpected request', { status: 500 });
        },
        repository: 'revisium/revisium-payment',
        tag: 'v0.1.1',
        targetSha: 'commit-sha',
        targetVersion: '0.1.0',
        token: 'token',
      }),
    /tag v0\.1\.1 must match targetVersion 0\.1\.0 \(v0\.1\.0\)/,
  );

  assert.deepEqual(calls, []);
});

test('publishBootstrapStable rolls back the tag ref when release creation fails', async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    const path = new URL(url).pathname.replace('/repos/revisium/revisium-payment', '');
    calls.push(`${init.method} ${path}`);

    if (path === '/git/tags') {
      return new Response(JSON.stringify({ sha: 'tag-object-sha' }), { status: 201 });
    }

    if (path === '/git/refs') {
      return new Response(JSON.stringify({ ref: 'refs/tags/v0.1.0' }), { status: 201 });
    }

    if (path === '/releases') {
      return new Response('release failed', { status: 500 });
    }

    if (path === '/git/refs/tags/v0.1.0') {
      return new Response(null, { status: 204 });
    }

    return new Response('unexpected request', { status: 500 });
  };

  await assert.rejects(
    () =>
      publishBootstrapStable({
        fetchImpl,
        repository: 'revisium/revisium-payment',
        tag: 'v0.1.0',
        targetSha: 'commit-sha',
        targetVersion: '0.1.0',
        token: 'token',
      }),
    /POST \/releases failed with 500/,
  );

  assert.deepEqual(calls, [
    'POST /git/tags',
    'POST /git/refs',
    'POST /releases',
    'DELETE /git/refs/tags/v0.1.0',
  ]);
});

test('publishBootstrapStable preserves the release error when tag rollback fails', async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    const path = new URL(url).pathname.replace('/repos/revisium/revisium-payment', '');
    calls.push(`${init.method} ${path}`);

    if (path === '/git/tags') {
      return new Response(JSON.stringify({ sha: 'tag-object-sha' }), { status: 201 });
    }

    if (path === '/git/refs') {
      return new Response(JSON.stringify({ ref: 'refs/tags/v0.1.0' }), { status: 201 });
    }

    if (path === '/releases') {
      return new Response('release failed', { status: 500 });
    }

    if (path === '/git/refs/tags/v0.1.0') {
      return new Response('rollback failed', { status: 500 });
    }

    return new Response('unexpected request', { status: 500 });
  };

  await assert.rejects(
    () =>
      publishBootstrapStable({
        fetchImpl,
        repository: 'revisium/revisium-payment',
        tag: 'v0.1.0',
        targetSha: 'commit-sha',
        targetVersion: '0.1.0',
        token: 'token',
      }),
    (error) => {
      assert.match(error.message, /POST \/releases failed with 500: release failed/);
      assert.match(
        error.message,
        /rollback failed: DELETE \/git\/refs\/tags\/v0\.1\.0 failed with 500: rollback failed/,
      );
      return true;
    },
  );

  assert.deepEqual(calls, [
    'POST /git/tags',
    'POST /git/refs',
    'POST /releases',
    'DELETE /git/refs/tags/v0.1.0',
  ]);
});

test('bootstrap stable workflow and example expose guarded write mode', () => {
  assert.match(workflow, /workflow_call/);
  assert.match(workflow, /target_version/);
  assert.match(workflow, /Create release app token/);
  assert.match(workflow, /Fetch release refs/);
  assert.match(workflow, /node \.revisium-actions\/bin\/bootstrap-stable\.mjs/);
  assert.match(workflow, /dry_run=false requires RELEASE_BOT_CLIENT_ID/);
  assert.match(example, /bootstrap-stable\.yml@v0\.3\.5/);
  assert.match(example, /target_version: \$\{\{ inputs\.target_version \}\}/);
  assert.match(example, /dry_run: \$\{\{ inputs\.dry_run \}\}/);
  assert.match(example, /RELEASE_BOT_PRIVATE_KEY:\s*\$\{\{ secrets\.RELEASE_BOT_PRIVATE_KEY \}\}/);
});
