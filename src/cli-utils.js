import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const gitBinary = '/usr/bin/git';

export function git(args, options = {}) {
  try {
    return execFileSync(gitBinary, args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', options.allowFailure ? 'ignore' : 'pipe'],
    }).trim();
  } catch (error) {
    if (options.allowFailure) return '';
    throw error;
  }
}

export function lines(value) {
  return String(value)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function coerceBoolean(value) {
  return value === true || String(value).toLowerCase() === 'true';
}

export function getCurrentBranch(env = process.env) {
  return (
    env.CURRENT_BRANCH ||
    env.GITHUB_REF_NAME ||
    git(['branch', '--show-current'], {
      allowFailure: true,
    })
  );
}

export function appendOutput(name, value, env = process.env) {
  if (!env.GITHUB_OUTPUT) return;
  fs.appendFileSync(env.GITHUB_OUTPUT, `${name}=${value}\n`);
}

export function writeOutputs(outputs, env = process.env) {
  if (!env.GITHUB_OUTPUT) return;

  const linesToWrite = Object.entries(outputs).map(([key, value]) => `${key}=${value}`);
  fs.appendFileSync(env.GITHUB_OUTPUT, `${linesToWrite.join('\n')}\n`);
}
