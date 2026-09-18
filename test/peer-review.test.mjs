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

function apiFor(current, { reviews = [], writeError } = {}) {
  const writes = [];
  const api = async (route, options) => {
    if (options) {
      writes.push({ route, ...options });
      if (writeError) throw writeError;
      return {};
    }
    if (route.endsWith('/pulls/12')) return current;
    if (route.includes('/reviews')) return reviews;
    throw new Error(`Unexpected route ${route}`);
  };
  return { api, writes };
}

test('requests the other member and treats a 422 as already requested', async () => {
  const first = apiFor(pull);
  assert.deepEqual(await requestPeerReview(first.api, 'owner/repo', '12', participants), {
    status: 'requested', reviewer: 'backrebital-lgtm', author: 'ramincsy'
  });
  assert.equal(first.writes[0].method, 'POST');
  assert.deepEqual(first.writes[0].body, { reviewers: ['backrebital-lgtm'] });

  const raced = apiFor(pull, { writeError: new Error('GitHub API POST failed: HTTP 422') });
  assert.equal((await requestPeerReview(raced.api, 'owner/repo', '12', participants)).status, 'already-requested');
});

test('skips drafts, existing requests, and does not approve or merge', async () => {
  for (const current of [
    { ...pull, draft: true },
    { ...pull, requested_reviewers: [{ login: 'backrebital-lgtm' }] },
    { ...pull, user: { login: 'outsider' } }
  ]) {
    const mock = apiFor(current);
    assert.equal((await requestPeerReview(mock.api, 'owner/repo', '12', participants)).status, 'skipped');
    assert.equal(mock.writes.length, 0);
  }
  const summary = renderPeerReviewSummary({ status: 'requested', reviewer: 'backrebital-lgtm', author: 'ramincsy' });
  assert.match(summary, /does not approve or merge/);
  await assert.rejects(requestPeerReview(apiFor(pull).api, 'owner/repo', '12a', participants), /numeric/);
});
