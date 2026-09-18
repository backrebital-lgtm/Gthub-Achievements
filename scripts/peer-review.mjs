import { appendFile, readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { mapPullCommits } from './coauthor.mjs';
import { createApi, listAll } from './github.mjs';
import { reviewerFor } from './planner.mjs';

export async function requestPeerReview(api, repo, pullNumber, participants) {
  if (!/^\d+$/.test(String(pullNumber))) throw new Error('A numeric pull request number is required.');
  const pull = await api(`/repos/${repo}/pulls/${pullNumber}`);
  const reviews = await listAll(api, `/repos/${repo}/pulls/${pullNumber}/reviews`);
  const author = pull.user?.login ?? null;
  let commits;
  if (!pull.draft && !participants.includes(author)) {
    commits = mapPullCommits(await listAll(api, `/repos/${repo}/pulls/${pullNumber}/commits`));
  }
  const reviewer = reviewerFor(pull, reviews, participants, { commits });
  if (!reviewer) return { status: 'skipped', reviewer: null, author };
  try {
    await api(`/repos/${repo}/pulls/${pullNumber}/requested_reviewers`, {
      method: 'POST',
      body: { reviewers: [reviewer] }
    });
    return { status: 'requested', reviewer, author: pull.user?.login ?? null };
  } catch (error) {
    if (error.message.includes('HTTP 422')) return { status: 'already-requested', reviewer, author: pull.user?.login ?? null };
    throw error;
  }
}

export function renderPeerReviewSummary(result) {
  const lines = ['## Peer review request', ''];
  if (result.status === 'requested') lines.push(`Requested a review from @${result.reviewer} for a PR by @${result.author}.`);
  else if (result.status === 'already-requested') lines.push(`@${result.reviewer} was already requested; no change.`);
  else lines.push('No review request needed (draft, bot/external author without a member noreply trailer, existing request, or a current-commit decision).');
  lines.push('', 'Two accounts share one owner. An automatic request is not an independent human review. This workflow does not approve or merge.');
  return lines.join('\n') + '\n';
}

async function main() {
  const repo = process.env.GITHUB_REPOSITORY;
  const token = process.env.GH_TOKEN;
  const number = process.env.PR_NUMBER;
  if (!repo || !token || !/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new Error('Repository and token are required.');
  const config = JSON.parse(await readFile(new URL('../config/collaboration.json', import.meta.url), 'utf8'));
  if (repo !== config.repository) throw new Error('This workflow is restricted to its configured repository.');
  const result = await requestPeerReview(createApi(token), repo, number, config.participants);
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, renderPeerReviewSummary(result));
  console.log(result.status, result.reviewer ?? '');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
