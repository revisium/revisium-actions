#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const result = spawnSync('actionlint', args, { stdio: 'inherit' });

if (result.error?.code === 'ENOENT') {
  console.warn('actionlint binary was not found locally.');
  console.warn('CI runs raven-actions/actionlint against workflows and examples.');
  process.exit(0);
}

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 0);
