import { appendFile, readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { mapPullCommits } from './coauthor.mjs';
import { createApi, listAll, listBlockedBy } from './github.mjs';
import { validateConfig } from './config.mjs';
import { planAssignments, reviewerFor, reviewState, assignmentCandidates, openBlockers, issueNextAction, pullNextAction } from './planner.mjs';

export const MARKER = '<!-- gthub-achievements:coordination:v1 -->';
const isReport = issue => issue.user?.login === 'github-actions[bot]' && issue.body?.includes(MARKER);

export function pullsToInspect(pulls, maxPullsPerRun = pulls.length) {
  const ordered = [...pulls].sort((a, b) => a.number - b.number);
  const limit = Number.isInteger(maxPullsPerRun) ? maxPullsPerRun : ordered.length;
  return { inspectable: ordered.slice(0, limit), omitted: Math.max(0, ordered.length - limit) };
}

export function render(issues, pulls, details = {}) {
  const config = details.participants ? details : details.config;
  const tasks = issues.filter(i => !i.pull_request && !isReport(i));
  const lines = [MARKER, '# وضعیت همکاری', '',
    'گزارش خودکار؛ این متن review یا تأیید انسانی نیست.', '',
    'دو حساب یک مالک؛ نقش پیاده‌سازی و بررسی می‌تواند جابه‌جا شود. این همکاری، بررسی انسانی مستقل نیست.', '',
    '## PRهای باز', ''];
  for (const pr of [...pulls].sort((a, b) => a.number - b.number)) {
    lines.push(`- #${pr.number} — نویسنده: @${pr.user.login} — ${pr.draft ? 'پیش‌نویس' : pr.reviewStatus ?? 'نیازمند بررسی'} — commit: \`${pr.head.sha}\``);
    if (config) lines.push(`  - اقدام بعدی: ${pullNextAction(pr, config.participants)}`);
  }
  if (!pulls.length) lines.push('PR بازی وجود ندارد.');
  if (details.omittedPulls) {
    lines.push(`توجه: ${details.omittedPulls} PR به‌خاطر سقف ${details.maxPullsPerRun} مورد در این اجرا به‌تفصیل بررسی نشد و وضعیت آن‌ها «نیازمند بررسی» مانده است.`);
  }
  lines.push('', '## کارهای باز', '');
  for (const item of [...tasks].sort((a, b) => a.number - b.number)) {
    const assignees = (item.assignees ?? []).map(a => `@${a.login}`).sort().join(', ');
    lines.push(`- #${item.number} — ${assignees || 'بدون مسئول'} — آخرین تغییر: ${item.updated_at}`);
    const blockers = openBlockers(item.blockedBy).map(b => `#${b.number}`).join('، ');
    if (blockers) lines.push(`  - وابسته به ${blockers} (باز)؛ تا بسته شدن مانع واگذار نمی‌شود`);
    if (config) lines.push(`  - اقدام بعدی: ${issueNextAction(item, config)}`);
  }
  if (!tasks.length) lines.push('کار بازی وجود ندارد.');
  if (details.omittedDependencies) {
    lines.push(`توجه: ${details.omittedDependencies} کار آماده به‌خاطر سقف ${details.maxPullsPerRun} مورد در این اجرا برای blocked-by بومی بررسی نشد و واگذار نشد.`);
  }
  lines.push('', 'جزئیات و پرسش‌های واقعی را در Issue یا PR مربوط ثبت کنید. دریافت Achievement به پردازش GitHub وابسته است.');
  return { body: lines.join('\n'), actionable: tasks.length + pulls.length > 0 };
}

export async function coordinate(api, repo, summaryPath, options = {}) {
  const { config, dryRun = false } = options;
  const issues = await listAll(api, `/repos/${repo}/issues?state=open`);
  const pulls = await listAll(api, `/repos/${repo}/pulls?state=open`);
  const existing = issues.find(isReport);
  const plans = [];
  let mutations = 0;
  let omittedPulls = 0;
  let omittedDependencies = 0;
  if (config) {
    const candidates = assignmentCandidates(issues.filter(i => !isReport(i)), config);
    const inspectableCandidates = candidates.slice(0, config.maxPullsPerRun);
    omittedDependencies = Math.max(0, candidates.length - inspectableCandidates.length);
    const blockersByNumber = new Map();
    for (const issue of inspectableCandidates) {
      const blockers = await listBlockedBy(api, repo, issue.number);
      blockersByNumber.set(issue.number, blockers);
      issue.blockedBy = openBlockers(blockers);
    }
    for (const action of planAssignments(issues.filter(i => !isReport(i)), config, blockersByNumber)) {
      if (mutations >= config.maxMutationsPerRun) break;
      if (dryRun) {
        plans.push(`Would assign #${action.number} to @${action.assignee}`);
        mutations++;
        continue;
      }
      // Refresh before mutating, preserving a manual assignment, label or dependency change.
      const fresh = await api(`/repos/${repo}/issues/${action.number}`);
      const currentIssues = await listAll(api, `/repos/${repo}/issues?state=open`);
      const currentIndex = currentIssues.findIndex(i => i.number === action.number);
      if (currentIndex < 0) continue;
      currentIssues[currentIndex] = fresh;
      const freshBlockers = new Map(blockersByNumber);
      freshBlockers.set(action.number, await listBlockedBy(api, repo, action.number));
      const stillPlanned = planAssignments(currentIssues.filter(i => !isReport(i)), config, freshBlockers)
        .some(a => a.number === action.number && a.assignee === action.assignee);
      if (!stillPlanned) {
        plans.push(`Skipped #${action.number}: assignment, labels, workload or dependencies changed`);
        const original = issues.find(i => i.number === action.number);
        if (original) original.blockedBy = openBlockers(freshBlockers.get(action.number));
        continue;
      }
      const updated = await api(`/repos/${repo}/issues/${action.number}/assignees`, { method: 'POST', body: { assignees: [action.assignee] } });
      mutations++;
      plans.push(`Assigned #${action.number} to @${action.assignee}`);
      const index = issues.findIndex(i => i.number === action.number);
      if (index >= 0) issues[index] = { ...updated, blockedBy: openBlockers(freshBlockers.get(action.number)) };
    }
    const { inspectable, omitted } = pullsToInspect(pulls, config.maxPullsPerRun);
    omittedPulls = omitted;
    for (const pull of inspectable) {
      const reviews = await listAll(api, `/repos/${repo}/pulls/${pull.number}/reviews`);
      pull.reviewStatus = reviewState(pull, reviews);
      let commits;
      if (!pull.draft && !config.participants.includes(pull.user?.login)) {
        commits = mapPullCommits(await listAll(api, `/repos/${repo}/pulls/${pull.number}/commits`));
      }
      const reviewer = reviewerFor(pull, reviews, config.participants, { commits });
      if (!reviewer || mutations >= config.maxMutationsPerRun) continue;
      if (dryRun) {
        plans.push(`Would request @${reviewer} to review #${pull.number}`);
        mutations++;
        continue;
      }
      const fresh = await api(`/repos/${repo}/pulls/${pull.number}`);
      if (fresh.state !== 'open' || fresh.head.sha !== pull.head.sha) {
        plans.push(`Skipped #${pull.number}: PR state or commit changed`);
        continue;
      }
      const freshReviews = await listAll(api, `/repos/${repo}/pulls/${pull.number}/reviews`);
      pull.reviewStatus = reviewState(fresh, freshReviews);
      if (reviewerFor(fresh, freshReviews, config.participants, { commits }) !== reviewer) continue;
      await api(`/repos/${repo}/pulls/${pull.number}/requested_reviewers`, { method: 'POST', body: { reviewers: [reviewer] } });
      mutations++;
      plans.push(`Requested @${reviewer} to review #${pull.number}`);
      pull.reviewStatus = reviewState({ ...fresh, requested_reviewers: [{ login: reviewer }] }, freshReviews);
    }
  }
  const report = render(issues, pulls, {
    omittedPulls,
    omittedDependencies,
    maxPullsPerRun: config?.maxPullsPerRun,
    config
  });
  if (summaryPath) await appendFile(summaryPath, report.body + '\n\n## Run result\n\n' +
    `Fetched ${issues.length} open issues (${issues.pagesFetched ?? 1} page) and ${pulls.length} open pulls (${pulls.pagesFetched ?? 1} page).\n\n` +
    (omittedPulls ? `${omittedPulls} pull(s) were not inspected in detail because of maxPullsPerRun=${config.maxPullsPerRun}.\n\n` : '') +
    (omittedDependencies ? `${omittedDependencies} ready issue(s) were not checked for native blocked-by because of maxPullsPerRun=${config.maxPullsPerRun}.\n\n` : '') +
    (dryRun ? 'Dry run; no writes.' : `${mutations} assignment/review writes completed.`) + '\n\n' +
    (plans.length ? plans.map(p => `- ${p}`).join('\n') : 'No assignment or review action needed.') + '\n');
  if (dryRun) return 'dry-run';
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
  const config = validateConfig(JSON.parse(await readFile(new URL('../config/collaboration.json', import.meta.url), 'utf8')));
  if (repo !== config.repository) throw new Error('This workflow is restricted to its configured repository.');
  console.log(await coordinate(createApi(token), repo, process.env.GITHUB_STEP_SUMMARY, { config, dryRun: process.env.DRY_RUN === 'true' }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(async error => {
    console.error(error.message);
    process.exitCode = 1;
    if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY,
      '\n\n## Coordination failed\n\nThe run did not complete. Some writes may already have succeeded. Inspect the failed step and current repository state before retrying; never repeat a write blindly.\n').catch(() => {});
  });
}
