export const releaseTrainActions = [
  'start-minor-alpha',
  'start-major-alpha',
  'start-minor-rc',
  'start-major-rc',
  'start-minor-stable',
  'start-major-stable',
  'alpha-bump',
  'promote-rc',
  'rc-bump',
  'stable',
  'patch',
  'patch-alpha-start',
  'patch-rc-start',
];

const releaseBranchPattern = /^release\/(\d+)\.(\d+)\.x$/;
const versionPattern = /^(\d+)\.(\d+)\.(\d+)(?:-(alpha|rc)\.(\d+))?$/;
const stableTagPattern = /^v(\d+)\.(\d+)\.(\d+)$/;

export function normalizeBranchRef(ref) {
  return String(ref)
    .replace(/^refs\/heads\//, '')
    .replace(/^refs\/remotes\/origin\//, '')
    .replace(/^origin\//, '');
}

export function normalizeTagRef(ref) {
  return String(ref).replace(/^refs\/tags\//, '');
}

export function parseVersion(version) {
  const match = versionPattern.exec(String(version));
  if (!match) {
    throw new Error(`Invalid release version: ${version}`);
  }

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4]
      ? {
          channel: match[4],
          number: Number(match[5]),
        }
      : null,
  };
}

export function formatVersion(version) {
  const base = `${version.major}.${version.minor}.${version.patch}`;
  if (!version.prerelease) return base;
  return `${base}-${version.prerelease.channel}.${version.prerelease.number}`;
}

export function parseReleaseBranch(branch) {
  const normalized = normalizeBranchRef(branch);
  const match = releaseBranchPattern.exec(normalized);
  if (!match) return null;

  return {
    branch: normalized,
    major: Number(match[1]),
    minor: Number(match[2]),
  };
}

export function getReleaseChannel(version) {
  const parsed = parseVersion(version);
  return parsed.prerelease?.channel || 'stable';
}

export function isPrereleaseVersion(version) {
  return parseVersion(version).prerelease !== null;
}

function assertReleaseAction(action) {
  if (!releaseTrainActions.includes(action)) {
    throw new Error(`Unsupported release train action: ${action}`);
  }
}

function compareStableVersions(left, right) {
  for (const key of ['major', 'minor', 'patch']) {
    if (left[key] !== right[key]) return left[key] - right[key];
  }
  return 0;
}

export function findLatestStableTag(tags = []) {
  const stableTags = [];

  for (const tagRef of tags) {
    const tag = normalizeTagRef(tagRef);
    const match = stableTagPattern.exec(tag);
    if (!match) continue;

    stableTags.push({
      tag,
      version: {
        major: Number(match[1]),
        minor: Number(match[2]),
        patch: Number(match[3]),
        prerelease: null,
      },
    });
  }

  stableTags.sort((left, right) => compareStableVersions(left.version, right.version));
  return stableTags.at(-1)?.tag || '';
}

function tagExists(tags, tag) {
  return tags.map(normalizeTagRef).includes(tag);
}

function releaseBranchExists(releaseBranches, branch) {
  return releaseBranches.map(normalizeBranchRef).includes(branch);
}

function assertCurrentVersionMatchesBranch(currentVersion, branch) {
  const parsedBranch = parseReleaseBranch(branch);
  if (!parsedBranch) {
    throw new Error(`Expected release branch release/X.Y.x. Current branch: ${branch}`);
  }

  const parsedVersion = parseVersion(currentVersion);
  if (parsedVersion.major !== parsedBranch.major || parsedVersion.minor !== parsedBranch.minor) {
    throw new Error(
      `package.json version ${currentVersion} does not match branch ${parsedBranch.branch}`,
    );
  }

  return { parsedBranch, parsedVersion };
}

function assertPrereleaseChannel(version, channel, action) {
  if (version.prerelease?.channel !== channel) {
    throw new Error(`${action} requires current version X.Y.Z-${channel}.N`);
  }
}

function assertStableVersion(version, action) {
  if (version.prerelease) {
    throw new Error(`${action} requires stable current version X.Y.Z`);
  }
}

function activePrereleaseTrains(releaseBranchVersions) {
  return Object.entries(releaseBranchVersions)
    .map(([branch, version]) => ({
      branch: normalizeBranchRef(branch),
      version,
    }))
    .filter(({ version }) => {
      try {
        return isPrereleaseVersion(version);
      } catch {
        return false;
      }
    });
}

function computeStartPlan({
  action,
  baseBranch,
  currentBranch,
  tags,
  releaseBranches,
  releaseBranchVersions,
}) {
  const normalizedBaseBranch = normalizeBranchRef(baseBranch);
  if (currentBranch !== normalizedBaseBranch) {
    throw new Error(
      `start-* actions must run from ${normalizedBaseBranch}. Current branch: ${currentBranch}`,
    );
  }

  const activeTrains = activePrereleaseTrains(releaseBranchVersions);
  if (activeTrains.length > 0) {
    const details = activeTrains
      .map(({ branch, version }) => `- ${branch} (${version})`)
      .join('\n');
    throw new Error(
      `Cannot start a new release train while a prerelease train is active:\n${details}`,
    );
  }

  const lastStableTag = findLatestStableTag(tags);
  if (!lastStableTag) {
    throw new Error(
      'No stable tag found. Create an initial stable tag before using release trains.',
    );
  }

  const baseVersion = parseVersion(lastStableTag.slice(1));
  const targetMajor = action.startsWith('start-major-') ? baseVersion.major + 1 : baseVersion.major;
  const targetMinor = action.startsWith('start-major-') ? 0 : baseVersion.minor + 1;
  const targetBase = {
    major: targetMajor,
    minor: targetMinor,
    patch: 0,
    prerelease: null,
  };

  if (action.endsWith('-alpha')) {
    targetBase.prerelease = { channel: 'alpha', number: 0 };
  } else if (action.endsWith('-rc')) {
    targetBase.prerelease = { channel: 'rc', number: 0 };
  } else if (!action.endsWith('-stable')) {
    throw new Error(`Unsupported start action: ${action}`);
  }

  const targetVersion = formatVersion(targetBase);
  const targetBranch = `release/${targetMajor}.${targetMinor}.x`;
  if (releaseBranchExists(releaseBranches, targetBranch)) {
    throw new Error(`Target branch already exists: ${targetBranch}`);
  }

  return {
    lastStableTag,
    refMode: 'create',
    targetBranch,
    targetVersion,
  };
}

function computeBranchPlan({ action, currentBranch, currentVersion, tags }) {
  const { parsedBranch, parsedVersion } = assertCurrentVersionMatchesBranch(
    currentVersion,
    currentBranch,
  );
  const currentTag = `v${currentVersion}`;
  if (!tagExists(tags, currentTag)) {
    throw new Error(`Source tag ${currentTag} not found for ${action}`);
  }

  let targetVersion;

  switch (action) {
    case 'alpha-bump': {
      assertPrereleaseChannel(parsedVersion, 'alpha', action);
      targetVersion = formatVersion({
        ...parsedVersion,
        prerelease: {
          channel: 'alpha',
          number: parsedVersion.prerelease.number + 1,
        },
      });
      break;
    }
    case 'promote-rc': {
      assertPrereleaseChannel(parsedVersion, 'alpha', action);
      targetVersion = formatVersion({
        ...parsedVersion,
        prerelease: { channel: 'rc', number: 0 },
      });
      break;
    }
    case 'rc-bump': {
      assertPrereleaseChannel(parsedVersion, 'rc', action);
      targetVersion = formatVersion({
        ...parsedVersion,
        prerelease: {
          channel: 'rc',
          number: parsedVersion.prerelease.number + 1,
        },
      });
      break;
    }
    case 'stable': {
      if (!parsedVersion.prerelease) {
        throw new Error('stable requires current version X.Y.Z-alpha.N or X.Y.Z-rc.N');
      }
      targetVersion = formatVersion({ ...parsedVersion, prerelease: null });
      break;
    }
    case 'patch': {
      assertStableVersion(parsedVersion, action);
      targetVersion = formatVersion({
        ...parsedVersion,
        patch: parsedVersion.patch + 1,
      });
      break;
    }
    case 'patch-alpha-start': {
      assertStableVersion(parsedVersion, action);
      targetVersion = formatVersion({
        ...parsedVersion,
        patch: parsedVersion.patch + 1,
        prerelease: { channel: 'alpha', number: 0 },
      });
      break;
    }
    case 'patch-rc-start': {
      assertStableVersion(parsedVersion, action);
      targetVersion = formatVersion({
        ...parsedVersion,
        patch: parsedVersion.patch + 1,
        prerelease: { channel: 'rc', number: 0 },
      });
      break;
    }
    default:
      throw new Error(`${action} must run from ${parsedBranch.branch}`);
  }

  return {
    lastStableTag: findLatestStableTag(tags),
    refMode: 'update',
    targetBranch: parsedBranch.branch,
    targetVersion,
  };
}

export function computeReleasePlan({
  action,
  baseBranch = 'master',
  currentBranch,
  currentVersion,
  dryRun = true,
  releaseBranches = [],
  releaseBranchVersions = {},
  tags = [],
}) {
  assertReleaseAction(action);
  if (!currentBranch) throw new Error('currentBranch is required');
  if (!currentVersion) throw new Error('currentVersion is required');

  const normalizedCurrentBranch = normalizeBranchRef(currentBranch);
  const plan = action.startsWith('start-')
    ? computeStartPlan({
        action,
        baseBranch,
        currentBranch: normalizedCurrentBranch,
        releaseBranches,
        releaseBranchVersions,
        tags,
      })
    : computeBranchPlan({
        action,
        currentBranch: normalizedCurrentBranch,
        currentVersion,
        tags,
      });

  const targetVersion = parseVersion(plan.targetVersion);
  const parsedTargetBranch = parseReleaseBranch(plan.targetBranch);
  if (
    parsedTargetBranch?.major !== targetVersion.major ||
    parsedTargetBranch?.minor !== targetVersion.minor
  ) {
    throw new Error(
      `Target version ${plan.targetVersion} does not match target branch ${plan.targetBranch}`,
    );
  }

  const tag = `v${plan.targetVersion}`;
  if (tagExists(tags, tag)) {
    throw new Error(`Tag already exists: ${tag}`);
  }

  return {
    action,
    baseBranch,
    channel: getReleaseChannel(plan.targetVersion),
    currentBranch: normalizedCurrentBranch,
    currentVersion,
    dryRun: Boolean(dryRun),
    isPrerelease: Boolean(targetVersion.prerelease),
    lastStableTag: plan.lastStableTag,
    refMode: plan.refMode,
    shouldRelease: true,
    tag,
    targetBranch: plan.targetBranch,
    targetVersion: plan.targetVersion,
  };
}

export function formatReleasePlanSummary(plan) {
  return [
    'Release train plan',
    `Action: ${plan.action}`,
    `Mode: ${plan.dryRun ? 'dry-run' : 'write'}`,
    `Current branch: ${plan.currentBranch}`,
    `Current version: ${plan.currentVersion}`,
    `Last stable tag: ${plan.lastStableTag || '(none)'}`,
    `Target branch: ${plan.targetBranch}`,
    `Target version: ${plan.targetVersion}`,
    `Tag: ${plan.tag}`,
    `Channel: ${plan.channel}`,
    `Ref mode: ${plan.refMode}`,
  ].join('\n');
}
