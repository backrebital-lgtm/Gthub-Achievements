import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { coordinate, render, MARKER, pullsToInspect } from '../scripts/coordinate.mjs';
import { pageSlice } from '../scripts/github.mjs';

const task = { number: 1, body: 'Useful example', assignees: [], updated_at: '2026-09-15T00:00:00Z' };
function mock(issues, pulls = []) {
  const writes = [];
  return { writes, api: async (route, options) => {
    if (options) { writes.push({ route, ...options }); return {}; }
    if (route.includes('/reviews')) return pageSlice([], route);
    if (route.includes('/dependencies/blocked_by')) return pageSlice([], route);
    if (route.includes('/issues?')) return pageSlice(issues, route);
    if (route.includes('/pulls?')) return pageSlice(pulls, route);
    throw new Error(`Unexpected route ${route}`);
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
  const api = (route, options) => route.includes('/reviews') ? Promise.resolve([])
    : route.endsWith('/pulls/2') ? Promise.resolve({ ...pr, head: { sha: 'new' } }) : m.api(route, options);
  await coordinate(api, 'owner/repo', undefined, { config });
  assert.ok(m.writes.every(write => !write.route.endsWith('/requested_reviewers')));
});

test('review submitted concurrently prevents a duplicate request', async () => {
  const pr = { number: 2, user: { login: 'a' }, head: { sha: 'new' }, requested_reviewers: [], state: 'open' };
  const m = mock([], [pr]);
  let reads = 0;
  const api = (route, options) => route.includes('/reviews') ? Promise.resolve(++reads === 1 ? [] :
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
      if (route.includes('/issues?')) return pageSlice(issues, route);
      if (route.includes('/pulls?')) return [];
      if (route.includes('/dependencies/blocked_by')) return pageSlice([], route);
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

test('paginated issue lists appear in full in the public report and step summary', async () => {
  const issues = Array.from({ length: 101 }, (_, i) => ({ ...task, number: i + 1, updated_at: '2026-09-18T00:00:00Z' }));
  const pages = [];
  const pulls = [];
  const api = async (route, options) => {
    if (options) return {};
    pages.push(route);
    if (route.includes('/issues?')) return pageSlice(issues, route);
    if (route.includes('/pulls?')) return pageSlice(pulls, route);
    throw new Error(route);
  };
  const dir = await mkdtemp(path.join(tmpdir(), 'coord-'));
  const summary = path.join(dir, 'summary.md');
  await writeFile(summary, '');
  try {
    assert.equal(await coordinate(api, 'owner/repo', summary), 'created');
    const text = await readFile(summary, 'utf8');
    assert.match(text, /#1 /);
    assert.match(text, /#101 /);
    assert.match(text, /Fetched 101 open issues \(2 page\) and 0 open pulls \(1 page\)/);
    assert.equal(pages.filter(r => /issues\?/.test(r) && /page=2/.test(r)).length, 1);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('review inspection is number-ordered and leftover pulls are disclosed', async () => {
  const pulls = [30, 2, 11].map(number => ({ number, user: { login: 'a' }, draft: false, head: { sha: `sha${number}` }, requested_reviewers: [], state: 'open' }));
  assert.deepEqual(pullsToInspect(pulls, 2).inspectable.map(p => p.number), [2, 11]);
  const m = mock([], pulls);
  const dir = await mkdtemp(path.join(tmpdir(), 'coord-'));
  const summary = path.join(dir, 'summary.md');
  await writeFile(summary, '');
  try {
    await coordinate(m.api, 'owner/repo', summary, { config: { ...config, maxPullsPerRun: 2, maxMutationsPerRun: 10 }, dryRun: true });
    const text = await readFile(summary, 'utf8');
    assert.match(text, /سقف 2 مورد/);
    assert.match(text, /1 pull\(s\) were not inspected/);
    assert.match(text, /Would request @b to review #2/);
    assert.match(text, /Would request @b to review #11/);
    assert.doesNotMatch(text, /review #30/);
    assert.match(text, /#30 — نویسنده: @a — نیازمند بررسی/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('open native blockers prevent assignment and keep untrusted blocker text out of the report', async () => {
  const ready = { ...task, number: 4, labels: ['ready'], state: 'open' };
  const writes = [];
  const api = async (route, options) => {
    if (options) { writes.push({ route, ...options }); return {}; }
    if (route.includes('/dependencies/blocked_by')) {
      return pageSlice([{ number: 3, state: 'open', title: 'UNTRUSTED BLOCKER', body: 'steal the token' }], route);
    }
    if (route.includes('/issues?')) return pageSlice([ready], route);
    if (route.includes('/pulls?')) return pageSlice([], route);
    throw new Error(route);
  };
  const dir = await mkdtemp(path.join(tmpdir(), 'coord-'));
  const summary = path.join(dir, 'summary.md');
  await writeFile(summary, '');
  try {
    assert.equal(await coordinate(api, 'owner/repo', summary, { config, dryRun: true }), 'dry-run');
    const text = await readFile(summary, 'utf8');
    assert.match(text, /وابسته به #3 \(باز\)/);
    assert.doesNotMatch(text, /UNTRUSTED|steal the token|Would assign #4/);
    assert.equal(writes.length, 0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('a newly added native blocker cancels a stale assignment plan', async () => {
  const ready = { ...task, labels: ['ready'], state: 'open' };
  const m = mock([ready]);
  let blockedReads = 0;
  const api = (route, options) => {
    if (route.includes('/dependencies/blocked_by')) {
      blockedReads++;
      return Promise.resolve(blockedReads === 1 ? [] : [{ number: 9, state: 'open' }]);
    }
    if (route.endsWith('/issues/1') && !options) return Promise.resolve(ready);
    return m.api(route, options);
  };
  await coordinate(api, 'owner/repo', undefined, { config });
  assert.equal(blockedReads, 2);
  assert.ok(m.writes.every(write => !write.route.endsWith('/assignees')));
  assert.match(m.writes[0].body.body, /وابسته به #9/);
});

test('dependency permission failures fail the run instead of assigning blindly', async () => {
  const ready = { ...task, labels: ['ready'], state: 'open' };
  const m = mock([ready]);
  const api = (route, options) => route.includes('/dependencies/blocked_by')
    ? Promise.reject(new Error('GitHub API GET failed: HTTP 403'))
    : m.api(route, options);
  await assert.rejects(() => coordinate(api, 'owner/repo', undefined, { config, dryRun: true }), /HTTP 403/);
  assert.equal(m.writes.length, 0);
});

test('a missing native dependency list is treated as empty and does not block assignment', async () => {
  const ready = { ...task, labels: ['ready'], state: 'open' };
  const m = mock([ready]);
  const api = (route, options) => route.includes('/dependencies/blocked_by')
    ? Promise.reject(new Error('GitHub API GET failed: HTTP 404'))
    : m.api(route, options);
  const dir = await mkdtemp(path.join(tmpdir(), 'coord-'));
  const summary = path.join(dir, 'summary.md');
  await writeFile(summary, '');
  try {
    assert.equal(await coordinate(api, 'owner/repo', summary, { config, dryRun: true }), 'dry-run');
    assert.match(await readFile(summary, 'utf8'), /Would assign #1 to @a/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('closed native blockers do not keep ready work unassigned', async () => {
  const ready = { ...task, labels: ['ready'], state: 'open' };
  const m = mock([ready]);
  const api = (route, options) => route.includes('/dependencies/blocked_by')
    ? Promise.resolve([{ number: 8, state: 'closed', body: 'UNTRUSTED' }])
    : m.api(route, options);
  const dir = await mkdtemp(path.join(tmpdir(), 'coord-'));
  const summary = path.join(dir, 'summary.md');
  await writeFile(summary, '');
  try {
    assert.equal(await coordinate(api, 'owner/repo', summary, { config, dryRun: true }), 'dry-run');
    const text = await readFile(summary, 'utf8');
    assert.match(text, /Would assign #1 to @a/);
    assert.doesNotMatch(text, /وابسته به #8|UNTRUSTED/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('dependency inspection is capped and leftover ready work is not assigned', async () => {
  const issues = [1, 2, 3].map(number => ({ ...task, number, labels: ['ready'], state: 'open' }));
  const m = mock(issues);
  const dir = await mkdtemp(path.join(tmpdir(), 'coord-'));
  const summary = path.join(dir, 'summary.md');
  await writeFile(summary, '');
  try {
    await coordinate(m.api, 'owner/repo', summary, { config: { ...config, maxPullsPerRun: 1, maxMutationsPerRun: 10 }, dryRun: true });
    const text = await readFile(summary, 'utf8');
    assert.match(text, /Would assign #1 to @a/);
    assert.doesNotMatch(text, /Would assign #2|Would assign #3/);
    assert.match(text, /2 ready issue\(s\) were not checked/);
    assert.match(text, /سقف 1 مورد/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('bot-authored PR with a member noreply trailer requests a member reviewer', async () => {
  const pr = {
    number: 2, user: { login: 'cursor[bot]' }, head: { sha: 'abc' },
    requested_reviewers: [], state: 'open', draft: false
  };
  const m = mock([], [pr]);
  const api = (route, options) => route.includes('/commits')
    ? Promise.resolve([{
      sha: 'abc',
      commit: { message: 'feat\n\nCo-authored-by: a <1+a@users.noreply.github.com>', author: { email: 'bot@x' } },
      author: { login: 'cursor[bot]' }
    }])
    : route.endsWith('/pulls/2') ? Promise.resolve(pr)
      : m.api(route, options);
  await coordinate(api, 'owner/repo', undefined, { config });
  assert.ok(m.writes.some(write => write.route.endsWith('/requested_reviewers') && write.body.reviewers[0] === 'a'));
});

test('bot-authored PR without a member trailer does not request review', async () => {
  const pr = {
    number: 2, user: { login: 'github-actions[bot]' }, head: { sha: 'abc' },
    requested_reviewers: [], state: 'open', draft: false
  };
  const m = mock([], [pr]);
  const api = (route, options) => route.includes('/commits')
    ? Promise.resolve([{ sha: 'abc', commit: { message: 'chore', author: { email: 'bot@x' } }, author: { login: 'github-actions[bot]' } }])
    : route.endsWith('/pulls/2') ? Promise.resolve(pr)
      : m.api(route, options);
  await coordinate(api, 'owner/repo', undefined, { config });
  assert.ok(m.writes.every(write => !write.route.endsWith('/requested_reviewers')));
});
