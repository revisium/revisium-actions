#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

import { resolveActionlintResult } from '../src/actionlint-result.js';

const args = process.argv.slice(2);
const result = spawnSync('actionlint', args, { stdio: 'inherit' });
const resolved = resolveActionlintResult(result);

for (const warning of resolved.warnings || []) {
  console.warn(warning);
}

for (const error of resolved.errors || []) {
  console.error(error);
}

process.exit(resolved.exitCode);
