import test from 'node:test';
import assert from 'node:assert/strict';
import { requestPeerReview, renderPeerReviewSummary } from '../scripts/peer-review.mjs';

const participants = ['ramincsy', 'backrebital-lgtm'];
const pull = {
  number: 12,
  draft: false,
  state: 'open',
  head: { sha: 'abc' },
  user: { login: 'ramincsy' },
  requested_reviewers: []
};
const botPull = { ...pull, user: { login: 'cursor[bot]' } };
const dualTrailers = [{
  sha: 'def',
  commit: {
    message: [
      'feat: request peer review on agent PRs',
      '',
      'Co-authored-by: ramincsy <34828058+ramincsy@users.noreply.github.com>',
      'Co-authored-by: backrebital-lgtm <329678572+backrebital-lgtm@users.noreply.github.com>'
    ].join('\n'),
    author: { email: 'cursoragent@cursor.com' }
  },
  author: { login: 'cursor[bot]' }
}];

function apiFor(current, { reviews = [], commits, writeError } = {}) {
  const writes = [];
  const reads = [];
  const api = async (route, options) => {
    if (options) {
      writes.push({ route, ...options });
      if (writeError) throw writeError;
      return {};
    }
    reads.push(route);
    if (route.endsWith('/pulls/12')) return current;
    if (route.includes('/commits')) {
      if (commits === undefined) throw new Error(`Unexpected route ${route}`);
      return commits;
    }
    if (route.includes('/reviews')) return reviews;
    throw new Error(`Unexpected route ${route}`);
  };
  return { api, writes, reads };
}

test('requests the other member and treats a 422 as already requested', async () => {
  const first = apiFor(pull);
  assert.deepEqual(await requestPeerReview(first.api, 'owner/repo', '12', participants), {
    status: 'requested', reviewer: 'backrebital-lgtm', author: 'ramincsy'
  });
  assert.equal(first.writes[0].method, 'POST');
  assert.deepEqual(first.writes[0].body, { reviewers: ['backrebital-lgtm'] });
  assert.equal(first.reads.some(route => route.includes('/commits')), false);

  const raced = apiFor(pull, { writeError: new Error('GitHub API POST failed: HTTP 422') });
  assert.equal((await requestPeerReview(raced.api, 'owner/repo', '12', participants)).status, 'already-requested');
});

test('skips drafts, existing requests, and does not approve or merge', async () => {
  for (const current of [
    { ...pull, draft: true },
    { ...pull, requested_reviewers: [{ login: 'backrebital-lgtm' }] }
  ]) {
    const mock = apiFor(current);
    assert.equal((await requestPeerReview(mock.api, 'owner/repo', '12', participants)).status, 'skipped');
    assert.equal(mock.writes.length, 0);
  }
  const summary = renderPeerReviewSummary({ status: 'requested', reviewer: 'backrebital-lgtm', author: 'ramincsy' });
  assert.match(summary, /does not approve or merge/);
  await assert.rejects(requestPeerReview(apiFor(pull).api, 'owner/repo', '12a', participants), /numeric/);
});

test('bot-authored PR with dual member trailers requests a member who is not already a reviewer', async () => {
  const mock = apiFor(botPull, { commits: dualTrailers });
  assert.deepEqual(await requestPeerReview(mock.api, 'owner/repo', '12', participants), {
    status: 'requested', reviewer: 'ramincsy', author: 'cursor[bot]'
  });
  assert.equal(mock.writes[0].method, 'POST');
  assert.deepEqual(mock.writes[0].body, { reviewers: ['ramincsy'] });

  const already = apiFor(
    { ...botPull, requested_reviewers: [{ login: 'ramincsy' }] },
    { commits: dualTrailers }
  );
  assert.deepEqual(await requestPeerReview(already.api, 'owner/repo', '12', participants), {
    status: 'requested', reviewer: 'backrebital-lgtm', author: 'cursor[bot]'
  });
});

test('bot or external PRs without a member noreply trailer are skipped', async () => {
  const emptyCommit = [{
    sha: 'aaa',
    commit: { message: 'chore: no trailers', author: { email: 'bot@users.noreply.github.com' } },
    author: { login: 'cursor[bot]' }
  }];
  for (const current of [
    botPull,
    { ...pull, user: { login: 'github-actions[bot]' } },
    { ...pull, user: { login: 'outsider' } }
  ]) {
    const mock = apiFor(current, { commits: emptyCommit });
    assert.equal((await requestPeerReview(mock.api, 'owner/repo', '12', participants)).status, 'skipped');
    assert.equal(mock.writes.length, 0);
  }
  const placeholder = apiFor(botPull, { commits: [{
    sha: 'bbb',
    commit: {
      message: 'docs\n\nCo-authored-by: ramincsy <ramincsy@example.com>',
      author: { email: 'cursoragent@cursor.com' }
    },
    author: { login: 'cursor[bot]' }
  }] });
  assert.equal((await requestPeerReview(placeholder.api, 'owner/repo', '12', participants)).status, 'skipped');
  assert.equal(placeholder.writes.length, 0);
});
