import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const runtimeDependencySections = ['dependencies', 'peerDependencies', 'optionalDependencies'];
const prereleaseVersionPattern = /(?:^|[^\w.-])v?\d+\.\d+\.\d+-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*/;

export function requiredEnv(name, env = process.env) {
  const value = env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

export function splitFileList(value = '') {
  if (Array.isArray(value)) {
    return value.map((file) => file.trim()).filter(Boolean);
  }

  return String(value)
    .split(/\r?\n/)
    .map((file) => file.trim())
    .filter(Boolean);
}

export function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

export function writeJsonFile(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

export function getJsonVersion(value, label = 'JSON document') {
  if (value.info && typeof value.info === 'object' && 'version' in value.info) {
    return value.info.version;
  }

  if ('version' in value) {
    return value.version;
  }

  throw new Error(`${label} does not contain info.version or version`);
}

export function setJsonVersion(value, version, label = 'JSON document') {
  if (value.info && typeof value.info === 'object' && 'version' in value.info) {
    value.info.version = version;
    return value;
  }

  if ('version' in value) {
    value.version = version;
    return value;
  }

  throw new Error(`${label} does not contain info.version or version`);
}

export function updateJsonVersionFile(filePath, version) {
  const doc = readJsonFile(filePath);
  setJsonVersion(doc, version, filePath);
  writeJsonFile(filePath, doc);
}

function resolveRepoPath(cwd, relativePath) {
  return path.resolve(cwd, relativePath);
}

export function applyVersionMetadata({ cwd = process.cwd(), targetVersion, versionFiles = '' }) {
  if (!targetVersion) {
    throw new Error('targetVersion is required');
  }

  execFileSync('npm', ['version', targetVersion, '--no-git-tag-version', '--allow-same-version'], {
    cwd,
    stdio: 'inherit',
  });

  for (const file of splitFileList(versionFiles)) {
    updateJsonVersionFile(resolveRepoPath(cwd, file), targetVersion);
  }
}

function assertEqual(label, actual, expected) {
  console.log(`${label}: ${actual}`);
  if (actual !== expected) {
    throw new Error(`${label} mismatch: ${actual} != ${expected}`);
  }
}

export function validateVersionMetadata({ cwd = process.cwd(), targetVersion, versionFiles = '' }) {
  if (!targetVersion) {
    throw new Error('targetVersion is required');
  }

  const pkg = readJsonFile(resolveRepoPath(cwd, 'package.json'));
  const lock = readJsonFile(resolveRepoPath(cwd, 'package-lock.json'));

  assertEqual('package.json version', pkg.version, targetVersion);
  assertEqual('package-lock.json version', lock.version, targetVersion);
  assertEqual('package-lock root version', lock.packages?.['']?.version, targetVersion);

  for (const file of splitFileList(versionFiles)) {
    const doc = readJsonFile(resolveRepoPath(cwd, file));
    assertEqual(`${file} version`, getJsonVersion(doc, file), targetVersion);
  }

  console.log(`tag version: ${targetVersion}`);
}

export function findPrereleaseRuntimeDependencyViolations(pkg) {
  const violations = [];

  for (const section of runtimeDependencySections) {
    const dependencies = pkg[section];
    if (!dependencies) continue;

    for (const [name, version] of Object.entries(dependencies)) {
      if (prereleaseVersionPattern.test(String(version))) {
        violations.push(`${section}: ${name}@${version}`);
      }
    }
  }

  return violations;
}

export function shouldSkipStableDependencyGuard(targetVersion = '') {
  return String(targetVersion).includes('-');
}

export function assertNoPrereleaseRuntimeDependencies({
  cwd = process.cwd(),
  packagePath = 'package.json',
} = {}) {
  const pkg = readJsonFile(resolveRepoPath(cwd, packagePath));
  const violations = findPrereleaseRuntimeDependencyViolations(pkg);

  if (violations.length === 0) {
    return;
  }

  console.error('Stable releases cannot depend on prerelease runtime dependencies:');
  for (const violation of violations) console.error(`- ${violation}`);
  console.error(
    'Release stable dependency versions first, or publish this package as a prerelease.',
  );
  throw new Error(`Found ${violations.length} prerelease runtime dependency violation(s)`);
}
