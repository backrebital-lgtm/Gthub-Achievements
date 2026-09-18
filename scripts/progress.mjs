import { appendFile, readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createApi, listAll } from './github.mjs';

export function communityTier(count, tiers) {
  const list = [...tiers].sort((a, b) => a - b);
  const reached = list.filter(tier => count >= tier);
  const next = list.find(tier => count < tier) ?? null;
  return {
    count,
    reached: reached.at(-1) ?? null,
    next,
    remaining: next == null ? 0 : next - count
  };
}

export function mergedPullCounts(pulls, participants) {
  const counts = Object.fromEntries(participants.map(login => [login, 0]));
  let merged = 0;
  let closedUnmerged = 0;
  for (const pull of pulls) {
    if (!pull.merged_at) {
      closedUnmerged++;
      continue;
    }
    merged++;
    const login = pull.user?.login;
    if (login in counts) counts[login]++;
  }
  return { counts, merged, closedUnmerged };
}

export function renderProgress({ repository, counts, merged, closedUnmerged, tiers, generatedAt }) {
  const lines = ['## Collaboration progress (report only)', '',
    `مخزن: \`${repository}\``,
    `زمان: ${generatedAt}`,
    `PR ادغام‌شده: ${merged} — بسته بدون merge: ${closedUnmerged}`,
    '',
    'این شمارش از API همین مخزن است؛ پردازش Achievement گیت‌هاب را تأیید نمی‌کند. آستانه‌ها **گزارش جامعه** هستند، نه مستند رسمی. این گردش‌کار Issue یا PR نمی‌سازد.',
    '',
    '### Pull Shark (گزارش جامعه؛ غیررسمی)',
    '',
    '| حساب | PR ادغام‌شده به‌عنوان نویسنده | آستانهٔ رسیده‌شده | تا آستانهٔ بعدی |',
    '| --- | ---: | ---: | ---: |'];
  for (const [login, count] of Object.entries(counts)) {
    const tier = communityTier(count, tiers);
    lines.push(`| @${login} | ${count} | ${tier.reached ?? '—'} | ${tier.next == null ? 'نامشخص' : tier.remaining} |`);
  }
  lines.push('', `آستانه‌های گزارش‌شدهٔ جامعه: ${tiers.join(', ')}.`,
    '',
    'Pair Extraordinaire در این گزارش شمارش نمی‌شود؛ به trailer معتبر `Co-authored-by` و merge به شاخهٔ پیش‌فرض وابسته است. Galaxy Brain به پاسخ پذیرفته‌شده در Discussions Q&A وابسته است و اینجا ساخته نمی‌شود.');
  return lines.join('\n') + '\n';
}

export async function collectMergedPulls(api, repo) {
  return listAll(api, `/repos/${repo}/pulls?state=closed`);
}

async function main() {
  const repo = process.env.GITHUB_REPOSITORY;
  const token = process.env.GH_TOKEN;
  if (!repo || !token || !/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new Error('Repository and token are required.');
  const config = JSON.parse(await readFile(new URL('../config/collaboration.json', import.meta.url), 'utf8'));
  const achievements = JSON.parse(await readFile(new URL('../config/achievements.json', import.meta.url), 'utf8'));
  if (repo !== config.repository) throw new Error('This workflow is restricted to its configured repository.');
  const pulls = await collectMergedPulls(createApi(token), repo);
  const stats = mergedPullCounts(pulls, config.participants);
  const report = renderProgress({
    repository: repo,
    ...stats,
    tiers: achievements.pullShark.tiers,
    generatedAt: new Date().toISOString()
  });
  console.log(report);
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, report);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
