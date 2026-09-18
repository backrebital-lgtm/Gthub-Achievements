import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';

function assertPinned(source) {
  for (const action of source.matchAll(/uses: ([^\s]+)/g)) assert.match(action[1], /@[a-f0-9]{40}$/);
}

test('privileged coordinator checks out trusted default branch, never PR code', async () => {
  const source = await readFile(new URL('../.github/workflows/hourly-maintenance.yml', import.meta.url), 'utf8');
  assert.match(source, /pull_request_target:/);
  assert.match(source, /pull_request_review:/);
  assert.match(source, /types: \[submitted, dismissed\]/);
  assert.match(source, /github\.event\.review\.state != 'commented'/);
  assert.match(source, /github\.event\.pull_request\.head\.repo\.full_name == github\.repository/);
  assert.match(source, /ref: \$\{\{ github\.event\.repository\.default_branch \}\}/);
  assert.match(source, /persist-credentials: false/);
  assert.match(source, /allow-unsafe-pr-checkout: false/);
  assert.match(source, /scripts\/coordinate\.mjs/);
  assert.match(source, /cron: '17 \* \* \* \*'/);
  assert.doesNotMatch(source, /github\.head_ref|secrets\./);
  assert.doesNotMatch(source, /ref: \$\{\{ github\.event\.pull_request/);
  assertPinned(source);
});

test('CI is read-only, unprivileged and pinned', async () => {
  const source = await readFile(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
  assert.match(source, /pull_request:/);
  assert.doesNotMatch(source, /pull_request_target:/);
  assert.match(source, /permissions:\s*contents: read/);
  assert.match(source, /persist-credentials: false/);
  assert.match(source, /fetch-depth:\s*0/);
  assert.match(source, /npm test/);
  assert.match(source, /npm run check/);
  assert.match(source, /npm run coauthor/);
  assert.doesNotMatch(source, /GH_TOKEN|secrets\./);
  assertPinned(source);
});

test('collaboration workflows are pinned, PAT-free, and do not farm empty PRs or stars', async () => {
  const dir = new URL('../.github/workflows/', import.meta.url);
  const files = (await readdir(dir)).filter(name => name.endsWith('.yml')).sort();
  assert.deepEqual(files, [
    'ci.yml',
    'coauthor-validate.yml',
    'hourly-maintenance.yml',
    'peer-review.yml',
    'progress-report.yml'
  ]);
  for (const name of files) {
    const source = await readFile(new URL(name, dir), 'utf8');
    for (const action of source.matchAll(/uses: ([^\s]+)/g)) assert.match(action[1], /@[a-f0-9]{40}$/);
    assert.doesNotMatch(source, /secrets\./);
    assert.doesNotMatch(source, /personal.?access.?token|GH_PAT|ghp_/i);
    assert.doesNotMatch(source, /\/starred|stargazers/);
    assert.doesNotMatch(source, /cookie|puppeteer|playwright/i);
  }
  const progress = await readFile(new URL('progress-report.yml', dir), 'utf8');
  assert.match(progress, /scripts\/progress\.mjs/);
  assert.match(progress, /ref: \$\{\{ github\.event\.repository\.default_branch \}\}/);
  assert.match(progress, /allow-unsafe-pr-checkout: false/);
  assert.doesNotMatch(progress, /issues:\s*write|pull-requests:\s*write/);
  const peer = await readFile(new URL('peer-review.yml', dir), 'utf8');
  assert.match(peer, /scripts\/peer-review\.mjs/);
  assert.match(peer, /ref: \$\{\{ github\.event\.repository\.default_branch \}\}/);
  assert.match(peer, /allow-unsafe-pr-checkout: false/);
  assert.match(peer, /github\.event\.pull_request\.draft == false/);
  assert.doesNotMatch(peer, /user\.login == 'ramincsy'/);
  assert.doesNotMatch(peer, /pull_request_target:/);
  assert.doesNotMatch(peer, /ref: \$\{\{ github\.event\.pull_request/);
  assert.doesNotMatch(peer, /merge|approve/i);
  const pair = await readFile(new URL('coauthor-validate.yml', dir), 'utf8');
  assert.match(pair, /scripts\/coauthor\.mjs/);
  assert.match(pair, /ref: \$\{\{ github\.event\.repository\.default_branch \}\}/);
  assert.match(pair, /allow-unsafe-pr-checkout: false/);
  assert.doesNotMatch(pair, /pull_request_target:/);
  assert.doesNotMatch(pair, /ref: \$\{\{ github\.event\.pull_request/);
  assert.doesNotMatch(pair, /github\.head_ref/);
});

test('token-bearing workflows check out the trusted default branch; CI does not use GH_TOKEN', async () => {
  const dir = new URL('../.github/workflows/', import.meta.url);
  for (const name of ['hourly-maintenance.yml', 'peer-review.yml', 'coauthor-validate.yml', 'progress-report.yml']) {
    const source = await readFile(new URL(name, dir), 'utf8');
    assert.match(source, /GH_TOKEN: \$\{\{ github\.token \}\}/);
    assert.match(source, /ref: \$\{\{ github\.event\.repository\.default_branch \}\}/);
    assert.match(source, /allow-unsafe-pr-checkout: false/);
    assert.doesNotMatch(source, /github\.head_ref/);
    assert.doesNotMatch(source, /ref: \$\{\{ github\.event\.pull_request/);
  }
  const ci = await readFile(new URL('ci.yml', dir), 'utf8');
  assert.doesNotMatch(ci, /GH_TOKEN/);
  assert.doesNotMatch(ci, /issues:\s*write|pull-requests:\s*write/);
});

test('CI and co-author checks run when a draft PR is marked ready', async () => {
  for (const name of ['ci.yml', 'coauthor-validate.yml']) {
    const source = await readFile(new URL(`../.github/workflows/${name}`, import.meta.url), 'utf8');
    assert.match(source, /ready_for_review/);
  }
});

test('Q&A discussion template is honest and does not fabricate accepted answers', async () => {
  const source = await readFile(new URL('../.github/DISCUSSION_TEMPLATE/q-a.yml', import.meta.url), 'utf8');
  assert.match(source, /پرسش واقعی/);
  assert.match(source, /Galaxy Brain ساخته نشده/);
  assert.doesNotMatch(source, /accepted.?answer|mark as answer/i);
});
