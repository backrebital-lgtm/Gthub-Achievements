function latestDecisions(pull, reviews) {
  const latest = new Map();
  for (const review of [...reviews].sort((a, b) => a.id - b.id)) {
    if (!review.user || review.user.login === pull.user.login || ['COMMENTED', 'PENDING'].includes(review.state)) continue;
    latest.set(review.user.login, review);
  }
  return [...latest.values()];
}

export function reviewState(pull, reviews) {
  const latest = latestDecisions(pull, reviews);
  // A new commit alone does not resolve an outstanding request for changes.
  if (latest.some(r => r.state === 'CHANGES_REQUESTED')) return 'changes-requested';
  const current = latest.filter(r => r.commit_id === pull.head.sha);
  if (current.some(r => r.state === 'APPROVED')) return 'approved-current-commit';
  if ((pull.requested_reviewers ?? []).length) return 'review-requested';
  return 'needs-review';
}

const hasLabel = (issue, label) => (issue.labels ?? []).some(l => (typeof l === 'string' ? l : l.name) === label);
export function planAssignments(issues, config) {
  const load = new Map(config.participants.map(p => [p, 0]));
  for (const issue of issues.filter(i => !i.pull_request && i.state !== 'closed')) for (const assignee of issue.assignees ?? []) {
    if (load.has(assignee.login)) load.set(assignee.login, load.get(assignee.login) + 1);
  }
  const priority = i => hasLabel(i, 'priority:high') ? 0 : hasLabel(i, 'priority:normal') ? 1 : 2;
  const eligible = issues.filter(i => !i.pull_request && i.state !== 'closed' && hasLabel(i, config.readyLabel) && !hasLabel(i, config.blockedLabel) && !(i.assignees ?? []).length);
  const actions = [];
  for (const issue of eligible.sort((a, b) => priority(a) - priority(b) || a.number - b.number)) {
    const person = [...config.participants].sort((a, b) => load.get(a) - load.get(b))[0];
    if (load.get(person) >= config.maxAssignedPerPerson) break;
    actions.push({ number: issue.number, assignee: person });
    load.set(person, load.get(person) + 1);
  }
  return actions;
}

export function reviewerFor(pull, reviews, participants) {
  if (pull.draft || !participants.includes(pull.user.login)) return null;
  const peer = participants.find(p => p !== pull.user.login);
  if (!peer || (pull.requested_reviewers ?? []).some(r => r.login === peer)) return null;
  const decision = latestDecisions(pull, reviews).find(r => r.user.login === peer);
  if (decision?.commit_id === pull.head.sha && ['APPROVED', 'CHANGES_REQUESTED'].includes(decision.state)) return null;
  return peer;
}
