import { appendFile, readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import {
  githubLoginFromNoreply,
  mapPullCommits,
  parseCoAuthorTrailers,
  validateTrailer
} from './coauthor.mjs';
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

export function mergeCommitSha(value) {
  const sha = String(value ?? '').trim();
  return /^[0-9a-f]{40}$/i.test(sha) ? sha : null;
}

export function landedPairCommits(mergeCommit, pullCommits = []) {
  if (!mergeCommit?.sha) throw new Error('Merged pull is missing a merge commit.');
  if ((mergeCommit.parentCount ?? 0) >= 2) {
    return (pullCommits ?? []).filter(commit => (commit.parentCount ?? 0) < 2);
  }
  return [mergeCommit];
}

export function pairPathStats(pullsWithCommits, participants) {
  const counts = Object.fromEntries(participants.map(login => [login, 0]));
  let pairCommits = 0;
  let pairPulls = 0;
  let malformedTrailers = 0;
  for (const pull of pullsWithCommits ?? []) {
    let pullHasPeer = false;
    for (const commit of pull.commits ?? []) {
      const parsed = parseCoAuthorTrailers(commit.message);
      malformedTrailers += parsed.errors.length;
      const authorLogin = String(commit.authorLogin ?? '').toLowerCase();
      const peers = new Set();
      for (const trailer of parsed.trailers) {
        const trailerErrors = validateTrailer(trailer, {
          authorEmail: commit.authorEmail,
          authorLogin: commit.authorLogin,
          participants
        });
        if (trailerErrors.length) {
          malformedTrailers += trailerErrors.length;
          continue;
        }
        const login = githubLoginFromNoreply(trailer.email);
        if (!login) continue;
        const member = participants.find(p => p.toLowerCase() === login.toLowerCase());
        if (member && member.toLowerCase() !== authorLogin) peers.add(member);
      }
      if (peers.size) {
        pairCommits++;
        pullHasPeer = true;
        for (const member of peers) counts[member]++;
      }
    }
    if (pullHasPeer) pairPulls++;
  }
  return { counts, pairCommits, pairPulls, malformedTrailers };
}

export function renderProgress({
  repository, counts, merged, closedUnmerged, tiers, generatedAt,
  pair = { counts: {}, pairCommits: 0, pairPulls: 0, malformedTrailers: 0 },
  pairTiers = []
}) {
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
    '### Pair Extraordinaire (گزارش جامعه؛ غیررسمی)',
    '',
    'فقط قالب `Co-authored-by` روی commitهایی شمرده می‌شود که **روی شاخهٔ پیش‌فرض نشسته‌اند**. squash/rebase: همان merge commit (یک والد). merge: commitهای غیر-merge همان PR. rebase چندcommit جداگانه پیمایش نمی‌شود.',
    'GitHub هنگام squash ممکن است نویسنده را به ادغام‌کننده عوض کند، trailer خودِ نویسنده را حذف کند، و نویسندهٔ اصلی PR را co-author کند. trailer روی شاخهٔ PR اگر روی main ننشیند شمرده نمی‌شود.',
    'PRهایی که نویسندهٔ GitHub آن‌ها عضو نیست برای Pull Shark آن اعضا شمرده نمی‌شوند. GitHub باید ایمیل را به حساب وصل کند و Achievement را پردازش کند؛ هیچ‌کدام اینجا تأیید نمی‌شود.',
    'دو حساب یک مالک دارند؛ این شمارش همکاری دو انسان مستقل نیست. `github-actions[bot]` نشان نمی‌دهد.',
    '',
    `Commitهای pair نشسته روی پیش‌فرض (trailer همکار خوش‌فرم): ${pair.pairCommits} — PRهای mergeشدهٔ حاوی آن‌ها: ${pair.pairPulls} — trailer نامعتبر نادیده‌گرفته‌شده: ${pair.malformedTrailers}`,
    '',
    '| حساب | commitهایی که co-author noreply او هستند | آستانهٔ رسیده‌شده | تا آستانهٔ بعدی |',
    '| --- | ---: | ---: | ---: |');
  for (const [login, count] of Object.entries(pair.counts)) {
    const tier = communityTier(count, pairTiers);
    lines.push(`| @${login} | ${count} | ${tier.reached ?? '—'} | ${tier.next == null ? 'نامشخص' : tier.remaining} |`);
  }
  lines.push('', `آستانه‌های گزارش‌شدهٔ جامعه برای pair: ${pairTiers.join(', ') || '—'}.`,
    '',
    'Galaxy Brain به پاسخ پذیرفته‌شده در Discussions Q&A وابسته است و اینجا ساخته نمی‌شود.');
  return lines.join('\n') + '\n';
}

export async function collectMergedPulls(api, repo) {
  return listAll(api, `/repos/${repo}/pulls?state=closed`);
}

export async function collectPairPullCommits(api, repo, pulls) {
  if (typeof repo !== 'string' || !/^[\w.-]+\/[\w.-]+$/.test(repo)) {
    throw new Error('A repository of the form owner/name is required.');
  }
  const merged = (pulls ?? []).filter(pull => pull.merged_at).sort((a, b) => a.number - b.number);
  const result = [];
  for (const pull of merged) {
    if (!Number.isInteger(pull.number) || pull.number < 1) throw new Error('Invalid pull number');
    const sha = mergeCommitSha(pull.merge_commit_sha);
    if (!sha) throw new Error(`Merged pull #${pull.number} is missing a merge commit SHA.`);
    const mergeCommit = mapPullCommits([await api(`/repos/${repo}/commits/${sha}`)])[0];
    if (!mergeCommit?.sha) throw new Error(`Merged pull #${pull.number} is missing a merge commit.`);
    let pullCommits = [];
    if ((mergeCommit.parentCount ?? 0) >= 2) {
      pullCommits = mapPullCommits(await listAll(api, `/repos/${repo}/pulls/${pull.number}/commits`));
    }
    result.push({
      number: pull.number,
      mergeMethod: (mergeCommit.parentCount ?? 0) >= 2 ? 'merge' : 'squash-or-rebase',
      commits: landedPairCommits(mergeCommit, pullCommits)
    });
  }
  return result;
}

async function main() {
  const repo = process.env.GITHUB_REPOSITORY;
  const token = process.env.GH_TOKEN;
  if (!repo || !token || !/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new Error('Repository and token are required.');
  const config = JSON.parse(await readFile(new URL('../config/collaboration.json', import.meta.url), 'utf8'));
  const achievements = JSON.parse(await readFile(new URL('../config/achievements.json', import.meta.url), 'utf8'));
  if (repo !== config.repository) throw new Error('This workflow is restricted to its configured repository.');
  const api = createApi(token);
  const pulls = await collectMergedPulls(api, repo);
  const stats = mergedPullCounts(pulls, config.participants);
  const pair = pairPathStats(await collectPairPullCommits(api, repo, pulls), config.participants);
  const report = renderProgress({
    repository: repo,
    ...stats,
    pair,
    tiers: achievements.pullShark.tiers,
    pairTiers: achievements.pairExtraordinaire.tiers,
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
