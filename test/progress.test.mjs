import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { communityTier, mergedPullCounts, renderProgress, collectMergedPulls } from '../scripts/progress.mjs';

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
    generatedAt: '2026-09-18T00:00:00Z'
  });
  assert.match(report, /گزارش جامعه/);
  assert.match(report, /Issue یا PR نمی‌سازد/);
  assert.doesNotMatch(report, /workflow_dispatch.*creat/i);
  const routes = [];
  await collectMergedPulls(async route => {
    routes.push(route);
    return [];
  }, 'ramincsy/Gthub-Achievements');
  assert.equal(routes.length, 1);
  assert.match(routes[0], /\/pulls\?state=closed&per_page=100&page=1$/);
});
