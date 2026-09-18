import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {
  isPlaceholderSha,
  parseGitLog,
  resolveGitBase,
  readGitCommits,
  validateGitRange,
  renderGitTrailerSummary,
  runGit
} from '../scripts/git-trailers.mjs';

const execFileAsync = promisify(execFile);
const participants = ['ramincsy', 'backrebital-lgtm'];

test('resolveGitBase prefers --base, then GIT_BASE, and ignores zero SHAs', () => {
  assert.equal(resolveGitBase({ argv: ['--base=origin/main'], env: { GIT_BASE: 'abc' } }), 'origin/main');
  assert.equal(resolveGitBase({ argv: [], env: { GIT_BASE: 'abcdef' } }), 'abcdef');
  assert.equal(resolveGitBase({ argv: [], env: { GIT_BASE: '0'.repeat(40) } }), null);
  assert.equal(isPlaceholderSha('0000000'), true);
});

test('parseGitLog reconstructs commit messages and noreply author logins', () => {
  const commits = parseGitLog([
    'aa11bb22\x0034828058+ramincsy@users.noreply.github.com\x00ramincsy\x00docs: pair work\n\nCo-authored-by: backrebital-lgtm <329678572+backrebital-lgtm@users.noreply.github.com>\x1e',
    'cc33dd44\x00practice@users.noreply.github.com\x00Practice\x00solo docs\x1e'
  ].join(''));
  assert.equal(commits.length, 2);
  assert.equal(commits[0].authorLogin, 'ramincsy');
  assert.match(commits[0].message, /Co-authored-by: backrebital-lgtm/);
  assert.equal(commits[1].authorLogin, 'practice');
});

test('validateGitRange uses injected git and rejects placeholder trailers', async () => {
  const log = 'deadbee\x00a@b.co\x00A\x00Fix\n\nCo-authored-by: backrebital-lgtm <name@example.com>\x1e';
  const gitRun = async args => {
    if (args[0] === 'rev-list') return { stdout: 'deadbee\n', stderr: '' };
    if (args[0] === 'log') return { stdout: log, stderr: '' };
    throw new Error(`unexpected git ${args[0]}`);
  };
  const result = await validateGitRange({ gitRun, base: 'abc', participants });
  assert.equal(result.ok, false);
  assert.equal(result.commitCount, 1);
  assert.match(result.errors.join('\n'), /placeholder domain/);
});

test('empty git range is valid solo work', async () => {
  const gitRun = async args => {
    if (args[0] === 'rev-list') return { stdout: '', stderr: '' };
    throw new Error('log should not run for an empty range');
  };
  const result = await validateGitRange({ gitRun, base: 'origin/main', participants });
  assert.equal(result.ok, true);
  assert.equal(result.commitCount, 0);
  assert.match(renderGitTrailerSummary(result), /not guaranteed/);
});

test('runGit redacts a failed command as a short git error', async () => {
  await assert.rejects(runGit(['rev-parse', '--verify', '--quiet', 'no-such-ref-xyz'], {
    execFileImpl: async () => {
      const error = new Error('Command failed');
      error.stderr = 'fatal: Needed a single revision\n';
      throw error;
    }
  }), /git rev-parse failed: fatal: Needed a single revision/);
});

test('real git range validates a well-formed peer trailer and ignores an unmerged close', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'git-trailers-'));
  try {
    const git = async args => execFileAsync('git', args, { cwd: root, encoding: 'utf8' });
    await git(['init', '-b', 'main']);
    await git(['config', 'user.name', 'ramincsy']);
    await git(['config', 'user.email', '34828058+ramincsy@users.noreply.github.com']);
    await writeFile(path.join(root, 'README.md'), '# practice\n');
    await git(['add', 'README.md']);
    await git(['commit', '-m', 'docs: start']);
    await git(['checkout', '-b', 'docs/pair']);
    await writeFile(path.join(root, 'note.md'), 'shared\n');
    await git(['add', 'note.md']);
    await git(['commit', '-m', [
      'docs: shared note',
      '',
      'Co-authored-by: backrebital-lgtm <329678572+backrebital-lgtm@users.noreply.github.com>'
    ].join('\n')]);
    const commits = await readGitCommits({
      gitRun: async (args, options) => {
        const { stdout, stderr } = await execFileAsync('git', args, { cwd: options.cwd, encoding: 'utf8' });
        return { stdout, stderr };
      },
      base: 'main',
      cwd: root
    });
    assert.equal(commits.length, 1);
    const result = await validateGitRange({
      gitRun: async (args, options) => {
        const { stdout, stderr } = await execFileAsync('git', args, { cwd: options.cwd, encoding: 'utf8' });
        return { stdout, stderr };
      },
      base: 'main',
      cwd: root,
      participants,
      requirePeer: true
    });
    assert.equal(result.ok, true);
    assert.equal(result.peerTrailer, true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
