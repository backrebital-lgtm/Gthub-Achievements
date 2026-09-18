import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('privileged coordinator checks out trusted default branch, never PR code', async () => {
  const source = await readFile(new URL('../.github/workflows/hourly-maintenance.yml', import.meta.url), 'utf8');
  assert.match(source, /pull_request_target:/);
  assert.match(source, /ref: \$\{\{ github\.event\.repository\.default_branch \}\}/);
  assert.match(source, /persist-credentials: false/);
  assert.doesNotMatch(source, /pull_request\.head|github\.head_ref|secrets\./);
  for (const action of source.matchAll(/uses: ([^\s]+)/g)) assert.match(action[1], /@[a-f0-9]{40}$/);
});
