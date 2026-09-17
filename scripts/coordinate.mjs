import { appendFile, readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createApi, listAll } from './github.mjs';
import { planAssignments, reviewerFor, reviewState } from './planner.mjs';

export const MARKER = '<!-- gthub-achievements:coordination:v1 -->';
const isReport = issue => issue.user?.login === 'github-actions[bot]' && issue.body?.includes(MARKER);
export function render(issues, pulls) {
  const tasks = issues.filter(i => !i.pull_request && !isReport(i));
  const lines = [MARKER, '# وضعیت همکاری', '',
    'گزارش خودکار؛ این متن review یا تأیید انسانی نیست.', '',
    'دو حساب یک مالک؛ نقش پیاده‌سازی و بررسی می‌تواند جابه‌جا شود. این همکاری، بررسی انسانی مستقل نیست.', '',
    '## PRهای باز', ''];
  for (const pr of [...pulls].sort((a, b) => a.number - b.number)) {
    lines.push(`- #${pr.number} — نویسنده: @${pr.user.login} — ${pr.draft ? 'پیش‌نویس' : pr.reviewStatus ?? 'نیازمند بررسی'} — commit: \`${pr.head.sha}\``);
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

export async function coordinate(api, repo, summaryPath, options = {}) {
  const { config, dryRun = false } = options;
  const issues = await listAll(api, `/repos/${repo}/issues?state=open`);
  const pulls = await listAll(api, `/repos/${repo}/pulls?state=open`);
  const existing = issues.find(isReport);
  const plans = [];
  let mutations = 0;
  if (config) {
    for (const action of planAssignments(issues.filter(i => !isReport(i)), config)) {
      if (mutations >= config.maxMutationsPerRun) break;
      if (dryRun) {
        plans.push(`Would assign #${action.number} to @${action.assignee}`);
        mutations++;
        continue;
      }
      // Refresh before mutating, preserving a manual assignment or label change.
      const fresh = await api(`/repos/${repo}/issues/${action.number}`);
      const currentIssues = await listAll(api, `/repos/${repo}/issues?state=open`);
      const currentIndex = currentIssues.findIndex(i => i.number === action.number);
      if (currentIndex < 0) continue;
      currentIssues[currentIndex] = fresh;
      const stillPlanned = planAssignments(currentIssues.filter(i => !isReport(i)), config)
        .some(a => a.number === action.number && a.assignee === action.assignee);
      if (!stillPlanned) {
        plans.push(`Skipped #${action.number}: assignment, labels or workload changed`);
        continue;
      }
      const updated = await api(`/repos/${repo}/issues/${action.number}/assignees`, { method: 'POST', body: { assignees: [action.assignee] } });
      mutations++;
      plans.push(`Assigned #${action.number} to @${action.assignee}`);
      const index = issues.findIndex(i => i.number === action.number);
      issues[index] = updated;
    }
    for (const pull of pulls.slice(0, config.maxPullsPerRun)) {
      const reviews = await listAll(api, `/repos/${repo}/pulls/${pull.number}/reviews`);
      pull.reviewStatus = reviewState(pull, reviews);
      const reviewer = reviewerFor(pull, reviews, config.participants);
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
      if (reviewerFor(fresh, freshReviews, config.participants) !== reviewer) continue;
      await api(`/repos/${repo}/pulls/${pull.number}/requested_reviewers`, { method: 'POST', body: { reviewers: [reviewer] } });
      mutations++;
      plans.push(`Requested @${reviewer} to review #${pull.number}`);
      pull.reviewStatus = reviewState({ ...fresh, requested_reviewers: [{ login: reviewer }] }, freshReviews);
    }
  }
  const report = render(issues, pulls);
  if (summaryPath) await appendFile(summaryPath, report.body + '\n\n## Run result\n\n' +
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
  const config = JSON.parse(await readFile(new URL('../config/collaboration.json', import.meta.url), 'utf8'));
  if (repo !== config.repository) throw new Error('This workflow is restricted to its configured repository.');
  if (!Array.isArray(config.participants) || config.participants.length !== 2 || new Set(config.participants).size !== 2 || !config.participants.every(p => /^[A-Za-z0-9-]+$/.test(p))) throw new Error('Two distinct GitHub participants are required.');
  for (const field of ['maxAssignedPerPerson', 'maxPullsPerRun', 'maxMutationsPerRun']) {
    if (!Number.isInteger(config[field]) || config[field] < 1 || config[field] > 100) throw new Error(`Invalid limit: ${field}`);
  }
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
