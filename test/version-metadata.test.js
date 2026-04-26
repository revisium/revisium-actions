import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applyVersionMetadata,
  findPrereleaseRuntimeDependencyViolations,
  getJsonVersion,
  setJsonVersion,
  shouldSkipStableDependencyGuard,
  splitFileList,
  validateVersionMetadata,
} from '../src/version-metadata.js';

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'revisium-actions-'));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

test('splitFileList accepts newline strings and arrays', () => {
  assert.deepEqual(splitFileList('a.json\n\n b.json \r\n'), ['a.json', 'b.json']);
  assert.deepEqual(splitFileList([' a.json ', '', 'b.json']), ['a.json', 'b.json']);
});

test('getJsonVersion and setJsonVersion handle version and info.version', () => {
  const packageDoc = { version: '1.0.0' };
  const openApiDoc = { info: { version: '1.0.0' } };

  setJsonVersion(packageDoc, '1.1.0');
  setJsonVersion(openApiDoc, '1.1.0');

  assert.equal(getJsonVersion(packageDoc), '1.1.0');
  assert.equal(getJsonVersion(openApiDoc), '1.1.0');
});

test('applyVersionMetadata and validateVersionMetadata update package and extra JSON files', () => {
  const cwd = tempDir();
  writeJson(path.join(cwd, 'package.json'), {
    name: 'fixture',
    version: '0.0.0',
    private: true,
  });
  writeJson(path.join(cwd, 'package-lock.json'), {
    name: 'fixture',
    version: '0.0.0',
    lockfileVersion: 3,
    requires: true,
    packages: {
      '': {
        name: 'fixture',
        version: '0.0.0',
      },
    },
  });
  fs.mkdirSync(path.join(cwd, 'src'), { recursive: true });
  writeJson(path.join(cwd, 'src/openapi.json'), { info: { version: '0.0.0' } });

  applyVersionMetadata({
    cwd,
    targetVersion: '1.2.3-alpha.0',
    versionFiles: 'src/openapi.json',
  });

  validateVersionMetadata({
    cwd,
    targetVersion: '1.2.3-alpha.0',
    versionFiles: 'src/openapi.json',
  });

  assert.equal(readJson(path.join(cwd, 'package.json')).version, '1.2.3-alpha.0');
  assert.equal(readJson(path.join(cwd, 'src/openapi.json')).info.version, '1.2.3-alpha.0');
});

test('validateVersionMetadata rejects mismatched package metadata', () => {
  const cwd = tempDir();
  writeJson(path.join(cwd, 'package.json'), { name: 'fixture', version: '1.0.0' });
  writeJson(path.join(cwd, 'package-lock.json'), {
    name: 'fixture',
    version: '1.0.1',
    packages: { '': { version: '1.0.1' } },
  });

  assert.throws(
    () => validateVersionMetadata({ cwd, targetVersion: '1.0.0' }),
    /package-lock\.json version mismatch/,
  );
});

test('findPrereleaseRuntimeDependencyViolations checks runtime sections only', () => {
  const violations = findPrereleaseRuntimeDependencyViolations({
    dependencies: {
      '@revisium/core': '^2.10.0-alpha.0',
    },
    peerDependencies: {
      '@revisium/engine': '0.7.0-rc.1',
    },
    optionalDependencies: {
      '@revisium/payment': '~0.2.0-alpha.2',
    },
    devDependencies: {
      '@revisium/dev-only': '9.9.9-alpha.1',
    },
  });

  assert.deepEqual(violations, [
    'dependencies: @revisium/core@^2.10.0-alpha.0',
    'peerDependencies: @revisium/engine@0.7.0-rc.1',
    'optionalDependencies: @revisium/payment@~0.2.0-alpha.2',
  ]);
});

test('shouldSkipStableDependencyGuard skips prerelease targets only', () => {
  assert.equal(shouldSkipStableDependencyGuard('1.2.3-alpha.0'), true);
  assert.equal(shouldSkipStableDependencyGuard('1.2.3-rc.0'), true);
  assert.equal(shouldSkipStableDependencyGuard('1.2.3'), false);
  assert.equal(shouldSkipStableDependencyGuard(''), false);
});
