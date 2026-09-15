export async function listAll(api, route, maxPages = 100) {
  const separator = route.includes('?') ? '&' : '?';
  const result = [];
  for (let page = 1; page <= maxPages; page++) {
    const items = await api(`${route}${separator}per_page=100&page=${page}`);
    if (!Array.isArray(items)) throw new Error('Unexpected paginated response');
    result.push(...items);
    if (items.length < 100) return result;
  }
  throw new Error('Pagination limit reached; refusing to use incomplete data');
}

export function createApi(token, { fetchImpl = fetch, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)) } = {}) {
  if (!token) throw new Error('GitHub token is required');
  return async (route, options = {}) => {
    if (!route.startsWith('/repos/') || route.includes('://')) throw new Error('Only repository API routes are allowed');
    const method = options.method ?? 'GET';
    for (let attempt = 0; attempt < 3; attempt++) {
      const response = await fetchImpl(`https://api.github.com${route}`, {
        method, redirect: 'error',
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' },
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: AbortSignal.timeout(30000)
      });
      // Writes are never retried: a lost response might hide a successful write.
      if (method === 'GET' && [429, 502, 503, 504].includes(response.status) && attempt < 2) {
        const retryAfter = response.headers.get('retry-after');
        const seconds = retryAfter === null ? NaN : Number(retryAfter);
        const delay = Number.isFinite(seconds) ? Math.max(0, seconds * 1000) : 1000 * 2 ** attempt;
        if (delay > 30000) throw new Error('GitHub requested a longer cooldown; try a later run');
        await sleep(delay);
        continue;
      }
      if (!response.ok) throw new Error(`GitHub API ${method} failed: HTTP ${response.status}`);
      return response.status === 204 ? null : response.json();
    }
  };
}
