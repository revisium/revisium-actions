import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveActionlintResult } from '../src/actionlint-result.js';

test('resolveActionlintResult preserves normal exit status', () => {
  assert.deepEqual(resolveActionlintResult({ status: 0 }), { exitCode: 0 });
  assert.deepEqual(resolveActionlintResult({ status: 2 }), { exitCode: 2 });
});

test('resolveActionlintResult skips missing local binary', () => {
  assert.deepEqual(resolveActionlintResult({ error: { code: 'ENOENT' } }), {
    exitCode: 0,
    warnings: [
      'actionlint binary was not found locally.',
      'CI runs raven-actions/actionlint against workflows and examples.',
    ],
  });
});

test('resolveActionlintResult treats signal termination as failure', () => {
  assert.deepEqual(resolveActionlintResult({ status: null, signal: 'SIGTERM' }), {
    exitCode: 1,
    errors: ['actionlint terminated by SIGTERM'],
  });
});

test('resolveActionlintResult rethrows spawn errors other than missing binary', () => {
  const error = new Error('spawn failed');
  assert.throws(() => resolveActionlintResult({ error }), /spawn failed/);
});
