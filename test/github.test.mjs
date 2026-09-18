import test from 'node:test';
import assert from 'node:assert/strict';
import { listAll, listBlockedBy, createApi, assertAllowedRoute, pageSlice } from '../scripts/github.mjs';

test('pagination includes later pages and preserves existing query', async () => {
  const routes = [];
  const items = await listAll(async route => {
    routes.push(route);
    return route.endsWith('page=1') ? Array.from({ length: 100 }, (_, i) => i) : [100];
  }, '/repos/a/b/issues?state=open');
  assert.equal(items.length, 101);
  assert.equal(items.pagesFetched, 2);
  assert.match(routes[1], /state=open&per_page=100&page=2$/);
});
test('pagination works when the first request has no query', async () => {
  const items = await listAll(async () => [1, 2], '/repos/a/b/pulls');
  assert.deepEqual([...items], [1, 2]);
  assert.equal(items.pagesFetched, 1);
});
test('truncated pagination is rejected', async () => {
  await assert.rejects(listAll(async () => Array(100).fill(1), '/repos/a/b/issues', 1), /incomplete data/);
});
test('non-array pages are rejected', async () => {
  await assert.rejects(listAll(async () => ({ items: [] }), '/repos/a/b/issues'), /Unexpected paginated response/);
});
test('pageSlice honors per_page and page', () => {
  const items = Array.from({ length: 5 }, (_, i) => i);
  assert.deepEqual(pageSlice(items, '/repos/a/b/issues?per_page=2&page=2'), [2, 3]);
});
test('transient GET errors retry but writes do not', async () => {
  let calls = 0;
  const fetchImpl = async () => ++calls === 1 ? new Response('', { status: 503 }) : new Response('[]');
  const api = createApi('test-token', { fetchImpl, sleep: async () => {} });
  assert.deepEqual(await api('/repos/a/b/issues'), []);
  assert.equal(calls, 2);
  calls = 0;
  await assert.rejects(api('/repos/a/b/issues', { method: 'POST', body: {} }), /503/);
  assert.equal(calls, 1);
});
test('auth failures do not retry or expose server body or token', async () => {
  let calls = 0;
  const api = createApi('secret-value', { fetchImpl: async () => { calls++; return new Response('sensitive server message', { status: 403 }); } });
  await assert.rejects(api('/repos/a/b/issues'), error => error.message === 'GitHub API GET failed: HTTP 403');
  assert.equal(calls, 1);
});

test('network failures retry reads only and redact exception details', async () => {
  let calls = 0;
  const api = createApi('secret', { fetchImpl: async () => { calls++; throw new Error('secret internal details'); }, sleep: async () => {} });
  await assert.rejects(api('/repos/a/b/issues'), error => error.message === 'GitHub API GET failed: network error or timeout');
  assert.equal(calls, 3);
  calls = 0;
  await assert.rejects(api('/repos/a/b/issues', { method: 'post', body: {} }), /POST failed: network/);
  assert.equal(calls, 1);
});

test('rate limit Retry-After supports seconds and dates', async () => {
  for (const retryAfter of ['3', 'Thu, 17 Sep 2026 12:00:03 GMT']) {
    let calls = 0;
    const delays = [];
    const api = createApi('test', { now: () => Date.parse('2026-09-17T12:00:00Z'),
      fetchImpl: async () => ++calls === 1 ? new Response('', { status: 403, headers: { 'retry-after': retryAfter } }) : new Response('[]'),
      sleep: async ms => { delays.push(ms); } });
    assert.deepEqual(await api('/repos/a/b/issues'), []);
    assert.deepEqual(delays, [3000]);
  }
});

test('long or unspecified rate-limit cooldown fails without hammering GitHub', async () => {
  for (const headers of [{ 'retry-after': '120' }, {}]) {
    let calls = 0;
    const api = createApi('test', { fetchImpl: async () => { calls++; return new Response('', { status: 429, headers }); },
      sleep: async () => assert.fail('must not retry') });
    await assert.rejects(api('/repos/a/b/issues'), /longer cooldown/);
    assert.equal(calls, 1);
  }
});

test('serial mutations are spaced by at least one second', async () => {
  let time = 0;
  const delays = [];
  const api = createApi('test', { now: () => time, fetchImpl: async () => new Response('{}'),
    sleep: async ms => { delays.push(ms); time += ms; } });
  await api('/repos/a/b/issues', { method: 'POST', body: {} });
  await api('/repos/a/b/issues/1', { method: 'PATCH', body: {} });
  assert.deepEqual(delays, [1000]);
});

test('only coordination write routes are allowed', () => {
  assert.doesNotThrow(() => assertAllowedRoute('GET', '/repos/a/b/issues?state=open&page=1'));
  assert.doesNotThrow(() => assertAllowedRoute('GET', '/repos/a/b/issues/3/dependencies/blocked_by'));
  assert.doesNotThrow(() => assertAllowedRoute('POST', '/repos/a/b/issues/3/assignees'));
  assert.doesNotThrow(() => assertAllowedRoute('POST', '/repos/a/b/pulls/4/requested_reviewers'));
  assert.throws(() => assertAllowedRoute('POST', '/repos/a/b/issues/3/dependencies/blocked_by'), /not allowed/);
  assert.throws(() => assertAllowedRoute('DELETE', '/repos/a/b/issues/3/dependencies/blocked_by/9'), /not allowed/);
  assert.throws(() => assertAllowedRoute('GET', '/repos/a/b/actions/secrets'), /not allowed/);
  assert.throws(() => assertAllowedRoute('GET', '/user'), /Only repository API routes/);
  assert.throws(() => assertAllowedRoute('POST', '/repos/a/b/git/blobs'), /not allowed/);
  assert.throws(() => assertAllowedRoute('GET', 'https://evil.example/repos/a/b/issues'), /Only repository API routes/);
});

test('listBlockedBy treats missing lists as empty and rejects unsafe input', async () => {
  assert.deepEqual(await listBlockedBy(async () => { throw new Error('GitHub API GET failed: HTTP 404'); }, 'a/b', 1), []);
  assert.deepEqual(await listBlockedBy(async () => { throw new Error('GitHub API GET failed: HTTP 410'); }, 'a/b', 1), []);
  await assert.rejects(listBlockedBy(async () => { throw new Error('GitHub API GET failed: HTTP 403'); }, 'a/b', 1), /HTTP 403/);
  await assert.rejects(listBlockedBy(async () => [], 'a/b', 0), /Invalid issue number/);
  await assert.rejects(listBlockedBy(async () => [], '../evil/x', 1), /repository/);
});

test('createApi rejects disallowed routes before fetching', async () => {
  let calls = 0;
  const api = createApi('test', { fetchImpl: async () => { calls++; return new Response('[]'); } });
  await assert.rejects(api('/repos/a/b/contents/README.md'), /not allowed/);
  assert.equal(calls, 0);
});
