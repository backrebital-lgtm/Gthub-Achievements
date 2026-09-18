import { memberLoginsFromNoreplyTrailers } from './coauthor.mjs';

const BOT_LOGIN = /\[bot\]$/i;

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

export function openBlockers(blockers = []) {
  return blockers.filter(blocker => blocker && blocker.state === 'open' && Number.isInteger(blocker.number));
}

function blockedByNative(issue, blockersByNumber) {
  if (!blockersByNumber) return false;
  if (!blockersByNumber.has(issue.number)) return true;
  return openBlockers(blockersByNumber.get(issue.number)).length > 0;
}

export function assignmentCandidates(issues, config) {
  const priority = i => hasLabel(i, 'priority:high') ? 0 : hasLabel(i, 'priority:normal') ? 1 : 2;
  return issues
    .filter(i => !i.pull_request && i.state !== 'closed' && hasLabel(i, config.readyLabel)
      && !hasLabel(i, config.blockedLabel) && !(i.assignees ?? []).length)
    .sort((a, b) => priority(a) - priority(b) || a.number - b.number);
}

export function issueNextAction(issue, config) {
  if (hasLabel(issue, config.blockedLabel) || openBlockers(issue.blockedBy).length) {
    return 'رفع مانع و ثبت نتیجه در همین Issue؛ کار جدید شروع نشود';
  }
  if (!hasLabel(issue, config.readyLabel)) return 'روشن‌کردن مسئله و معیار پایان پیش از آماده‌سازی';
  if (!(issue.assignees ?? []).length) return 'انتظار برای ظرفیت واگذاری؛ مسئول تازه بدون بررسی ظرفیت تعیین نشود';
  return 'اجرای معیار پایان، ثبت شواهد آزمون و تحویل PR مرتبط به حساب مقابل';
}

export function pullNextAction(pull, participants) {
  const author = pull.user.login;
  const peer = participants.includes(author) ? participants.find(p => p !== author) : null;
  if (pull.draft) return `@${author}: تکمیل تغییر و آزمون‌ها پیش از درخواست بررسی`;
  if (pull.reviewStatus === 'changes-requested') return `@${author}: رفع درخواست اصلاح و ثبت پاسخ مستند؛ سپس بررسی دوبارهٔ commit تازه`;
  if (pull.reviewStatus === 'approved-current-commit') return 'بررسی CI آخرین head، ایرادهای حل‌نشده و قوانین شاخه؛ تأیید review به‌تنهایی مجوز ادغام نیست';
  if (!pull.reviewStatus) return 'وضعیت review هنوز خوانده نشده؛ پیش از هر تصمیم بررسی شود';
  return `${peer ? `@${peer}` : 'بازبین مجاز'}: بررسی diff واقعی و ثبت نتیجه برای همین commit؛ نه تأیید خودکار بدون بررسی`;
}

export function planAssignments(issues, config, blockersByNumber) {
  const load = new Map(config.participants.map(p => [p, 0]));
  for (const issue of issues.filter(i => !i.pull_request && i.state !== 'closed')) for (const assignee of issue.assignees ?? []) {
    if (load.has(assignee.login)) load.set(assignee.login, load.get(assignee.login) + 1);
  }
  const eligible = assignmentCandidates(issues, config).filter(i => !blockedByNative(i, blockersByNumber));
  const actions = [];
  for (const issue of eligible) {
    const person = [...config.participants].sort((a, b) => load.get(a) - load.get(b))[0];
    if (load.get(person) >= config.maxAssignedPerPerson) break;
    actions.push({ number: issue.number, assignee: person });
    load.set(person, load.get(person) + 1);
  }
  return actions;
}

export function reviewCandidates(pull, participants, commits) {
  const author = pull.user?.login;
  const members = participants.filter(p => !BOT_LOGIN.test(p) && p !== author);
  if (participants.includes(author)) return members;
  if (!memberLoginsFromNoreplyTrailers(commits, participants).length) return [];
  return members;
}

export function reviewerFor(pull, reviews, participants, { commits } = {}) {
  if (pull.draft) return null;
  const requested = new Set((pull.requested_reviewers ?? []).map(r => r.login));
  for (const peer of reviewCandidates(pull, participants, commits)) {
    if (requested.has(peer) || BOT_LOGIN.test(peer)) continue;
    const decision = latestDecisions(pull, reviews).find(r => r.user.login === peer);
    if (decision?.commit_id === pull.head.sha && ['APPROVED', 'CHANGES_REQUESTED'].includes(decision.state)) continue;
    return peer;
  }
  return null;
}
