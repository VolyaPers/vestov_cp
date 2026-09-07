# Employment types

The Team profile is the source of truth. Job position, billable/internal status and client billing rates remain independent of employment type.

| Rule | Full-time | Part-time | Freelancer |
| --- | --- | --- | --- |
| Portal account | Yes | Yes | No |
| Monthly base salary input | Actual amount | Actual amount, never halved | Unavailable |
| Monthly and one-off payroll extras | 100% | 50%, rounded per item to cents | Unavailable |
| Annual vacation allocation by career year | 16 / 20 / 24 days | 8 / 10 / 12 days | None |
| Standard sick / personal days | 7 / 5 | 3.5 / 2.5 | None |
| Year-end unused vacation review cap | 5 days | 2.5 days | None |
| Workspace reimbursement rate | 50% of expense | 25% of expense | None |
| Annual reimbursement budget, years 1–5+ | $300 / 400 / 500 / 600 / 700 | $150 / 200 / 250 / 300 / 350 | None |
| Training, language, tools benefits | Standard approved benefit | 50% of standard benefit | None |
| Project fees | Use employee payroll | Use employee payroll | Any agreed USD amount per project |

Custom leave allocations and adjustments are stored as full-time equivalents and use the same factor. Used and pending leave days are actual days and are never halved. Anniversary and half-year release boundaries remain the same. Vacation compensation still requires an explicit payroll adjustment; a balance is not a cash payment. Do not additionally halve the actual salary when calculating a daily rate. Amounts entered as payroll extras are full-time equivalents; the server applies the factor once. Receipts already have a calculated amount and are not reduced again at payment.

## Administration

- **Team → Add team member** selects all three types. Full-time and part-time link an existing employee user. Freelancer creates only a Team profile, with a contact email and position.
- **Team → profile → Edit** changes employment type. **Finances → Salaries** sets actual monthly salary and full-time-equivalent bonus/benefit amounts. The card and payment preview show payable amounts.
- Assign freelancers to projects in **Clients → client → service → Team**. Assignment labels come from Team; project rates are client billing prices, not freelancer compensation.
- **Freelancer profile → Project fees** records an agreed amount and milestone. Accrual does not create a cash expense. Only the workflow owner or finance deputy may record payment. Payments are linked to the project, team member and cash transaction, protected against retries and concurrent submissions. Unpaid accruals may be cancelled; paid records cannot be independently edited or deleted through generic transactions.
- When the transfer is actually made, use **Record payment** on that accrual and enter the payment date. This is the step that creates the linked finance transaction and marks the fee as paid.

## Changing type and historical data

Saved payroll periods and cash transactions retain their amounts and policy. Salary history snapshots retain employment type so later profile changes do not halve old draft salary terms again. A type change applies to unsaved current-month payroll and future terms; no automatic mid-month proration is performed. Current leave entitlements use the current Team type; past consumption and previously calculated reimbursement amounts are preserved. Reimbursement reservations count against the current type's budget and may leave no available budget after a reduction.

Open salary periods and outstanding reimbursements must be resolved before changing an employee to Freelancer. Conversion clears recurring employee terms, hides the freelancer from employee scheduling/benefit lists and disables any linked employee account. An active administrator account must first be reassigned/deactivated in Users.

Changing a Freelancer to Part-time or Full-time requires the actual monthly salary. The same Team profile and ID are retained, so project fees and linked cash transactions are not copied or rewritten. The conversion creates a new employee portal account or reactivates the previously linked account. If it has no Clerk identity yet, an administrator generates its invitation link in **Users**. Previous project payments remain visible in the Team profile and in the employee's **My Salary → Previous freelancer payments** section.

Freelancer login, existing sessions, API access, Clerk linking, invitations and user impersonation are denied on the server. Freelancer profiles cannot request leave or initialize employee payroll, including through administrative API calls.

## Migration and verification

`0040_employment_policy.sql` is additive. It validates the supported Team types, snapshots types in salary history and payroll periods, and adds project fee accruals. Existing payroll snapshots retain the full-time policy under which the previous system accrued their amounts. No production database is modified by local validation.

Run `npm run test:functional` with a fresh disposable local `vestov_test_*` database after migration, then `npm run build`. New tests cover exact cents, stored and default leave allocations, actual part-time base salary, monthly/ad hoc bonuses, reimbursement reservations, preserved payroll snapshots, freelancer access denial, conversion guards, fee accruals and concurrent idempotent payments.
