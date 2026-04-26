#!/usr/bin/env node
import { applyVersionMetadata, requiredEnv } from '../src/version-metadata.js';

applyVersionMetadata({
  targetVersion: requiredEnv('TARGET_VERSION'),
  versionFiles: process.env.VERSION_FILES || '',
});
