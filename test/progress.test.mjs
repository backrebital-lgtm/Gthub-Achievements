import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  communityTier,
  mergedPullCounts,
  pairPathStats,
  renderProgress,
  collectMergedPulls,
  collectPairPullCommits
} from '../scripts/progress.mjs';

const tiers = [2, 16, 128, 1024];

test('community tiers stay informational and never invent an official catalog', () => {
  assert.deepEqual(communityTier(0, tiers), { count: 0, reached: null, next: 2, remaining: 2 });
  assert.deepEqual(communityTier(2, tiers), { count: 2, reached: 2, next: 16, remaining: 14 });
  assert.deepEqual(communityTier(1024, tiers), { count: 1024, reached: 1024, next: null, remaining: 0 });
});

test('counts merged PRs per author and ignores closed-unmerged work', () => {
  const stats = mergedPullCounts([
    { merged_at: '2026-09-18T00:00:00Z', user: { login: 'ramincsy' } },
    { merged_at: '2026-09-18T00:00:00Z', user: { login: 'backrebital-lgtm' } },
    { merged_at: '2026-09-18T00:00:00Z', user: { login: 'outsider' } },
    { merged_at: null, state: 'closed', user: { login: 'ramincsy' } }
  ], ['ramincsy', 'backrebital-lgtm']);
  assert.deepEqual(stats, { counts: { ramincsy: 1, 'backrebital-lgtm': 1 }, merged: 3, closedUnmerged: 1 });
});

test('progress report is read-only and labels community thresholds as unofficial', async () => {
  const config = JSON.parse(await readFile(new URL('../config/achievements.json', import.meta.url), 'utf8'));
  const report = renderProgress({
    repository: 'ramincsy/Gthub-Achievements',
    counts: { ramincsy: 2, 'backrebital-lgtm': 0 },
    merged: 2,
    closedUnmerged: 1,
    tiers: config.pullShark.tiers,
    pairTiers: config.pairExtraordinaire.tiers,
    pair: {
      counts: { ramincsy: 0, 'backrebital-lgtm': 1 },
      pairCommits: 1,
      pairPulls: 1,
      malformedTrailers: 0
    },
    generatedAt: '2026-09-18T00:00:00Z'
  });
  assert.match(report, /گزارش جامعه/);
  assert.match(report, /Issue یا PR نمی‌سازد/);
  assert.match(report, /Pair Extraordinaire/);
  assert.match(report, /انسان مستقل نیست/);
  assert.match(report, /1, 10, 24, 48/);
  assert.doesNotMatch(report, /workflow_dispatch.*creat/i);
  const routes = [];
  await collectMergedPulls(async route => {
    routes.push(route);
    return [];
  }, 'ramincsy/Gthub-Achievements');
  assert.equal(routes.length, 1);
  assert.match(routes[0], /\/pulls\?state=closed&per_page=100&page=1$/);
});

test('pair path counts well-formed peer noreply trailers and skips placeholders', () => {
  const participants = ['ramincsy', 'backrebital-lgtm'];
  const stats = pairPathStats([
    {
      number: 9,
      commits: [{
        sha: 'aaa',
        authorLogin: 'ramincsy',
        authorEmail: '34828058+ramincsy@users.noreply.github.com',
        message: 'Shared docs\n\nCo-authored-by: backrebital-lgtm <329678572+backrebital-lgtm@users.noreply.github.com>'
      }]
    },
    {
      number: 10,
      commits: [{
        sha: 'bbb',
        authorLogin: 'ramincsy',
        authorEmail: '34828058+ramincsy@users.noreply.github.com',
        message: 'Fake pair\n\nCo-authored-by: backrebital-lgtm <name@example.com>'
      }]
    },
    {
      number: 11,
      commits: [{
        sha: 'ccc',
        authorLogin: 'ramincsy',
        authorEmail: '34828058+ramincsy@users.noreply.github.com',
        message: 'Self trailer\n\nCo-authored-by: ramincsy <34828058+ramincsy@users.noreply.github.com>'
      }]
    }
  ], participants);
  assert.deepEqual(stats, {
    counts: { ramincsy: 0, 'backrebital-lgtm': 1 },
    pairCommits: 1,
    pairPulls: 1,
    malformedTrailers: 2
  });
});

test('pair path attributes both members when a bot authored the commit', () => {
  const stats = pairPathStats([{
    number: 12,
    commits: [{
      sha: 'ddd',
      authorLogin: 'cursor[bot]',
      authorEmail: 'cursoragent@cursor.com',
      message: [
        'Shared fix',
        '',
        'Co-authored-by: ramincsy <34828058+ramincsy@users.noreply.github.com>',
        'Co-authored-by: backrebital-lgtm <329678572+backrebital-lgtm@users.noreply.github.com>'
      ].join('\n')
    }]
  }], ['ramincsy', 'backrebital-lgtm']);
  assert.equal(stats.pairCommits, 1);
  assert.equal(stats.pairPulls, 1);
  assert.deepEqual(stats.counts, { ramincsy: 1, 'backrebital-lgtm': 1 });
});

test('collectPairPullCommits reads merged pull commits only and refuses a bad repo', async () => {
  const routes = [];
  const pulls = [
    { number: 8, merged_at: '2026-09-18T00:00:00Z' },
    { number: 7, merged_at: null },
    { number: 9, merged_at: '2026-09-18T01:00:00Z' }
  ];
  const pages = await collectPairPullCommits(async route => {
    routes.push(route);
    return [{ sha: '1', commit: { message: 'ok', author: { email: 'a@b.co' } }, author: { login: 'ramincsy' } }];
  }, 'ramincsy/Gthub-Achievements', pulls);
  assert.deepEqual(pages.map(item => item.number), [8, 9]);
  assert.equal(routes.length, 2);
  assert.match(routes[0], /\/pulls\/8\/commits\?per_page=100&page=1$/);
  assert.match(routes[1], /\/pulls\/9\/commits\?per_page=100&page=1$/);
  await assert.rejects(collectPairPullCommits(async () => [], '../evil/x', []), /repository/);
});
