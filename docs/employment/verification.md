# Employment policy verification — 7 September 2026

Implemented locally; no production migration, push, deployment or external notification was performed.

## Automated checks

- Fresh PostgreSQL database migration, including `0040_employment_policy`: passed.
- Complete functional suite on `vestov_test_employment_final_20260907`: **74 passed, 0 failed, 0 skipped**.
- Final targeted employment/conversion and employee calendar regression run: **8 passed, 0 failed, 0 skipped**.
- Final freelancer contact-email conflict guard: **7 passed, 0 failed** in the targeted employment suite.
- Frontend production build and server build: passed.

An initial run used a database left with a fixture owner after test setup failed; two unrelated notification-recipient assertions caught that residue. The final full run used a newly created, migrated database and passed without skips.

## Browser checks

Used the repository's isolated UI fixture with real Express routes and PostgreSQL, synthetic users/projects, and a substituted external Clerk provider. No live external identity-provider sign-in or production state is claimed.

- Team creation: selected Freelancer, entered contact name/email/position, and saved a Team profile without a user account.
- Freelancer profile: no vacation balance, preferred shifts or leave-request sections; project fees visible.
- Assigned a synthetic project fixture, accrued **$737.19**, recorded payment through the confirmation form, reloaded and verified **outstanding $0 / paid $737.19**, with a transaction reference.
- Part-time reimbursement: UI showed **$150** first-year budget and **25%** coverage. Entered a **$100** expense, previewed **$25**, submitted, and verified **$25 reserved / $125 available**.
- Part-time payroll: card showed actual base **$2,000**, monthly extras **$50**, total **$2,050**. The form showed full-time-equivalent bonus input **$100**, displayed the 50% rule and **$2,050** payout preview. Submission saved **$2,050** in payment history.
- Mobile viewport **390 × 844**: freelancer and salary pages had no horizontal document overflow. Corrected the profile header/badge wrapping and removed the remaining freelancer vacation placeholder found during visual inspection.

## Policy review

Actual part-time salary is never reduced again. Per-item bonus rounding uses cents. New and stored leave allocations use one factor; consumed leave and paid money are unchanged. Reimbursement payment does not halve the already calculated reimbursement a second time. Existing payroll snapshots remain immutable across employment type changes. Converting to Freelancer cannot strand open salary/reimbursement obligations. Server checks cover direct APIs, identity linking, legacy sessions, invitations, impersonation and socket authentication.
