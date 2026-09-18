import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { checkRepo } from '../scripts/check.mjs';
import { validateConfig } from '../scripts/config.mjs';

test('the repository satisfies documentation and workflow checks', async () => {
  assert.deepEqual(await checkRepo('.'), []);
});

test('validateConfig accepts the dual-member limits used in production', () => {
  const config = validateConfig({
    repository: 'ramincsy/Gthub-Achievements',
    participants: ['ramincsy', 'backrebital-lgtm'],
    readyLabel: 'ready-for-work',
    blockedLabel: 'blocked',
    maxAssignedPerPerson: 2,
    maxPullsPerRun: 20,
    maxMutationsPerRun: 6
  });
  assert.equal(config.participants.length, 2);
});

test('validateConfig rejects a single participant or an out-of-range cap', () => {
  const base = {
    repository: 'ramincsy/Gthub-Achievements',
    participants: ['ramincsy', 'backrebital-lgtm'],
    readyLabel: 'ready-for-work',
    blockedLabel: 'blocked',
    maxAssignedPerPerson: 2,
    maxPullsPerRun: 20,
    maxMutationsPerRun: 6
  };
  assert.throws(() => validateConfig({ ...base, participants: ['ramincsy'] }), /Two distinct/);
  assert.throws(() => validateConfig({ ...base, maxPullsPerRun: 0 }), /Invalid limit/);
});

test('checkRepo requires privileged workflows to check out the default branch', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'check-priv-'));
  const sha = 'a'.repeat(40);
  try {
    await mkdir(path.join(root, '.github', 'workflows'), { recursive: true });
    await writeFile(path.join(root, '.github', 'workflows', 'priv.yml'), [
      'name: priv',
      'on: pull_request',
      'permissions:',
      '  pull-requests: write',
      'jobs:',
      '  request:',
      '    runs-on: ubuntu-latest',
      '    steps:',
      `      - uses: actions/checkout@${sha}`,
      '        with:',
      '          persist-credentials: false',
      `      - uses: actions/setup-node@${sha}`,
      '        with:',
      "          node-version: '22'"
    ].join('\n'));
    const errors = await checkRepo(root);
    assert.ok(errors.some(e => /privileged workflows must check out the default branch/.test(e)));
    assert.ok(errors.some(e => /privileged workflows must disable unsafe PR checkout/.test(e)));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('checkRepo reports missing files and token-like strings', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'check-'));
  try {
    await mkdir(path.join(root, 'docs', 'examples'), { recursive: true });
    await mkdir(path.join(root, 'config'), { recursive: true });
    await writeFile(path.join(root, 'README.md'), `leak ${['ghp', 'a'.repeat(36)].join('_')} extra`);
    const errors = await checkRepo(root);
    assert.ok(errors.some(e => e.includes('missing required file')));
    assert.ok(errors.some(e => /looks like a GitHub token/.test(e)));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
