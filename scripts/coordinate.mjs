import { appendFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export const MARKER = '<!-- gthub-achievements:coordination:v1 -->';
export function render(issues, pulls) {
  const tasks = issues.filter(i => !i.pull_request && !i.body?.includes(MARKER));
  const lines = [MARKER, '# وضعیت همکاری', '',
    'گزارش خودکار؛ این متن review یا تأیید انسانی نیست.', '',
    'ramincsy: پیاده‌سازی و مثال‌ها. backrebital-lgtm: بررسی اجرا و مستندات.', '',
    '## PRهای باز', ''];
  for (const pr of [...pulls].sort((a, b) => a.number - b.number)) {
    lines.push(`- #${pr.number} — نویسنده: @${pr.user.login} — ${pr.draft ? 'پیش‌نویس' : 'آمادهٔ بررسی'} — commit: \`${pr.head.sha}\``);
  }
  if (!pulls.length) lines.push('PR بازی وجود ندارد.');
  lines.push('', '## کارهای باز', '');
  for (const item of [...tasks].sort((a, b) => a.number - b.number)) {
    const assignees = (item.assignees ?? []).map(a => `@${a.login}`).sort().join(', ');
    lines.push(`- #${item.number} — ${assignees || 'بدون مسئول'} — آخرین تغییر: ${item.updated_at}`);
  }
  if (!tasks.length) lines.push('کار بازی وجود ندارد.');
  lines.push('', 'جزئیات و پرسش‌های واقعی را در Issue یا PR مربوط ثبت کنید. دریافت Achievement به پردازش GitHub وابسته است.');
  return { body: lines.join('\n'), actionable: tasks.length + pulls.length > 0 };
}

export async function coordinate(api, repo, summaryPath) {
  async function list(resource) {
    const all = [];
    for (let page = 1; ; page++) {
      const items = await api(`/repos/${repo}/${resource}&per_page=100&page=${page}`);
      all.push(...items);
      if (items.length < 100) return all;
    }
  }
  const [issues, pulls] = await Promise.all([
    list('issues?state=open'), list('pulls?state=open')
  ]);
  const existing = issues.find(i => i.user?.login === 'github-actions[bot]' && i.body?.includes(MARKER));
  const report = render(issues, pulls);
  if (summaryPath) await appendFile(summaryPath, report.body);
  if (existing && existing.body !== report.body) {
    await api(`/repos/${repo}/issues/${existing.number}`, { method: 'PATCH', body: { body: report.body } });
    return 'updated';
  }
  if (!existing && report.actionable) {
    await api(`/repos/${repo}/issues`, { method: 'POST', body: { title: 'وضعیت همکاری پروژه', body: report.body } });
    return 'created';
  }
  return 'unchanged';
}

async function main() {
  const repo = process.env.GITHUB_REPOSITORY;
  const token = process.env.GH_TOKEN;
  if (!repo || !token || !/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new Error('Repository and token are required.');
  async function api(route, options = {}) {
    const response = await fetch(`https://api.github.com${route}`, {
      method: options.method ?? 'GET',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: AbortSignal.timeout(30000)
    });
    if (!response.ok) throw new Error(`GitHub API failed: HTTP ${response.status}`);
    return response.json();
  }
  console.log(await coordinate(api, repo, process.env.GITHUB_STEP_SUMMARY));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
