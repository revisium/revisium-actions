#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const actionsDir = path.join(repoRoot, 'actions');
const errors = [];

function requireFile(filePath) {
  if (!fs.existsSync(filePath)) {
    errors.push(`Missing ${path.relative(repoRoot, filePath)}`);
    return '';
  }
  return fs.readFileSync(filePath, 'utf8');
}

for (const entry of fs.readdirSync(actionsDir, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;

  const actionDir = path.join(actionsDir, entry.name);
  const metadata = requireFile(path.join(actionDir, 'action.yml'));
  const readme = requireFile(path.join(actionDir, 'README.md'));

  for (const key of ['name:', 'description:', 'runs:']) {
    if (metadata && !metadata.includes(key)) {
      errors.push(`${path.relative(repoRoot, actionDir)} action.yml must include ${key}`);
    }
  }

  const usage = `revisium/revisium-actions/actions/${entry.name}@`;
  if (readme && !readme.includes(usage)) {
    errors.push(`${path.relative(repoRoot, actionDir)} README.md must include ${usage}`);
  }
}

if (errors.length > 0) {
  for (const error of errors) {
    console.error(error);
  }
  process.exit(1);
}

console.log('Action documentation is complete.');
