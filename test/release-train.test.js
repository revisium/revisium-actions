import assert from 'node:assert/strict';
import test from 'node:test';

import {
  computeReleasePlan,
  findLatestStableTag,
  formatReleasePlanSummary,
  getReleaseChannel,
  inferLatestReleaseBranchVersion,
  normalizeBranchRef,
  parseVersion,
} from '../src/release-train.js';

const basePlan = {
  action: 'start-minor-alpha',
  baseBranch: 'master',
  currentBranch: 'master',
  currentVersion: '0.1.2',
  dryRun: true,
  releaseBranches: [],
  releaseBranchVersions: {},
  tags: ['v0.1.0', 'v0.1.2', 'v0.1.1-alpha.0'],
};

test('parseVersion supports stable, alpha, and rc versions', () => {
  assert.deepEqual(parseVersion('1.2.3'), {
    major: 1,
    minor: 2,
    patch: 3,
    prerelease: null,
  });
  assert.deepEqual(parseVersion('1.2.3-alpha.4'), {
    major: 1,
    minor: 2,
    patch: 3,
    prerelease: { channel: 'alpha', number: 4 },
  });
  assert.deepEqual(parseVersion('1.2.3-rc.0'), {
    major: 1,
    minor: 2,
    patch: 3,
    prerelease: { channel: 'rc', number: 0 },
  });
  assert.throws(() => parseVersion('1.2.3-beta.0'), /Invalid release version/);
});

test('findLatestStableTag ignores prerelease tags', () => {
  assert.equal(findLatestStableTag(['v0.2.0-alpha.0', 'v0.1.9', 'v0.1.10']), 'v0.1.10');
});

test('inferLatestReleaseBranchVersion selects the latest reachable tag on the branch line', () => {
  assert.equal(
    inferLatestReleaseBranchVersion({
      branch: 'release/0.2.x',
      tags: ['v0.1.9', 'v0.2.0-alpha.0', 'v0.2.0-rc.0', 'v0.3.0', 'v0.2.0'],
    }),
    '0.2.0',
  );
});

test('inferLatestReleaseBranchVersion does not pick tags from another release line', () => {
  assert.equal(
    inferLatestReleaseBranchVersion({
      branch: 'release/0.2.x',
      tags: ['v0.3.0', 'v1.0.0-alpha.0'],
    }),
    '',
  );
});

test('normalizeBranchRef removes local and origin prefixes', () => {
  assert.equal(normalizeBranchRef('refs/heads/release/1.2.x'), 'release/1.2.x');
  assert.equal(normalizeBranchRef('refs/remotes/origin/release/1.2.x'), 'release/1.2.x');
  assert.equal(normalizeBranchRef('origin/release/1.2.x'), 'release/1.2.x');
});

test('computeReleasePlan starts a minor alpha train from master', () => {
  const plan = computeReleasePlan(basePlan);

  assert.deepEqual(
    {
      channel: plan.channel,
      isPrerelease: plan.isPrerelease,
      refMode: plan.refMode,
      tag: plan.tag,
      targetBranch: plan.targetBranch,
      targetVersion: plan.targetVersion,
    },
    {
      channel: 'alpha',
      isPrerelease: true,
      refMode: 'create',
      tag: 'v0.2.0-alpha.0',
      targetBranch: 'release/0.2.x',
      targetVersion: '0.2.0-alpha.0',
    },
  );
});

test('computeReleasePlan normalizes base branch refs for start actions', () => {
  const plan = computeReleasePlan({
    ...basePlan,
    baseBranch: 'refs/heads/master',
    currentBranch: 'origin/master',
  });

  assert.equal(plan.targetBranch, 'release/0.2.x');
  assert.equal(plan.targetVersion, '0.2.0-alpha.0');
});

test('computeReleasePlan starts a major stable train from master', () => {
  const plan = computeReleasePlan({
    ...basePlan,
    action: 'start-major-stable',
  });

  assert.equal(plan.targetBranch, 'release/1.0.x');
  assert.equal(plan.targetVersion, '1.0.0');
  assert.equal(plan.channel, 'stable');
  assert.equal(plan.isPrerelease, false);
});

test('computeReleasePlan rejects start actions outside base branch', () => {
  assert.throws(
    () =>
      computeReleasePlan({
        ...basePlan,
        currentBranch: 'release/0.1.x',
      }),
    /start-\* actions must run from master/,
  );
});

test('computeReleasePlan rejects starting while a prerelease train is active', () => {
  assert.throws(
    () =>
      computeReleasePlan({
        ...basePlan,
        releaseBranches: ['origin/release/0.2.x'],
        releaseBranchVersions: {
          'origin/release/0.2.x': '0.2.0-rc.0',
        },
      }),
    /Cannot start a new release train/,
  );
});

test('computeReleasePlan suggests bootstrap-stable when no stable tag exists', () => {
  assert.throws(
    () =>
      computeReleasePlan({
        ...basePlan,
        tags: [],
      }),
    /bootstrap-stable workflow/,
  );
});

test('computeReleasePlan rejects duplicate target branches and tags', () => {
  assert.throws(
    () =>
      computeReleasePlan({
        ...basePlan,
        releaseBranches: ['release/0.2.x'],
      }),
    /Target branch already exists/,
  );

  assert.throws(
    () =>
      computeReleasePlan({
        ...basePlan,
        tags: ['v0.1.2', 'v0.2.0-alpha.0'],
      }),
    /Tag already exists: v0\.2\.0-alpha\.0/,
  );
});

test('computeReleasePlan handles release branch transitions', () => {
  const common = {
    baseBranch: 'master',
    currentBranch: 'release/0.2.x',
    dryRun: true,
    releaseBranches: ['release/0.2.x'],
    releaseBranchVersions: {
      'release/0.2.x': '0.2.0-alpha.0',
    },
    tags: ['v0.1.2'],
  };
  const planBranchTransition = (action, currentVersion) =>
    computeReleasePlan({
      ...common,
      action,
      currentVersion,
      tags: [...common.tags, `v${currentVersion}`],
    }).targetVersion;

  assert.equal(planBranchTransition('alpha-bump', '0.2.0-alpha.0'), '0.2.0-alpha.1');
  assert.equal(planBranchTransition('promote-rc', '0.2.0-alpha.1'), '0.2.0-rc.0');
  assert.equal(planBranchTransition('rc-bump', '0.2.0-rc.0'), '0.2.0-rc.1');
  assert.equal(planBranchTransition('stable', '0.2.0-rc.1'), '0.2.0');
  assert.equal(planBranchTransition('patch', '0.2.0'), '0.2.1');
  assert.equal(planBranchTransition('patch-alpha-start', '0.2.0'), '0.2.1-alpha.0');
  assert.equal(planBranchTransition('patch-rc-start', '0.2.0'), '0.2.1-rc.0');
});

test('computeReleasePlan supports tag-inferred release branch transitions', () => {
  const common = {
    baseBranch: 'master',
    currentBranch: 'release/0.2.x',
    dryRun: true,
    releaseBranches: ['release/0.2.x'],
    releaseBranchVersions: {
      'release/0.2.x': '0.2.0-alpha.0',
    },
    tags: ['v0.1.2', 'v0.2.0-alpha.0'],
  };
  const planTagTransition = (action, currentVersion, tags = [`v${currentVersion}`]) =>
    computeReleasePlan({
      ...common,
      action,
      currentVersion,
      releaseBranchVersions: {
        'release/0.2.x': currentVersion,
      },
      sourceTags: tags,
      tags: [...common.tags, ...tags],
    }).targetVersion;

  assert.equal(planTagTransition('alpha-bump', '0.2.0-alpha.0'), '0.2.0-alpha.1');
  assert.equal(planTagTransition('promote-rc', '0.2.0-alpha.1'), '0.2.0-rc.0');
  assert.equal(planTagTransition('rc-bump', '0.2.0-rc.0'), '0.2.0-rc.1');
  assert.equal(planTagTransition('stable', '0.2.0-rc.1'), '0.2.0');
  assert.equal(planTagTransition('patch', '0.2.0'), '0.2.1');
  assert.equal(planTagTransition('patch-alpha-start', '0.2.0'), '0.2.1-alpha.0');
  assert.equal(planTagTransition('patch-rc-start', '0.2.0'), '0.2.1-rc.0');
});

test('computeReleasePlan checks duplicate target tags globally when source tags are reachable-only', () => {
  assert.throws(
    () =>
      computeReleasePlan({
        ...basePlan,
        action: 'patch',
        currentBranch: 'release/0.2.x',
        currentVersion: '0.2.0',
        releaseBranches: ['release/0.2.x'],
        releaseBranchVersions: {
          'release/0.2.x': '0.2.0',
        },
        sourceTags: ['v0.2.0'],
        tags: ['v0.2.0', 'v0.2.1'],
      }),
    /Tag already exists: v0\.2\.1/,
  );
});

test('computeReleasePlan active prerelease gate ignores stable release branches', () => {
  const plan = computeReleasePlan({
    ...basePlan,
    releaseBranches: ['release/0.1.x'],
    releaseBranchVersions: {
      'release/0.1.x': '0.1.2',
    },
  });

  assert.equal(plan.targetBranch, 'release/0.2.x');
});

test('computeReleasePlan rejects patch prerelease starts from master', () => {
  assert.throws(
    () =>
      computeReleasePlan({
        ...basePlan,
        action: 'patch-alpha-start',
        currentBranch: 'master',
        currentVersion: '0.1.2',
        tags: ['v0.1.2'],
      }),
    /Expected release branch release\/X\.Y\.x/,
  );
  assert.throws(
    () =>
      computeReleasePlan({
        ...basePlan,
        action: 'patch-rc-start',
        currentBranch: 'master',
        currentVersion: '0.1.2',
        tags: ['v0.1.2'],
      }),
    /Expected release branch release\/X\.Y\.x/,
  );
});

test('computeReleasePlan rejects branch transitions without source tags', () => {
  assert.throws(
    () =>
      computeReleasePlan({
        ...basePlan,
        action: 'alpha-bump',
        currentBranch: 'release/0.2.x',
        currentVersion: '0.2.0-alpha.0',
        releaseBranches: ['release/0.2.x'],
        releaseBranchVersions: {
          'release/0.2.x': '0.2.0-alpha.0',
        },
        tags: ['v0.1.2'],
      }),
    /Source tag v0\.2\.0-alpha\.0 not found for alpha-bump/,
  );
});

test('computeReleasePlan validates release branch version line', () => {
  assert.throws(
    () =>
      computeReleasePlan({
        ...basePlan,
        action: 'patch',
        currentBranch: 'release/0.2.x',
        currentVersion: '0.3.0',
      }),
    /does not match branch release\/0\.2\.x/,
  );
});

test('getReleaseChannel and formatReleasePlanSummary describe the plan', () => {
  assert.equal(getReleaseChannel('1.0.0'), 'stable');
  assert.equal(getReleaseChannel('1.0.0-alpha.0'), 'alpha');

  const summary = formatReleasePlanSummary(computeReleasePlan(basePlan));
  assert.match(summary, /Release train plan/);
  assert.doesNotMatch(summary, /Current version:/);
  assert.match(summary, /Target version: 0\.2\.0-alpha\.0/);
});
