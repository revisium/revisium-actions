import fs from 'node:fs';
import path from 'node:path';

const fallbackActionlintDirs = ['/usr/local/bin', '/opt/homebrew/bin', '/usr/bin', '/bin'];

function unique(values) {
  return [...new Set(values)];
}

export function isSafeSearchDirectory(dir, statSync = fs.statSync) {
  if (!path.isAbsolute(dir)) {
    return false;
  }

  const stats = statSync(dir);
  if (!stats.isDirectory()) {
    return false;
  }

  return (stats.mode & 0o022) === 0;
}

export function actionlintSearchDirectories({
  pathValue = process.env.PATH || '',
  extraDirs = fallbackActionlintDirs,
  statSync = fs.statSync,
} = {}) {
  const pathDirs = pathValue.split(path.delimiter).filter(Boolean);
  return unique([...pathDirs, ...extraDirs]).filter((dir) => {
    try {
      return isSafeSearchDirectory(dir, statSync);
    } catch {
      return false;
    }
  });
}

export function findActionlintBinary({
  pathValue = process.env.PATH || '',
  extraDirs = fallbackActionlintDirs,
  existsSync = fs.existsSync,
  accessSync = fs.accessSync,
  statSync = fs.statSync,
} = {}) {
  for (const dir of actionlintSearchDirectories({ pathValue, extraDirs, statSync })) {
    const candidate = path.join(dir, 'actionlint');
    if (!existsSync(candidate)) {
      continue;
    }

    try {
      accessSync(candidate, fs.constants.X_OK);
      return candidate;
    } catch {
      // Continue searching when a candidate exists but is not executable.
    }
  }

  return null;
}
