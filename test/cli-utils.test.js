import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  appendOutput,
  coerceBoolean,
  getCurrentBranch,
  git,
  lines,
  writeOutputs,
} from '../src/cli-utils.js';

test('git helper returns command output and supports allowed failures', () => {
  assert.match(git(['--version']), /^git version /);
  assert.equal(git(['definitely-not-a-git-command'], { allowFailure: true }), '');
});

test('lines trims blank lines and coerceBoolean handles action inputs', () => {
  assert.deepEqual(lines(' first\n\nsecond \r\n third '), ['first', 'second', 'third']);
  assert.equal(coerceBoolean(true), true);
  assert.equal(coerceBoolean('true'), true);
  assert.equal(coerceBoolean('false'), false);
});

test('getCurrentBranch prefers workflow environment values', () => {
  assert.equal(getCurrentBranch({ CURRENT_BRANCH: 'release/1.0.x' }), 'release/1.0.x');
  assert.equal(getCurrentBranch({ GITHUB_REF_NAME: 'master' }), 'master');
});

test('GitHub output helpers write only when GITHUB_OUTPUT is set', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'revisium-actions-'));
  const outputPath = path.join(dir, 'output');

  appendOutput('ignored', 'value', {});
  writeOutputs({ ignored: 'value' }, {});

  appendOutput('tag', 'v0.1.0', { GITHUB_OUTPUT: outputPath });
  writeOutputs(
    {
      target_version: '0.1.0',
      release_url: '',
    },
    { GITHUB_OUTPUT: outputPath },
  );

  assert.equal(
    fs.readFileSync(outputPath, 'utf8'),
    'tag=v0.1.0\ntarget_version=0.1.0\nrelease_url=\n',
  );
});
