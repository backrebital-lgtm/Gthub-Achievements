import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';

function extract(markdown, kind, id) {
  const match = markdown.match(new RegExp(`<!-- ${kind}:${id} -->\\s*\`\`\`[^\\n]*\\n([\\s\\S]*?)\\n\`\`\``));
  assert.ok(match, `missing ${kind}:${id}`);
  return match[1];
}

function runBash(script, env) {
  return new Promise((resolve, reject) => {
    const child = execFile('bash', ['-s'], { env: { ...process.env, ...env } }, (error, stdout, stderr) => {
      if (error) {
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
      } else resolve({ stdout, stderr });
    });
    child.stdin.end(script);
  });
}

test('local branch tutorial merges one change and leaves an unmerged close off main', async () => {
  const markdown = await readFile(new URL('../docs/examples/branch-pr.fa.md', import.meta.url), 'utf8');
  assert.match(markdown, /تفاوت close و merge/);
  assert.match(markdown, /بدون merge/);
  assert.match(markdown, /دو بازبین انسانی مستقل نیست/);
  const root = await mkdtemp(path.join(tmpdir(), 'branch-pr-'));
  try {
    const { stdout } = await runBash(extract(markdown, 'runnable', 'local-pr'), { ROOT: root });
    assert.match(stdout, new RegExp(`OK ${root}`));
    assert.equal(existsSync(path.join(root, 'docs-example.txt')), true);
    assert.equal(existsSync(path.join(root, 'closed.txt')), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('co-author sample uses a noreply trailer and does not treat shared accounts as two humans', async () => {
  const markdown = await readFile(new URL('../docs/examples/attribution.fa.md', import.meta.url), 'utf8');
  const sample = extract(markdown, 'sample', 'co-author');
  assert.match(sample, /^Co-authored-by: backrebital-lgtm <ID\+backrebital-lgtm@users\.noreply\.github\.com>$/m);
  assert.match(markdown, /Settings → Emails/);
  assert.match(markdown, /یک مالک/);
  assert.match(markdown, /پرسش و پاسخ ساختگی/);
  assert.match(markdown, /creating-a-commit-with-multiple-authors/);
  assert.match(markdown, /moderating-discussions/);
  assert.match(markdown, /انسان مستقل نیست/);
});
