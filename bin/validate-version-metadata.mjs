#!/usr/bin/env node
import { requiredEnv, validateVersionMetadata } from '../src/version-metadata.js';

const versionSource = process.env.VERSION_SOURCE || 'package';

function packageMetadataMode(source) {
  if (source === 'package') return 'required';
  if (source === 'tag') return 'optional';
  throw new Error(`VERSION_SOURCE must be package or tag, got ${source}`);
}

validateVersionMetadata({
  packageMetadata: packageMetadataMode(versionSource),
  packagePath: process.env.PACKAGE_PATH || 'package.json',
  targetVersion: requiredEnv('TARGET_VERSION'),
  versionFiles: process.env.VERSION_FILES || '',
});
