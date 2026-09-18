import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { appendFile, readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { githubLoginFromNoreply, renderCoauthorSummary, validatePullCommits } from './coauthor.mjs';

const execFileAsync = promisify(execFile);
const GIT_LOG_FORMAT = '%H%x00%ae%x00%an%x00%B%x1e';

function gitErrorMessage(error) {
  const detail = [error.stderr, error.stdout, error.message].filter(Boolean).join('\n').trim();
  return detail.split('\n')[0] || 'git command failed';
}

export async function runGit(args, { cwd = process.cwd(), execFileImpl = execFileAsync } = {}) {
  try {
    const { stdout, stderr } = await execFileImpl('git', args, { cwd, encoding: 'utf8', timeout: 15000, maxBuffer: 4 * 1024 * 1024 });
    return { stdout: stdout ?? '', stderr: stderr ?? '' };
  } catch (error) {
    throw new Error(`git ${args[0]} failed: ${gitErrorMessage(error)}`);
  }
}

export function isPlaceholderSha(value) {
  return typeof value === 'string' && /^0+$/.test(value.trim());
}

export function resolveGitBase({ env = process.env, argv = [] } = {}) {
  const flag = argv.find(arg => arg.startsWith('--base='));
  if (flag) return flag.slice('--base='.length).trim() || null;
  const positional = argv.find(arg => !arg.startsWith('-'));
  if (positional) return positional.trim();
  const fromEnv = String(env.GIT_BASE ?? '').trim();
  if (!fromEnv || isPlaceholderSha(fromEnv)) return null;
  return fromEnv;
}

export function parseGitLog(stdout) {
  const records = String(stdout ?? '').split('\x1e').map(part => part.replace(/^\n+/, '').trimEnd()).filter(part => part.includes('\x00'));
  return records.map(record => {
    const [sha, authorEmail, authorName, message = ''] = record.split('\x00');
    const email = (authorEmail ?? '').trim();
    return {
      sha: (sha ?? '').trim(),
      authorEmail: email,
      authorName: (authorName ?? '').trim(),
      authorLogin: githubLoginFromNoreply(email) ?? '',
      message: message.replace(/^\n/, '')
    };
  }).filter(commit => commit.sha);
}

export async function defaultGitBase(gitRun = runGit, cwd = process.cwd()) {
  try {
    const { stdout } = await gitRun(['rev-parse', '--verify', '--quiet', 'origin/main'], { cwd });
    return stdout.trim() || 'origin/main';
  } catch {
    return null;
  }
}

export async function readGitCommits({ gitRun = runGit, base, head = 'HEAD', cwd = process.cwd() } = {}) {
  const rangeArgs = base ? ['--no-merges', `${base}..${head}`] : ['--no-merges', '-1', head];
  const { stdout: shas } = await gitRun(['rev-list', ...rangeArgs], { cwd });
  if (!String(shas).trim()) return [];
  const { stdout } = await gitRun(['log', `--format=${GIT_LOG_FORMAT}`, ...rangeArgs], { cwd });
  return parseGitLog(stdout);
}

export async function validateGitRange(options = {}) {
  const commits = await readGitCommits(options);
  return {
    ...validatePullCommits(commits, {
      participants: options.participants ?? [],
      requirePeer: options.requirePeer ?? false
    }),
    commitCount: commits.length,
    base: options.base ?? null
  };
}

export function renderGitTrailerSummary(result) {
  const lines = [renderCoauthorSummary(result).trimEnd(), ''];
  lines.push(`Checked ${result.commitCount} non-merge commit(s)${result.base ? ` after ${result.base}` : ' (HEAD only)'}.`);
  lines.push('Local git format check only. GitHub still has to match the email to an account and process Achievements (not guaranteed).');
  return `${lines.join('\n')}\n`;
}

async function main() {
  const argv = process.argv.slice(2);
  const requirePeer = process.env.REQUIRE_PEER === 'true' || argv.includes('--require-peer');
  const config = JSON.parse(await readFile(new URL('../config/collaboration.json', import.meta.url), 'utf8'));
  let base = resolveGitBase({ env: process.env, argv: argv.filter(arg => arg !== '--require-peer') });
  if (base == null) base = await defaultGitBase();
  const result = await validateGitRange({
    base,
    participants: config.participants,
    requirePeer
  });
  const summary = renderGitTrailerSummary(result);
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, summary);
  if (!result.ok) {
    console.error(result.errors.join('\n'));
    process.exitCode = 1;
    return;
  }
  console.log(result.trailerCount
    ? `Validated ${result.trailerCount} Co-authored-by trailer(s) across ${result.commitCount} commit(s).`
    : `No Co-authored-by trailers on ${result.commitCount} commit(s); solo work is allowed.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
