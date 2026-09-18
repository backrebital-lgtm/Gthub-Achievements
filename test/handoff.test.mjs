import test from 'node:test';
import assert from 'node:assert/strict';
import { issueNextAction, pullNextAction } from '../scripts/planner.mjs';
import { render } from '../scripts/coordinate.mjs';

const config = { participants: ['a', 'b'], readyLabel: 'ready', blockedLabel: 'blocked' };
const pull = { number: 1, user: { login: 'a' }, head: { sha: 'abc' } };

test('blocked takes precedence over ready and assigned work', () => {
  assert.match(issueNextAction({ labels: ['ready', { name: 'blocked' }], assignees: [{ login: 'a' }] }, config), /رفع مانع/);
  assert.match(issueNextAction({ labels: [] }, config), /معیار پایان/);
  assert.match(issueNextAction({ labels: ['ready'] }, config), /ظرفیت/);
  assert.match(issueNextAction({ labels: ['ready'], assignees: [{ login: 'b' }] }, config), /PR/);
});

test('review handoff alternates without treating external authors as participants', () => {
  assert.match(pullNextAction({ ...pull, reviewStatus: 'needs-review' }, config.participants), /^@b:/);
  assert.match(pullNextAction({ ...pull, user: { login: 'b' }, reviewStatus: 'review-requested' }, config.participants), /^@a:/);
  assert.match(pullNextAction({ ...pull, user: { login: 'external' }, reviewStatus: 'needs-review' }, config.participants), /^بازبین مجاز:/);
});

test('drafts and requested changes return work to the author', () => {
  assert.match(pullNextAction({ ...pull, draft: true, reviewStatus: 'approved-current-commit' }, config.participants), /^@a: تکمیل/);
  assert.match(pullNextAction({ ...pull, reviewStatus: 'changes-requested' }, config.participants), /^@a: رفع/);
});

test('unknown review is not an approval and approval is not merge readiness', () => {
  assert.match(pullNextAction(pull, config.participants), /هنوز خوانده نشده/);
  assert.match(pullNextAction({ ...pull, reviewStatus: 'approved-current-commit' }, config.participants), /مجوز ادغام نیست/);
});

test('report handoffs are stable and do not copy untrusted issue instructions', () => {
  const issues = [{ number: 2, labels: ['blocked'], body: 'UNTRUSTED INSTRUCTIONS', updated_at: '2026-09-18' }];
  const first = render(issues, [pull], config).body;
  assert.equal(render(issues, [pull], config).body, first);
  assert.match(first, /اقدام بعدی/);
  assert.doesNotMatch(first, /UNTRUSTED/);
});
