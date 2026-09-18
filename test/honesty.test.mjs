import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Persian docs say Quickdraw and YOLO are not project automation goals', async () => {
  const fa = await readFile(new URL('../docs/achievements.fa.md', import.meta.url), 'utf8');
  const contributing = await readFile(new URL('../CONTRIBUTING.md', import.meta.url), 'utf8');
  const collab = await readFile(new URL('../docs/collaboration.fa.md', import.meta.url), 'utf8');
  const workflows = await readFile(new URL('../docs/workflows.fa.md', import.meta.url), 'utf8');
  for (const text of [fa, contributing, collab, workflows]) {
    assert.match(text, /Quickdraw/);
    assert.match(text, /YOLO/);
    assert.match(text, /۵ دقیقه|5 دقیقه|پنج دقیقه/);
    assert.match(text, /بدون review|بدون بررسی/);
    assert.doesNotMatch(text, /برای گرفتن نشان .*ببند|ببندید تا Quickdraw/);
  }
  assert.match(fa, /خودکارسازی نمی‌شود/);
  assert.match(contributing, /npm run coauthor/);
  assert.match(contributing, /یک مالک/);
  assert.match(contributing, /trailer noreply خوش‌فرم یک عضو/);
  assert.doesNotMatch(contributing, /فقط وقتی نویسندهٔ GitHub برابر/);
});

test('achievement config records Quickdraw and YOLO as not automated', async () => {
  const config = JSON.parse(await readFile(new URL('../config/achievements.json', import.meta.url), 'utf8'));
  assert.equal(config.quickdraw.automated, false);
  assert.equal(config.yolo.automated, false);
  assert.match(config.quickdraw.notes, /badge|نشان/i);
  assert.match(config.yolo.notes, /review/i);
});
