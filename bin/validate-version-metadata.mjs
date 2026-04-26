#!/usr/bin/env node
import { requiredEnv, validateVersionMetadata } from '../src/version-metadata.js';

validateVersionMetadata({
  targetVersion: requiredEnv('TARGET_VERSION'),
  versionFiles: process.env.VERSION_FILES || '',
});
