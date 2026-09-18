import { appendFile, readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createApi, listAll } from './github.mjs';

const TRAILER_LINE = /^Co-authored-by\s*:/i;
const TRAILER = /^Co-authored-by:\s*(.+?)\s*<([^<>]+)>\s*$/i;
const EMAIL = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
const NOREPLY = /^(?:(\d+)\+)?([A-Za-z0-9-]+)@users\.noreply\.github\.com$/i;
const PLACEHOLDER_HOSTS = new Set(['example.com', 'example.org', 'example.net', 'invalid', 'localhost', 'test', 'email.com']);

export function githubLoginFromNoreply(email) {
  const match = String(email).trim().match(NOREPLY);
  return match ? match[2] : null;
}

export function githubNoreplyAddress(login, userId) {
  if (typeof login !== 'string' || !/^[A-Za-z0-9-]+$/.test(login)) {
    throw new Error('A GitHub username is required.');
  }
  if (!Number.isInteger(userId) || userId < 1) throw new Error('A numeric GitHub user id is required.');
  return `${userId}+${login}@users.noreply.github.com`;
}

export function parseCoAuthorTrailers(message) {
  const trailers = [];
  const errors = [];
  for (const raw of String(message ?? '').replace(/\r\n/g, '\n').split('\n')) {
    const line = raw.trim();
    if (!TRAILER_LINE.test(line)) continue;
    const match = line.match(TRAILER);
    if (!match) {
      errors.push(`Malformed Co-authored-by trailer (use: Co-authored-by: Name <email>): ${line}`);
      continue;
    }
    trailers.push({ name: match[1].trim(), email: match[2].trim(), raw: line });
  }
  return { trailers, errors };
}

export function validateTrailer(trailer, { authorEmail = '', authorLogin = '', participants = [] } = {}) {
  const errors = [];
  if (!trailer.name) errors.push('Co-authored-by name is empty');
  if (/^(name|another-name)$/i.test(trailer.name)) errors.push('Co-authored-by name looks like a placeholder');
  if (!EMAIL.test(trailer.email)) {
    errors.push(`Co-authored-by email is invalid: ${trailer.email}`);
    return errors;
  }
  const host = trailer.email.split('@')[1].toLowerCase();
  if (PLACEHOLDER_HOSTS.has(host)) errors.push(`Co-authored-by email uses a placeholder domain: ${host}`);
  if (host === 'github.com' || (host.endsWith('.github.com') && host !== 'users.noreply.github.com')) {
    errors.push('Use a GitHub-linked address, or username@users.noreply.github.com');
  }
  const author = String(authorEmail).trim().toLowerCase();
  if (author && trailer.email.toLowerCase() === author) errors.push('Co-authored-by email matches the commit author; that is not a second author');
  const noreplyLogin = githubLoginFromNoreply(trailer.email);
  if (host === 'users.noreply.github.com' && !noreplyLogin) {
    errors.push('GitHub noreply email must include the co-author username');
  }
  return errors;
}

export function mapPullCommits(apiCommits) {
  return (apiCommits ?? []).map(commit => ({
    sha: commit.sha,
    message: commit.commit?.message ?? '',
    authorEmail: commit.commit?.author?.email ?? '',
    authorLogin: commit.author?.login ?? '',
    authorName: commit.commit?.author?.name ?? '',
    parentCount: Array.isArray(commit.parents) ? commit.parents.length : 0
  }));
}

export function memberLoginsFromNoreplyTrailers(commits, participants) {
  const found = [];
  for (const commit of commits ?? []) {
    const parsed = parseCoAuthorTrailers(commit.message);
    for (const trailer of parsed.trailers) {
      if (validateTrailer(trailer, {
        authorEmail: commit.authorEmail,
        authorLogin: commit.authorLogin,
        participants
      }).length) continue;
      const login = githubLoginFromNoreply(trailer.email);
      if (!login) continue;
      const member = participants.find(p => p.toLowerCase() === login.toLowerCase());
      if (member && !found.includes(member)) found.push(member);
    }
  }
  return found;
}

export function validatePullCommits(commits, { participants = [], requirePeer = false } = {}) {
  const results = [];
  const errors = [];
  let trailerCount = 0;
  let peerTrailer = false;
  for (const commit of commits) {
    const parsed = parseCoAuthorTrailers(commit.message);
    const commitErrors = [...parsed.errors];
    for (const trailer of parsed.trailers) {
      trailerCount++;
      commitErrors.push(...validateTrailer(trailer, {
        authorEmail: commit.authorEmail,
        authorLogin: commit.authorLogin,
        participants
      }));
      const login = githubLoginFromNoreply(trailer.email);
      if (login && participants.some(p => p.toLowerCase() === login.toLowerCase() && p.toLowerCase() !== String(commit.authorLogin).toLowerCase())) {
        peerTrailer = true;
      }
    }
    const label = commit.sha ? commit.sha.slice(0, 7) : 'commit';
    results.push({ sha: commit.sha, trailers: parsed.trailers, errors: commitErrors });
    errors.push(...commitErrors.map(message => `${label}: ${message}`));
  }
  if (requirePeer && !peerTrailer) {
    errors.push('Pair path requires a well-formed Co-authored-by trailer whose GitHub noreply email belongs to the other member');
  }
  return { ok: errors.length === 0, results, errors, trailerCount, peerTrailer };
}

export function renderCoauthorSummary(result) {
  const lines = ['## Co-author check', '',
    'Format check only. GitHub still has to match the email to an account, merge the PR into the default branch, and process Achievements (public preview; not guaranteed).', ''];
  if (!result.ok) {
    lines.push('**Invalid Co-authored-by trailer(s):**', '', ...result.errors.map(error => `- ${error}`));
  } else if (result.trailerCount) {
    lines.push(`Validated ${result.trailerCount} Co-authored-by trailer(s). Solo PRs without trailers remain allowed.`);
  } else {
    lines.push('No Co-authored-by trailers on this PR. That is valid for solo work (Pull Shark path). Add a trailer only when the other person actually collaborated on the commit.');
  }
  return lines.join('\n') + '\n';
}

export async function validatePullRequest(api, repo, number, { participants, requirePeer = false } = {}) {
  if (!/^\d+$/.test(String(number))) throw new Error('A numeric pull request number is required.');
  const commits = mapPullCommits(await listAll(api, `/repos/${repo}/pulls/${number}/commits`));
  return validatePullCommits(commits, { participants, requirePeer });
}

async function main() {
  const repo = process.env.GITHUB_REPOSITORY;
  const token = process.env.GH_TOKEN;
  const number = process.env.PR_NUMBER;
  if (!repo || !token || !/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new Error('Repository and token are required.');
  const config = JSON.parse(await readFile(new URL('../config/collaboration.json', import.meta.url), 'utf8'));
  if (repo !== config.repository) throw new Error('This workflow is restricted to its configured repository.');
  const result = await validatePullRequest(createApi(token), repo, number, {
    participants: config.participants,
    requirePeer: process.env.REQUIRE_PEER === 'true'
  });
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, renderCoauthorSummary(result));
  if (!result.ok) {
    console.error(result.errors.join('\n'));
    process.exitCode = 1;
    return;
  }
  console.log(result.trailerCount ? `Validated ${result.trailerCount} Co-authored-by trailer(s).` : 'No Co-authored-by trailers; solo PR is allowed.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
