const DEFAULT_NATIVE_CANDIDATE_LIMIT = 6;

export const resolveNativeCandidateLimitConfig = (option, holdoutStatus) => {
  if (option === undefined) {
    return { candidateLimit: DEFAULT_NATIVE_CANDIDATE_LIMIT, childEnvironment: {} };
  }

  if (holdoutStatus !== 'development_source_bound') {
    throw new Error('candidate-limit override is permitted only for development_source_bound runs');
  }

  const match = /^--dev-candidate-limit=(1[0-9]|20|[1-9])$/u.exec(option);
  if (!match) {
    throw new Error('invalid candidate-limit option; expected --dev-candidate-limit=<integer from 1 to 20>');
  }

  const candidateLimit = Number(match[1]);
  return {
    candidateLimit,
    childEnvironment: { ACE_CONTEXT_CANDIDATE_LIMIT: String(candidateLimit) },
  };
};

export const assertNativeCandidateLimitEvidence = (candidateLimit, holdoutStatus) => {
  if (candidateLimit === undefined) return;
  if (!Number.isSafeInteger(candidateLimit) || candidateLimit < 1 || candidateLimit > 20) {
    throw new Error('candidate-limit evidence must be an integer from 1 to 20');
  }
  if (holdoutStatus !== 'development_source_bound' && candidateLimit !== DEFAULT_NATIVE_CANDIDATE_LIMIT) {
    throw new Error('frozen release holdout evidence must use the default candidate limit of 6');
  }
};
