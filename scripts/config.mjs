export function validateConfig(config) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) throw new Error('Collaboration config is required.');
  if (typeof config.repository !== 'string' || !/^[\w.-]+\/[\w.-]+$/.test(config.repository)) {
    throw new Error('A repository of the form owner/name is required.');
  }
  if (!Array.isArray(config.participants) || config.participants.length !== 2
    || new Set(config.participants).size !== 2
    || !config.participants.every(p => typeof p === 'string' && /^[A-Za-z0-9-]+$/.test(p))) {
    throw new Error('Two distinct GitHub participants are required.');
  }
  for (const field of ['readyLabel', 'blockedLabel']) {
    if (typeof config[field] !== 'string' || !config[field].trim()) throw new Error(`Invalid label: ${field}`);
  }
  for (const field of ['maxAssignedPerPerson', 'maxPullsPerRun', 'maxMutationsPerRun']) {
    if (!Number.isInteger(config[field]) || config[field] < 1 || config[field] > 100) throw new Error(`Invalid limit: ${field}`);
  }
  return config;
}
