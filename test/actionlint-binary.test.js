import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  actionlintSearchDirectories,
  findActionlintBinary,
  isSafeSearchDirectory,
} from '../src/actionlint-binary.js';

function tempDir(mode = 0o755) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'revisium-actions-bin-'));
  fs.chmodSync(dir, mode);
  return dir;
}

test('isSafeSearchDirectory rejects relative and writable directories', () => {
  assert.equal(isSafeSearchDirectory('node_modules/.bin'), false);

  const writable = tempDir(0o777);
  assert.equal(isSafeSearchDirectory(writable), false);

  const safe = tempDir(0o755);
  assert.equal(isSafeSearchDirectory(safe), true);
});

test('actionlintSearchDirectories reads safe directories from PATH before fallbacks', () => {
  const safe = tempDir(0o755);
  const writable = tempDir(0o777);

  assert.deepEqual(
    actionlintSearchDirectories({
      pathValue: [safe, writable, 'relative/bin'].join(path.delimiter),
      extraDirs: [],
    }),
    [safe],
  );
});

test('findActionlintBinary resolves executable actionlint from PATH safely', () => {
  const safe = tempDir(0o755);
  const binary = path.join(safe, 'actionlint');
  fs.writeFileSync(binary, '#!/bin/sh\nexit 0\n');
  fs.chmodSync(binary, 0o755);

  assert.equal(
    findActionlintBinary({
      pathValue: safe,
      extraDirs: [],
    }),
    binary,
  );
});

test('findActionlintBinary ignores non-executable candidates', () => {
  const safe = tempDir(0o755);
  const binary = path.join(safe, 'actionlint');
  fs.writeFileSync(binary, '');
  fs.chmodSync(binary, 0o644);

  assert.equal(
    findActionlintBinary({
      pathValue: safe,
      extraDirs: [],
    }),
    null,
  );
});
