# Functional verification

The primary regression command exercises real PostgreSQL routers and accounting invariants. It refuses missing, remote, or non-test database URLs instead of silently skipping integration tests. Use a disposable database, never the working database or a production URL.

```sh
createdb -h localhost vestov_test_functional
DATABASE_URL=postgresql://localhost:5432/vestov_test_functional npm run db:migrate
TEST_DATABASE_URL=postgresql://localhost:5432/vestov_test_functional npm run test:functional
npm run build
```

The test runner sets all integration database variables to the same local database, disables external notifications and runs suites serially. Tests create and remove their own fixtures. Database setup/migration is explicit; the runner never creates or migrates the working database. The 6 September verification passed 50 top-level tests without skips.

Existing legacy Cypress/Playwright password-login specifications predate mandatory Clerk login and must not be used as proof of current authorization or payroll behavior.

## Isolated browser fixture

`tests/ui/server.ts` mounts the real routers with temporary application sessions for synthetic roles; `tests/ui/vite.config.ts` substitutes only the external Clerk provider. These files are not imported by production or the normal Vite build. The backend binds to `127.0.0.1:3018`; the frontend runs at `127.0.0.1:5178`.

For the dated September fixture, create and migrate a separate `vestov_ui_test_*` database. On first use of a different database, remove only the generated `output/fix-2026-09-06/ui-fixtures.json` file so IDs are seeded again. Start:

```sh
TEST_DATABASE_URL=postgresql://localhost:5432/vestov_ui_test_20260906 node --import tsx tests/ui/server.ts
VITE_CLERK_PUBLISHABLE_KEY=pk_test_fixture npx vite --config tests/ui/vite.config.ts
```

Open `/api/__fixture__/as/admin`, `/as/employee`, `/as/client` or `/as/outsider` under the same fixture prefix to establish a test session. Accounts, invoices, projects, schedules and a private text file are synthetic. Reset the fixture database when re-running date-sensitive scenarios outside September 2026. Do not point this server at a deployed host or expose it publicly.

For an admin-only dashboard failure check, `/api/__fixture__/summary/unavailable` returns to Today with an injected 503 for summary; `/api/__fixture__/summary/available` restores the real route. These controls exist only in this fixture server.

This verifies interface-to-database behavior, not a live external identity provider. Before a production release, separately validate real Clerk sign-in for the three roles, configured external integrations and persistent-file restart behavior. [Current QA results](audits/2026-09-06/results.md).
