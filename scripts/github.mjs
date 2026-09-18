const REPO = '/repos/[A-Za-z0-9._-]+/[A-Za-z0-9._-]+';
const allowedRoutes = {
  GET: [
    new RegExp(`^${REPO}/issues(?:\\?.*)?$`),
    new RegExp(`^${REPO}/issues/\\d+$`),
    new RegExp(`^${REPO}/issues/\\d+/dependencies/blocked_by(?:\\?.*)?$`),
    new RegExp(`^${REPO}/pulls(?:\\?.*)?$`),
    new RegExp(`^${REPO}/pulls/\\d+$`),
    new RegExp(`^${REPO}/pulls/\\d+/reviews(?:\\?.*)?$`),
    new RegExp(`^${REPO}/pulls/\\d+/commits(?:\\?.*)?$`),
    new RegExp(`^${REPO}/commits/[0-9a-fA-F]{40}$`)
  ],
  POST: [
    new RegExp(`^${REPO}/issues$`),
    new RegExp(`^${REPO}/issues/\\d+/assignees$`),
    new RegExp(`^${REPO}/pulls/\\d+/requested_reviewers$`)
  ],
  PATCH: [
    new RegExp(`^${REPO}/issues/\\d+$`)
  ]
};

export function assertAllowedRoute(method, route) {
  if (typeof route !== 'string' || route.includes('://') || route.includes('..') || !route.startsWith('/repos/')) {
    throw new Error('Only repository API routes are allowed');
  }
  const verb = (method ?? 'GET').toUpperCase();
  const patterns = allowedRoutes[verb];
  const candidate = verb === 'GET' ? route : route.split('?')[0];
  if (!patterns || !patterns.some(re => re.test(candidate))) {
    throw new Error(`GitHub API ${verb} route is not allowed`);
  }
}

export function pageSlice(items, route) {
  const query = route.includes('?') ? route.slice(route.indexOf('?') + 1) : '';
  const params = new URLSearchParams(query);
  const page = Number(params.get('page') || 1);
  const perPage = Number(params.get('per_page') || 100);
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(perPage) || perPage < 1) {
    throw new Error('Invalid pagination query');
  }
  return items.slice((page - 1) * perPage, page * perPage);
}

export async function listAll(api, route, maxPages = 100) {
  if (!Number.isInteger(maxPages) || maxPages < 1) throw new Error('Invalid pagination limit');
  const separator = route.includes('?') ? '&' : '?';
  const result = [];
  for (let page = 1; page <= maxPages; page++) {
    const items = await api(`${route}${separator}per_page=100&page=${page}`);
    if (!Array.isArray(items)) throw new Error('Unexpected paginated response');
    result.push(...items);
    if (items.length < 100) {
      Object.defineProperty(result, 'pagesFetched', { value: page, enumerable: false });
      return result;
    }
  }
  throw new Error('Pagination limit reached; refusing to use incomplete data');
}

export async function listBlockedBy(api, repo, issueNumber, maxPages = 100) {
  if (typeof repo !== 'string' || !/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new Error('A repository of the form owner/name is required.');
  if (!Number.isInteger(issueNumber) || issueNumber < 1) throw new Error('Invalid issue number');
  try {
    return await listAll(api, `/repos/${repo}/issues/${issueNumber}/dependencies/blocked_by`, maxPages);
  } catch (error) {
    if (error instanceof Error && /GitHub API GET failed: HTTP (404|410)/.test(error.message)) return [];
    throw error;
  }
}

export function createApi(token, { fetchImpl = fetch, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)), now = Date.now } = {}) {
  if (!token) throw new Error('GitHub token is required');
  let lastWrite = -Infinity;
  return async (route, options = {}) => {
    const method = (options.method ?? 'GET').toUpperCase();
    assertAllowedRoute(method, route);
    if (method !== 'GET') {
      const pause = 1000 - (now() - lastWrite);
      if (pause > 0) await sleep(pause);
      lastWrite = now();
    }
    for (let attempt = 0; attempt < 3; attempt++) {
      let response;
      try {
        response = await fetchImpl(`https://api.github.com${route}`, {
          method, redirect: 'error',
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' },
          body: options.body ? JSON.stringify(options.body) : undefined,
          signal: AbortSignal.timeout(30000)
        });
      } catch {
        // Never surface fetch exception details, which can contain sensitive data.
        if (method !== 'GET' || attempt === 2) throw new Error(`GitHub API ${method} failed: network error or timeout`);
        await sleep(1000 * 2 ** attempt);
        continue;
      }
      // Writes are never retried: a lost response might hide a successful write.
      const rateLimited = response.status === 403 && response.headers.has('retry-after');
      if (method === 'GET' && (rateLimited || [429, 502, 503, 504].includes(response.status)) && attempt < 2) {
        const retryAfter = response.headers.get('retry-after');
        const seconds = retryAfter === null ? NaN : Number(retryAfter);
        const date = retryAfter === null ? NaN : Date.parse(retryAfter);
        const delay = Number.isFinite(seconds) ? Math.max(0, seconds * 1000)
          : Number.isFinite(date) ? Math.max(0, date - now())
          : (response.status === 429 || rateLimited) ? 60000 : 1000 * 2 ** attempt;
        if (delay > 30000) throw new Error('GitHub requested a longer cooldown; try a later run');
        await sleep(delay);
        continue;
      }
      if (!response.ok) throw new Error(`GitHub API ${method} failed: HTTP ${response.status}`);
      return response.status === 204 ? null : response.json();
    }
  };
}
