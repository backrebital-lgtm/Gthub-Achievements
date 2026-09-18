import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { validateConfig } from './config.mjs';

const SECRET_RE = /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}\b|\bgithub_pat_[A-Za-z0-9_]{20,}\b/;
const REQUIRED = [
  'README.md', 'CONTRIBUTING.md', 'LICENSE', 'SECURITY.md', 'CHANGELOG.md',
  'config/collaboration.json', 'docs/setup.fa.md', 'docs/collaboration.fa.md',
  'docs/achievements.fa.md', 'docs/examples/branch-pr.fa.md', 'docs/examples/attribution.fa.md',
  'docs/examples/pair-extraordinaire.fa.md'
];

export async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (['.git', '.local', 'node_modules'].includes(entry.name)) continue;
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(file));
    else files.push(file);
  }
  return files;
}

export async function checkRepo(root = '.') {
  const errors = [];
  for (const rel of REQUIRED) {
    try { await stat(path.join(root, rel)); } catch { errors.push(`missing required file: ${rel}`); }
  }
  try {
    const config = validateConfig(JSON.parse(await readFile(path.join(root, 'config/collaboration.json'), 'utf8')));
    if (config.repository !== 'ramincsy/Gthub-Achievements') errors.push('config repository must stay ramincsy/Gthub-Achievements');
    if (config.participants[0] !== 'ramincsy' || config.participants[1] !== 'backrebital-lgtm') {
      errors.push('config participants must stay ramincsy and backrebital-lgtm');
    }
  } catch (error) {
    errors.push(`config/collaboration.json: ${error.message}`);
  }
  for (const file of await walk(root)) {
    if (!/\.(md|json|yml|yaml|mjs)$/.test(file)) continue;
    const text = await readFile(file, 'utf8');
    if (!text.trim()) errors.push(`${file}: empty file`);
    if (SECRET_RE.test(text)) errors.push(`${file}: looks like a GitHub token; remove it`);
    if (file.endsWith('.json')) {
      try { JSON.parse(text); } catch { errors.push(`${file}: invalid JSON`); }
    }
    if (/\.md$/.test(file)) {
      for (const match of text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
        const link = match[1];
        if (/^(https?:|mailto:|#)/.test(link)) continue;
        const target = path.resolve(path.dirname(file), link.split('#')[0]);
        try { await stat(target); } catch { errors.push(`${file}: missing link ${link}`); }
      }
    }
    if (/(^|[/\\])workflows[/\\].+\.ya?ml$/.test(file)) {
      if (/secrets\./.test(text)) errors.push(`${file}: workflows must not read repository secrets`);
      for (const action of text.matchAll(/uses:\s*(\S+)/g)) {
        if (!/@[a-f0-9]{40}$/.test(action[1])) errors.push(`${file}: unpinned action ${action[1]}`);
      }
      if (!/node-version:\s*'22'/.test(text)) errors.push(`${file}: expected Node.js 22`);
      if (!/persist-credentials:\s*false/.test(text)) errors.push(`${file}: persist-credentials must be false`);
      const usesToken = /GH_TOKEN:\s*\$\{\{/.test(text);
      const canWrite = /issues:\s*write|pull-requests:\s*write/.test(text);
      if (usesToken || canWrite) {
        if (!/ref:\s*\$\{\{\s*github\.event\.repository\.default_branch\s*\}\}/.test(text)) {
          errors.push(`${file}: token-bearing workflows must check out the default branch`);
        }
        if (!/allow-unsafe-pr-checkout:\s*false/.test(text)) {
          errors.push(`${file}: token-bearing workflows must disable unsafe PR checkout`);
        }
        if (/ref:\s*\$\{\{\s*github\.event\.pull_request/.test(text) || /github\.head_ref/.test(text)) {
          errors.push(`${file}: token-bearing workflows must not check out PR head`);
        }
      }
    }
  }
  return errors;
}

async function main() {
  const errors = await checkRepo('.');
  if (errors.length) {
    console.error(errors.join('\n'));
    process.exitCode = 1;
  } else console.log('JSON, workflows and local documentation links are valid.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
