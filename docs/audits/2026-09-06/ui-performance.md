# Local UI and performance update — 6 September 2026

## Preview

- Main application: http://localhost:5173 (API on port 3001).
- Isolated UI preview: http://127.0.0.1:5179, using disposable local fixtures and the actual production-mode frontend build.
- Fixture role entry points: `/api/__fixture__/as/admin`, `/api/__fixture__/as/employee`, `/api/__fixture__/as/client`.
- Local notifications and the project bot are disabled. The validation below was performed locally before publication.

## Interface

- One compact header and sidebar across all three roles; neutral surfaces, system typography, smaller controls, and simpler page headings and metrics.
- Removed redundant dashboard summaries and decorative containers. Employee quick actions lead directly to leave requests, reimbursements and profile settings.
- Mobile navigation uses a focus-trapped dialog, closes on navigation or Escape, and is mounted only while open.
- Preferred shift fields have weekday-specific accessible labels. Employee metrics are visible in a mobile grid.
- Client search and filters wrap on narrow screens; row actions remain visible on touch devices. Fixed off-screen dashboard cards imposing a 520px minimum width.
- Global search includes employee salary and the separate client Overview and Projects pages.

## Loading changes

- Production frontend builds explicitly set `NODE_ENV=production`; the local `.env` previously caused development React code in the build output.
- Charts are split from the dashboard and finance pages and load near the viewport. The salary tab does not request financial overview/comparison data or chart chunks.
- Route code warms on sidebar hover/focus, except with data-saving or slow network settings.
- Concurrent identical GET requests share one promise. Completed responses are not cached by this mechanism, and writes invalidate pending-read sharing.
- User memberships are batched for the current page instead of requesting each user separately; page results and total count are queried concurrently.
- Client workspace assignments share the existing query cache; independent employee dashboard/profile requests run concurrently.
- Removed the remote font dependency and date-fns from shared display utilities. Missing/invalid profile dates render safely; date-only values retain their local calendar day.

## Build comparison

Vite output sizes in decimal kB; rounded. These compare the initial local build configuration with the final configuration, not measured production download time.

| Asset | Before | After |
| --- | ---: | ---: |
| Main JavaScript | 572.2 | 313.3 |
| Main JavaScript, gzip | 160.9 | 92.3 |
| Sign-in page | 13.6 | 1.8 |
| Admin dashboard | 63.3 | 27.5 |
| Finance page | 211.4 | 100.8 |
| Styles | 118.5 | 109.9 |

## Validation

- `npm run build`: frontend and server pass.
- Functional suite: 55 passed, zero failed or skipped, using a disposable migrated local database. Covers payroll, calendar/leave, role access, client isolation and the new date/request handling cases.
- Production-preview browser sweep: 26 render checks across all three roles, at 390px and 1440px; no JavaScript errors or document-level horizontal overflow.
- Additional 360px checks: administrator dashboard, clients, client dashboard and employee dashboard; client search/status filtering, mobile menu Escape, company switching and persistence after reload.
- Verified preferred shift save and reload persistence, then restored the fixture schedule.
- Verified keyboard navigation from global search to employee salary after adding the missing shortcut.
- Network capture confirms no per-user membership requests and no chart chunks or overview/comparison requests on the salary tab.
- Browser reports and screenshots are stored locally in the ignored `output/playwright/` directory; build logs are in `/tmp/vestov-build-final.log` and the functional test log is `/tmp/vestov-functional-complete.log`.

The browser checks use fixture authentication and data. They do not establish live Clerk sign-in, external bank/ClickUp/Slack integration availability, or production performance.
