# Decisions and notifications

Implemented policy agreed with Volodymyr on 2026-09-06.

## Authority

- Volodymyr owns all projects, approves purchases and handles client feedback.
- Patricia is the administrative deputy: leave, sick leave, salary/time administration and reimbursement payment recording. She can read the common decision queue and feedback; she cannot approve purchases or answer client feedback.
- The migration binds the verified existing active admin accounts `v@vestov.com` and `p.rangel@vestov.com` to persistent user IDs. Renaming an account or changing its email does not transfer authority. No users or role promotions are created by the migration.
- Other administrator capabilities outside this release remain unchanged. Server checks protect the workflow operations, including salary-linked reimbursements. Impersonation is a read-only preview for these workflows; it cannot supply client consent.
- `WORKFLOW_OWNER_USER_IDS` and `WORKFLOW_DEPUTY_USER_IDS` are explicit comma-separated overrides, primarily for isolated QA. They still require active admin accounts. Production uses stored `workflow_assignments` with no role-wide fallback.

## Requests and deadlines

- Sick leave of at most two working days is approved automatically. Weekdays and half-days use the existing leave calendar (Monday–Friday); neighbouring sick requests, including across weekends, count as one episode.
- Longer sick leave requires Volodymyr or Patricia. Extending automatically approved sick leave beyond the threshold returns the edited request to pending and removes it from approved calendar totals until the decision. Original values remain in the audit trail. Payroll locks are enforced before changes.
- Vacation requires approval. Purchase approval is separate from evidence confirmation and payment recording.
- One working day for vacation/purchase decisions, long-sick-leave approval and the first response to client feedback. The deadline is the same local clock time on the next Monday–Friday date in Europe/Kyiv; DST is respected. A weekend submission is due on Monday. Public holidays are not separately configured.
- A sick-leave extension starts its decision clock when it becomes pending. Editing an already pending request does not postpone its deadline.
- Passing a deadline causes a reminder; it never approves or closes a request automatically.

## Feedback and navigation

- `My decisions` links to the exact leave request, reimbursement or feedback conversation. Awaiting-client/receipt items do not count as an action the manager must take.
- Feedback is private to its author on the client side, even among users of the same company. Current company access is checked on every read/write.
- A manager reply moves a thread into progress. The manager may propose resolution; only the client author confirms it. The author can reopen a resolved thread. Previous responses and named message/event history are retained.
- Initial conversation lists are bounded to 50 threads and 3 recent messages per thread. Older conversations/history load incrementally. A direct link can open a conversation outside the loaded page.
- Company selection follows validated notification links for clients with several workspaces.

## Delivery

HUB notifications and Slack outbox entries are committed in the same transaction as the request/decision. A worker runs every minute. Slack delivery uses the existing enabled bot, matches the recipient's HUB email with their Slack identity and sends a private bot DM. No medical reason, receipt or feedback content is copied into Slack. No fallback to a public/project channel exists.

One overdue reminder is created per outstanding decision deadline. Unique event/recipient keys prevent duplicate reminders and payment events. Outdated reminders are suppressed even when Slack is disabled. The outbox has leases, retry-after/exponential backoff, and a stable Slack client message ID. It retries after outages; exactly-once delivery across an external-service/network failure cannot be guaranteed.

The queue displays Slack configuration/delivery problems. A person missing from Slack (or a bot lacking `users:read.email` / `chat:write`) retains their HUB inbox; delivery remains pending with its error rather than being marked successful. The Slack flag/token being configured alone is not evidence of delivery.

References: [Slack email lookup](https://docs.slack.dev/reference/methods/users.lookupByEmail/), [private bot messages](https://docs.slack.dev/reference/methods/chat.postMessage/).

## Verification

- Full functional suite: 65 passed, zero skipped. Tests include permissions and impersonation, calendar/payroll locks, atomic rollback, client consent/privacy, history pagination and Slack delivery/retry with a mocked network.
- Production-mode client and server builds pass.
- Migration checked on existing local databases and an empty disposable database, then applied again to verify safe repeat execution.
- Browser QA uses separate local fixture data; no test leave/payments or client messages are submitted on production.

- Browser end-to-end: client created feedback for an active project, manager opened it from My decisions and proposed resolution, original client confirmed resolution; state and message times were correct after role switch/reload. A notification selected the correct company after changing workspaces.
- Browser discovery fixed: raw SQL message timestamps must decode as UTC instants, verified under TZ=Europe/Kyiv.
- Final employee browser QA: short sick leave remained approved after reload and contributed one absence unit on each day; longer sick leave stayed pending; the exact-request admin link and all decision buttons worked at 390px. A clipped mobile action row was repaired and rechecked. All four leave fixtures were canceled after QA.
