import test from 'node:test';
import assert from 'node:assert/strict';
import {
  githubLoginFromNoreply,
  githubNoreplyAddress,
  parseCoAuthorTrailers,
  validateTrailer,
  validatePullCommits,
  mapPullCommits,
  renderCoauthorSummary,
  validatePullRequest
} from '../scripts/coauthor.mjs';

test('builds the ID+login GitHub noreply address from a public user id', () => {
  assert.equal(
    githubNoreplyAddress('backrebital-lgtm', 329678572),
    '329678572+backrebital-lgtm@users.noreply.github.com'
  );
  assert.equal(githubLoginFromNoreply(githubNoreplyAddress('ramincsy', 34828058)), 'ramincsy');
  assert.throws(() => githubNoreplyAddress('ramincsy', 0), /numeric GitHub user id/);
});

test('parses canonical trailers and rejects malformed lines', () => {
  const parsed = parseCoAuthorTrailers([
    'Fix the example.',
    '',
    'Co-authored-by: backrebital-lgtm <123+backrebital-lgtm@users.noreply.github.com>',
    'Co-authored-by: missing-brackets',
    'Signed-off-by: someone <a@b.com>'
  ].join('\n'));
  assert.equal(parsed.trailers.length, 1);
  assert.equal(parsed.trailers[0].name, 'backrebital-lgtm');
  assert.equal(githubLoginFromNoreply(parsed.trailers[0].email), 'backrebital-lgtm');
  assert.match(parsed.errors[0], /Malformed/);
});

test('placeholder emails fail; self and external noreply trailers are format-valid', () => {
  const participants = ['ramincsy', 'backrebital-lgtm'];
  assert.ok(validateTrailer({ name: 'NAME', email: 'NAME@EXAMPLE.COM' }, { participants }).length);
  assert.equal(validateTrailer(
    { name: 'ramincsy', email: 'ramincsy@users.noreply.github.com' },
    { authorLogin: 'ramincsy', authorEmail: '34828058+ramincsy@users.noreply.github.com', participants }
  ).length, 0);
  assert.equal(validateTrailer(
    { name: 'outsider', email: 'outsider@users.noreply.github.com' },
    { authorLogin: 'ramincsy', participants }
  ).length, 0);
});

test('solo commits without trailers pass; well-formed peer trailers pass', () => {
  const participants = ['ramincsy', 'backrebital-lgtm'];
  const solo = validatePullCommits([{ sha: 'abc1234', message: 'Docs only', authorLogin: 'ramincsy', authorEmail: 'a@b.co' }], { participants });
  assert.equal(solo.ok, true);
  assert.equal(solo.trailerCount, 0);
  const pair = validatePullCommits([{
    sha: 'def5678',
    authorLogin: 'ramincsy',
    authorEmail: 'ramincsy@users.noreply.github.com',
    message: 'Shared fix\n\nCo-authored-by: backrebital-lgtm <42+backrebital-lgtm@users.noreply.github.com>'
  }], { participants, requirePeer: true });
  assert.equal(pair.ok, true);
  assert.equal(pair.peerTrailer, true);
});

test('requirePeer fails when the other member is not in a noreply trailer', () => {
  const result = validatePullCommits([{ sha: 'abc1234', message: 'Solo', authorLogin: 'ramincsy' }], {
    participants: ['ramincsy', 'backrebital-lgtm'],
    requirePeer: true
  });
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /Pair path/);
});

test('maps GitHub commit payloads and writes a non-farming summary', () => {
  const mapped = mapPullCommits([{
    sha: 'aa',
    commit: { message: 'x', author: { name: 'A', email: 'a@users.noreply.github.com' } },
    author: { login: 'ramincsy' }
  }]);
  assert.equal(mapped[0].authorLogin, 'ramincsy');
  const summary = renderCoauthorSummary({ ok: true, trailerCount: 0, errors: [] });
  assert.match(summary, /not guaranteed/);
  assert.doesNotMatch(summary, /open empty|farm/i);
});

test('validatePullRequest only reads pull commits', async () => {
  const routes = [];
  const api = async route => {
    routes.push(route);
    return [{ sha: '1', commit: { message: 'ok', author: { email: 'a@b.co' } }, author: { login: 'ramincsy' } }];
  };
  const result = await validatePullRequest(api, 'ramincsy/Gthub-Achievements', '12', { participants: ['ramincsy', 'backrebital-lgtm'] });
  assert.equal(result.ok, true);
  assert.match(routes[0], /\/pulls\/12\/commits/);
  await assert.rejects(validatePullRequest(api, 'ramincsy/Gthub-Achievements', '../12'), /numeric/);
});
