# Financial implementation and verification — 2026-09-06

Implemented in the shared working tree; no commit, publication, production access, or bank transfer was performed by this financial subtask.

## Audit coverage

| Findings | Implementation |
|---|---|
| PAY-01/02/04 | Integer-cent boundary validation; structured `payrollData`; transactional period snapshots and member locks; idempotent retries; base-balance protection; typed extras including punctuation; required reasons for monthly adjustments; dedicated edit/void audit. Generic transaction routes reject payroll bypasses. |
| PAY-03 | Salary rate and extras history with effective dates; month snapshots retain terms; monthly fixed USD policy explicit; no guessed debt from today's salary across past months. Unknown legacy descriptions are never parsed for accounting and block new payouts pending reconciliation. Explicit current-month accrual opening records debt without pretending cash was paid. |
| INV-01 | One server calculator used for preview, create, and service edits. Assignment IDs are canonical. Removed people stay excluded; zero fixed price is preserved; explicit hourly mode replaces stored fixed price; no invented rate/hours defaults. Persisted service/developer lines are returned in details. Both admin invoice entry points now share one editor/details component. |
| FIN-01 | Payment date is required for paid status; clearing a payment explicitly reopens the invoice. Finances, dashboard cash receipt aggregates, and revenue reports use paidAt. Invoice cancellation preserves number, detail and audit. Paid invoices require reopening before pricing changes/cancellation. |
| FIN-02 | Extra payments included in expenses and charts. Voided transactions excluded from financial aggregates, dashboard and salary balances. Decimal strings converted and summed in cents. Cancelled invoices excluded and drafts do not count as receivables. Overdue segments do not overlap outstanding segments. |
| FIN-03 | Recurring checkbox explicitly means a recurring-expense label with manual entry per period. It makes no unsupported promise to schedule or transfer money. |
| FIN-04 | Salary creation/edit/void use salary-specific audit events. All loaded payments can be filtered by selected year, including old records. Finance logs work independently of transaction filtering. |
| REIM-01/02/03 | Member transaction locks reserve current-career-year budgets for pending/approved/confirmed/paid requests; request and payout idempotency. Strict state transitions; receipt upload confirms evidence, separate recorded payout writes a linked expense. Paid records cannot be edited/voided through generic financial paths. Employee dashboard consumes the same entitlement DTO (employee agent). |
| ADM-01..04/08 | Reports read `isBillable`, status and client memberships, correctly sum decimal amounts, use equal nonoverlapping prior periods/client filters, display all invoice statuses, and show data-load errors. Revenue period uses actual payment date. |
| Additional | Own-only employee salary endpoint/page; exact evidence ownership; active multi-client invoice membership access; no unauthenticated invoice debug endpoints; saved invoice detail and developer breakdown; monthly date presets keep Kyiv calendar boundaries; due-today invoices remain current for the full date. |

## Policy deliberately preserved

Salary is a fixed monthly USD amount. Terms apply to periods beginning on or after their effective date. Attendance, sick leave, vacation, breaks, taxes, overtime, project time and currency conversion do not silently change this amount. There is no invented hourly/leave multiplier. An explicit monthly override requires a reason and is recorded in the snapshot/audit. Existing unknown historical payments require administrator reconciliation through the dedicated payroll editor. Historical months without a recorded accrual are identified as unreviewed rather than shown as fully paid. Draft historical terms expose provenance metadata; unknown past extras are not accrued automatically. Saving such a payment, or reconciling a legacy payment, requires a confirmation checkbox and a reconciliation note. The reviewed evidence is saved in payrollData and the period calculation note. Profile baselines begin in the current month, not at an invented historical employment-start rate.

`Record payment` records a completed payment. It does not initiate a bank transfer. A reimbursement receipt remains `confirmed` until a separate payout records `paid`, its date and financial transaction reference. Linked reimbursements require deliberate reconciliation and cannot be casually deleted through transaction CRUD.

## Server interfaces

- `GET /finances/salaries/:teamMemberId/period/:month`: structured period terms, remaining components, status and legacy payment IDs.
- `POST /finances/salaries/:teamMemberId/period/:month/initialize`: idempotently opens the current accrual without a cash transaction.
- `POST /finances/salaries/record`: strict structured amount/components plus `idempotencyKey`.
- `PUT /finances/salaries/payments/:id`: dedicated audited editing/reconciliation.
- `GET /finances/my-salary`: own payments and period statements; role and authoritative employee ID checked.
- `POST /reimbursements/:id/pay`: confirmed receipt → linked paid expense, with date and retry key.
- `assertPayrollDatesOpen(tx, memberId, start, end)` acquires the same payroll member lock before checking closed periods; employee leave lifecycle uses it.
- `updateMonthlySalaryFromProfile(tx, memberId, monthlyRate, actorId)` is used by root's employee edit path, preserving baseline/history/audit.

## Verification

`node --import tsx --test server/src/services/finance.test.ts tests/reportCalculations.test.ts`

Seven pure tests pass: decimal validation, punctuation/partial salary/default extras, legacy metadata rejection, fixed zero/hourly override, decimal report sums and previous period boundaries, due-today handling, Kyiv month boundaries.

`TEST_DATABASE_URL=postgresql://localhost:5432/vestov_fresh_20260906 node --import tsx --test server/src/services/finance.integration.test.ts server/src/services/finance.http.integration.test.ts`

Two database/HTTP integration suites pass. They create unique fixtures and clean them up. The test-only Express harness injects fixture identities; no production authentication bypass was added. Outbound email/Slack settings are removed before route import. Receipt files use a temporary directory that is removed afterward.

Covered flows include concurrent full salary payments (one accepted), identical retry (same record), mismatched totals rejected, future rate preserves closed historical snapshot, closed-period leave guard, historical terms requiring explicit confirmation, two legacy partial payments reconciled into one known month without an incorrect base, same server invoice preview/persistence, missing/foreign assignments rejected, private client invoice ACL, paid-state invariants, service total edits requiring calculation, cancellation retaining lines, employee statement isolation, current accrual retry without duplicate, parallel reimbursement cap, approve conflict, receipt upload owner checks, confirmed receipt not paid, payout retries, linked-payout generic deletion blocked, salary void reopening its balance, and successful finance audit GET before/after mutations.

The root agent separately verified salary UI reload with $400 base + $100 `Health + Dental` extra, and is performing cross-role browser/regression verification. Financial files compile with the frontend and server TypeScript checks; final overall build/release remains coordinated by root.
