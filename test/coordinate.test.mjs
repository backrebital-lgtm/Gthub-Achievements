import test from 'node:test';
import assert from 'node:assert/strict';
import { coordinate, render, MARKER } from '../scripts/coordinate.mjs';

const task = { number: 1, body: 'Useful example', assignees: [], updated_at: '2026-09-15T00:00:00Z' };
function mock(issues, pulls = []) {
  const writes = [];
  return { writes, api: async (route, options) => {
    if (options) { writes.push({ route, ...options }); return {}; }
    if (route.includes('/issues?')) return issues;
    if (route.includes('/pulls?')) return pulls;
    throw new Error('Unexpected route');
  } };
}
test('empty backlog produces no public issue', async () => {
  const m = mock([]);
  assert.equal(await coordinate(m.api, 'owner/repo'), 'unchanged');
  assert.equal(m.writes.length, 0);
});
test('real task creates only one coordination issue', async () => {
  const m = mock([task]);
  assert.equal(await coordinate(m.api, 'owner/repo'), 'created');
  assert.equal(m.writes.length, 1);
  assert.equal(m.writes[0].method, 'POST');
});
test('unchanged backlog stays quiet across hourly runs', async () => {
  const body = render([task], []).body;
  const m = mock([task, { number: 9, body, user: { login: 'github-actions[bot]' } }]);
  assert.equal(await coordinate(m.api, 'owner/repo'), 'unchanged');
  assert.equal(m.writes.length, 0);
});
test('new head commit updates existing report without adding comments', async () => {
  const m = mock([{ number: 9, body: MARKER, user: { login: 'github-actions[bot]' } }],
    [{ number: 2, user: { login: 'ramincsy' }, draft: false, head: { sha: 'abc123' } }]);
  assert.equal(await coordinate(m.api, 'owner/repo'), 'updated');
  assert.equal(m.writes[0].route, '/repos/owner/repo/issues/9');
  assert.match(m.writes[0].body.body, /abc123/);
});
test('ordinary author cannot impersonate the bot report', async () => {
  const m = mock([task, { number: 9, body: MARKER, user: { login: 'someone' } }]);
  await coordinate(m.api, 'owner/repo');
  assert.equal(m.writes[0].method, 'POST');
});
