import test from 'node:test';
import assert from 'node:assert/strict';
import { planAssignments, reviewerFor, reviewState } from '../scripts/planner.mjs';
const config = { participants: ['a', 'b'], readyLabel: 'ready', blockedLabel: 'blocked', maxAssignedPerPerson: 2 };
const issue = (number, extra = {}) => ({ number, state: 'open', labels: [{ name: 'ready' }], assignees: [], ...extra });
const pull = { number: 1, draft: false, head: { sha: 'new' }, user: { login: 'a' }, requested_reviewers: [] };
const review = (state, commit_id = 'new', id = 1) => ({ id, state, commit_id, user: { login: 'b' } });

test('ready work is balanced with a cap and priority', () => {
  const plan = planAssignments([issue(1), issue(2), issue(3), issue(4), issue(5, { labels: ['ready', 'priority:high'] })], config);
  assert.deepEqual(plan, [{ number: 5, assignee: 'a' }, { number: 1, assignee: 'b' }, { number: 2, assignee: 'a' }, { number: 3, assignee: 'b' }]);
});
test('manual assignments, closed, blocked, unready work and PRs are preserved', () => {
  assert.deepEqual(planAssignments([
    issue(1, { assignees: [{ login: 'a' }] }), issue(2, { state: 'closed' }),
    issue(3, { labels: ['ready', 'blocked'] }), issue(4, { labels: [] }), issue(5, { pull_request: {} })
  ], config), []);
});
test('existing workload directs new work to the other participant', () => {
  assert.deepEqual(planAssignments([issue(1, { assignees: [{ login: 'a' }] }), issue(2)], config), [{ number: 2, assignee: 'b' }]);
});
test('approval on old commit requires a fresh review', () => {
  assert.equal(reviewState(pull, [review('APPROVED', 'old')]), 'needs-review');
  assert.equal(reviewerFor(pull, [review('APPROVED', 'old')], ['a', 'b']), 'b');
});

test('unresolved changes survive a new commit but request another review', () => {
  const reviews = [review('CHANGES_REQUESTED', 'old')];
  assert.equal(reviewState(pull, reviews), 'changes-requested');
  assert.equal(reviewerFor(pull, reviews, ['a', 'b']), 'b');
  assert.equal(reviewState(pull, [...reviews, review('APPROVED', 'new', 2)]), 'approved-current-commit');
});
test('current approval and change request do not repeatedly request review', () => {
  for (const state of ['APPROVED', 'CHANGES_REQUESTED']) assert.equal(reviewerFor(pull, [review(state)], ['a', 'b']), null);
});
test('comments do not erase decisions, dismissal does', () => {
  assert.equal(reviewState(pull, [review('APPROVED'), review('COMMENTED', 'new', 2)]), 'approved-current-commit');
  assert.equal(reviewState(pull, [review('APPROVED'), review('DISMISSED', 'new', 2)]), 'needs-review');
});
test('pending review, drafts and external authors do not get automatic requests', () => {
  assert.equal(reviewerFor({ ...pull, requested_reviewers: [{ login: 'b' }] }, [], ['a', 'b']), null);
  assert.equal(reviewerFor({ ...pull, draft: true }, [], ['a', 'b']), null);
  assert.equal(reviewerFor({ ...pull, user: { login: 'external' } }, [], ['a', 'b']), null);
});
test('open native blockers skip assignment; closed blockers do not', () => {
  const blockers = new Map([
    [1, [{ number: 9, state: 'open', body: 'UNTRUSTED' }]],
    [2, [{ number: 8, state: 'closed' }]]
  ]);
  assert.deepEqual(planAssignments([issue(1), issue(2)], config, blockers), [{ number: 2, assignee: 'a' }]);
});
test('uninspected candidates are not assigned when a dependency map is provided', () => {
  assert.deepEqual(planAssignments([issue(1), issue(2)], config, new Map([[1, []]])), [{ number: 1, assignee: 'a' }]);
});
