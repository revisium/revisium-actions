#!/usr/bin/env node
import {
  assertNoPrereleaseRuntimeDependencies,
  shouldSkipStableDependencyGuard,
} from '../src/version-metadata.js';

const targetVersion = process.env.TARGET_VERSION || '';
if (shouldSkipStableDependencyGuard(targetVersion)) {
  console.log(`Skipping stable dependency guard for prerelease ${targetVersion}`);
  process.exit(0);
}

assertNoPrereleaseRuntimeDependencies({
  packagePath: process.env.PACKAGE_PATH || 'package.json',
});
