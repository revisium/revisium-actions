export function resolveActionlintResult(result) {
  if (result.error?.code === 'ENOENT') {
    return {
      exitCode: 0,
      warnings: [
        'actionlint binary was not found locally.',
        'CI runs raven-actions/actionlint against workflows and examples.',
      ],
    };
  }

  if (result.error) {
    throw result.error;
  }

  if (result.status === null) {
    const signal = result.signal || 'unknown signal';
    return {
      exitCode: 1,
      errors: [`actionlint terminated by ${signal}`],
    };
  }

  return {
    exitCode: result.status,
  };
}
