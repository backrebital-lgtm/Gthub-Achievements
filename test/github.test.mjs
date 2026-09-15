import test from 'node:test';
import assert from 'node:assert/strict';
import { listAll, createApi } from '../scripts/github.mjs';

test('pagination includes later pages and preserves existing query', async () => {
  const routes = [];
  const items = await listAll(async route => {
    routes.push(route);
    return route.endsWith('page=1') ? Array.from({ length: 100 }, (_, i) => i) : [100];
  }, '/repos/a/b/issues?state=open');
  assert.equal(items.length, 101);
  assert.match(routes[1], /state=open&per_page=100&page=2$/);
});
test('truncated pagination is rejected', async () => {
  await assert.rejects(listAll(async () => Array(100).fill(1), '/repos/a/b/issues', 1), /incomplete data/);
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
