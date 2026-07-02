#!/usr/bin/env node
import {
  assertNoPrereleaseRuntimeDependencies,
  hasPackageMetadata,
  shouldSkipStableDependencyGuard,
} from '../src/version-metadata.js';

const targetVersion = process.env.TARGET_VERSION || '';
const packagePath = process.env.PACKAGE_PATH || 'package.json';
const versionSource = process.env.VERSION_SOURCE || 'package';

if (!['package', 'tag'].includes(versionSource)) {
  throw new Error(`VERSION_SOURCE must be package or tag, got ${versionSource}`);
}

if (shouldSkipStableDependencyGuard(targetVersion)) {
  console.log(`Skipping stable dependency guard for prerelease ${targetVersion}`);
  process.exit(0);
}

if (versionSource !== 'package' && !hasPackageMetadata(process.cwd(), packagePath)) {
  console.log('Skipping stable dependency guard because package metadata was not found');
  process.exit(0);
}

assertNoPrereleaseRuntimeDependencies({
  packagePath,
});
