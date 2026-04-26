#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

import { resolveActionlintResult } from '../src/actionlint-result.js';

const actionlintCandidates = [
  '/usr/local/bin/actionlint',
  '/opt/homebrew/bin/actionlint',
  '/usr/bin/actionlint',
  '/bin/actionlint',
];

function findActionlintBinary() {
  for (const candidate of actionlintCandidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

const args = process.argv.slice(2);
const actionlintBinary = findActionlintBinary();

if (!actionlintBinary) {
  console.warn('actionlint binary was not found in known local binary directories.');
  console.warn('CI runs raven-actions/actionlint against workflows and examples.');
  process.exit(0);
}

const result = spawnSync(actionlintBinary, args, { stdio: 'inherit' });
const resolved = resolveActionlintResult(result);

for (const warning of resolved.warnings || []) {
  console.warn(warning);
}

for (const error of resolved.errors || []) {
  console.error(error);
}

process.exit(resolved.exitCode);
