import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

async function walk(dir) {
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

const errors = [];
for (const file of await walk('.')) {
  if (!/\.(md|json)$/.test(file)) continue;
  const text = await readFile(file, 'utf8');
  if (!text.trim()) errors.push(`${file}: empty file`);
  if (file.endsWith('.json')) {
    try { JSON.parse(text); } catch { errors.push(`${file}: invalid JSON`); }
  } else {
    for (const match of text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
      const link = match[1];
      if (/^(https?:|mailto:|#)/.test(link)) continue;
      const target = path.resolve(path.dirname(file), link.split('#')[0]);
      try { await stat(target); } catch { errors.push(`${file}: missing link ${link}`); }
    }
  }
}
if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else console.log('JSON and local documentation links are valid.');
