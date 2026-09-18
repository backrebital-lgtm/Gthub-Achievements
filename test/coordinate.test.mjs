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

test('a real issue quoting the report marker stays in the backlog', async () => {
  const quotedMarker = { ...task, body: `Bug report quoting ${MARKER}`, user: { login: 'backrebital-lgtm' } };
  const report = render([quotedMarker], []);
  assert.equal(report.actionable, true);
  assert.match(report.body, /#1 /);
  const m = mock([quotedMarker]);
  assert.equal(await coordinate(m.api, 'owner/repo'), 'created');
});

const config = { participants: ['a', 'b'], readyLabel: 'ready', blockedLabel: 'blocked', maxAssignedPerPerson: 2, maxPullsPerRun: 20, maxMutationsPerRun: 6 };
test('dry run never writes even when assignment and report are needed', async () => {
  const m = mock([{ ...task, labels: ['ready'] }]);
  assert.equal(await coordinate(m.api, 'owner/repo', undefined, { config, dryRun: true }), 'dry-run');
  assert.equal(m.writes.length, 0);
});
test('a concurrent manual assignment is not overwritten', async () => {
  const m = mock([{ ...task, labels: ['ready'] }]);
  const api = (route, options) => route.endsWith('/issues/1') && !options
    ? Promise.resolve({ ...task, labels: ['ready'], assignees: [{ login: 'b' }] }) : m.api(route, options);
  await coordinate(api, 'owner/repo', undefined, { config });
  assert.ok(m.writes.every(write => !write.route.endsWith('/assignees')));
});
test('a changed PR head prevents a request based on stale data', async () => {
  const pr = { number: 2, user: { login: 'a' }, head: { sha: 'old' }, requested_reviewers: [], state: 'open' };
  const m = mock([], [pr]);
  const api = (route, options) => route.includes('/reviews?') ? Promise.resolve([])
    : route.endsWith('/pulls/2') ? Promise.resolve({ ...pr, head: { sha: 'new' } }) : m.api(route, options);
  await coordinate(api, 'owner/repo', undefined, { config });
  assert.ok(m.writes.every(write => !write.route.endsWith('/requested_reviewers')));
});

test('review submitted concurrently prevents a duplicate request', async () => {
  const pr = { number: 2, user: { login: 'a' }, head: { sha: 'new' }, requested_reviewers: [], state: 'open' };
  const m = mock([], [pr]);
  let reads = 0;
  const api = (route, options) => route.includes('/reviews?') ? Promise.resolve(++reads === 1 ? [] :
    [{ id: 1, state: 'APPROVED', commit_id: 'new', user: { login: 'b' } }])
    : route.endsWith('/pulls/2') ? Promise.resolve(pr) : m.api(route, options);
  await coordinate(api, 'owner/repo', undefined, { config });
  assert.equal(reads, 2);
  assert.ok(m.writes.every(write => !write.route.endsWith('/requested_reviewers')));
  assert.match(m.writes[0].body.body, /approved-current-commit/);
});

test('concurrent workload change does not exceed the configured cap', async () => {
  const ready = { ...task, state: 'open', labels: ['ready'] };
  const m = mock([ready]);
  let reads = 0;
  const api = (route, options) => !options && route.includes('/issues?') ? Promise.resolve(++reads === 1 ? [ready] : [ready,
    ...[2, 3].map(number => ({ ...task, number, assignees: [{ login: 'a' }] }))])
    : !options && route.endsWith('/issues/1') ? Promise.resolve(ready) : m.api(route, options);
  await coordinate(api, 'owner/repo', undefined, { config });
  assert.ok(m.writes.every(write => !write.route.endsWith('/assignees')));
});

test('assignment and review writes are bounded and successful reruns are quiet', async () => {
  let issues = [1, 2, 3].map(number => ({ ...task, number, labels: ['ready'], state: 'open' }));
  const writes = [];
  const api = async (route, options) => {
    if (!options) {
      if (route.includes('/issues?')) return structuredClone(issues);
      if (route.includes('/pulls?')) return [];
      const number = Number(route.split('/').at(-1));
      return structuredClone(issues.find(i => i.number === number));
    }
    writes.push({ route, ...options });
    if (route.endsWith('/assignees')) {
      const issue = issues.find(i => i.number === Number(route.split('/').at(-2)));
      issue.assignees = options.body.assignees.map(login => ({ login }));
      return structuredClone(issue);
    }
    if (options.method === 'POST') issues.push({ number: 99, body: options.body.body, user: { login: 'github-actions[bot]' } });
    else issues.find(i => i.number === 99).body = options.body.body;
    return {};
  };
  const bounded = { ...config, maxMutationsPerRun: 1 };
  await coordinate(api, 'owner/repo', undefined, { config: bounded });
  assert.equal(writes.filter(w => w.route.endsWith('/assignees')).length, 1);
  await coordinate(api, 'owner/repo', undefined, { config });
  assert.equal(writes.filter(w => w.route.endsWith('/assignees')).length, 3);
  assert.equal(writes.filter(w => w.route.endsWith('/issues')).length, 1);
  writes.length = 0;
  assert.equal(await coordinate(api, 'owner/repo', undefined, { config }), 'unchanged');
  assert.equal(writes.length, 0);
});
