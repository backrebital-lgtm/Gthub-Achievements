# Changelog

## 0.3.6

- Local `npm run coauthor` validates `Co-authored-by` trailers from `git log` without `GH_TOKEN`. CI runs it on the triggering ref; solo commits without trailers remain allowed.
- `npm test` now sets `--test-timeout=30000` so a hung test fails the job instead of sitting until the runner limit.
- Persian contribution checklist and achievement notes state that Quickdraw (close within about five minutes) and YOLO (merge without review) are not automated and are out of scope.
## 0.3.5

- Collaboration progress report counts well-formed peer `Co-authored-by` trailers on merged pull request commits (Pair Extraordinaire candidates only; not a grant).
- Practical Persian Pair Extraordinaire example uses public Users API ids `34828058` (ramincsy) and `329678572` (backrebital-lgtm) and still requires Settings → Emails confirmation.
- Two accounts share one owner; an automatic review request is not an independent human review. Achievements are not guaranteed.

## 0.3.4

- Token-bearing workflows (`Validate co-authors`, `Collaboration progress report`) check out the default branch only. Co-author validation still reads PR commits through the API; it does not execute the PR tree.
- `npm run check` now treats any workflow that injects `GH_TOKEN` like a privileged checkout, not only jobs with `issues: write` or `pull-requests: write`.
- `GITHUB_TOKEN` remains `github-actions[bot]` and does not grant Achievements.

## 0.3.3

- Hourly coordinator refreshes the handoff report when a same-repo review is submitted or dismissed; comment-only reviews do not start a run.
- Privileged workflows (`Hourly maintenance`, `Request peer review`) check out the default branch only. `GITHUB_TOKEN` remains `github-actions[bot]` and does not grant Achievements.

## 0.3.2

- Dual-account workflows for co-author trailer checks, peer review requests and a read-only merged-PR progress report.
- Achievement research matrix with official vs community labels; Q&A discussion template without fabricated answers.
- Hourly maintenance coordinator unchanged.

## 0.3.1

- Coordinator reads native GitHub `blocked by` links before assigning ready work; open blockers skip assignment, closed blockers do not, and the `blocked` label remains the manual stop.
- Missing dependency lists (HTTP 404/410) are treated as empty; creating or deleting dependencies is still forbidden. Reports mention blocker numbers without copying untrusted issue text.

## 0.3.0

- Practical Persian branch/PR tutorial with a locally tested merge-versus-close example.
- Attribution troubleshooting for noreply emails, real co-author trailers and honest Q&A Discussions.
- Coordinator inspects pull requests in number order, records API page counts and states when the per-run review cap skipped remaining pulls.
- GitHub writes are limited to issue assignment, review requests and the coordination issue; repository checks reject tokens and unpinned Actions.
- MIT license, security policy, issue contact links and pinned Actions `checkout@v7.0.1` / `setup-node@v7.0.0`.

## 0.2.0

- Balanced assignment for explicitly ready work, with two active tasks per person.
- Review requests for the other collaborator; current-commit review status in reports.
- Read-only dry-run mode and bounded hourly mutations.
- Pagination, API failure and concurrency regression coverage.
- Pinned GitHub Actions, Node.js 22 runtime, weekly Dependabot checks and CODEOWNERS.
- Persian collaboration handbook, bug report form and documented stop controls.
- Event-driven coordination using only trusted default-branch code; schedule remains a fallback.
- Fresh review/workload checks, unresolved-change tracking, safe network retries and run summaries.

## 0.1.0

- Persian contribution guide, hourly coordination summary and CI.
- Corrected report-marker handling for ordinary issues.
