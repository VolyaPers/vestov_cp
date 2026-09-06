import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve, join } from 'node:path'
import { spawnSync } from 'node:child_process'

const root = fileURLToPath(new URL('../', import.meta.url))
const configured = process.env.TEST_DATABASE_URL
if (!configured) throw new Error('Set TEST_DATABASE_URL to a migrated, disposable local vestov_test_* database. The functional suite must not silently skip database checks.')
const database = new URL(configured)
if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/vestov_test_/.test(database.pathname)) {
  throw new Error('Functional tests require a disposable localhost vestov_test_* database.')
}

function testFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? testFiles(path) : entry.name.endsWith('.test.ts') ? [path] : []
  })
}

const environment = {
  ...process.env,
  DATABASE_URL: configured,
  TEST_DATABASE_URL: configured,
  EMPLOYEE_CALENDAR_TEST_DATABASE_URL: configured,
  TIMESTAMP_TEST_DATABASE_URL: configured,
  SLACK_NOTIFICATIONS_ENABLED: 'false',
  PROJECT_BOT_ENABLED: 'false',
}
for (const key of ['SLACK_BOT_TOKEN', 'SLACK_CHANNEL_ID', 'SLACK_ADMIN_CHANNEL_ID', 'INVITE_EMAIL_WEBHOOK_URL', 'EMAIL_WEBHOOK_URL', 'RESEND_WEBHOOK_URL', 'RESEND_API_KEY', 'SENDGRID_API_KEY', 'CLERK_SECRET_KEY', 'STRIPE_SECRET_KEY']) environment[key] = ''

const result = spawnSync(process.execPath, ['--import', 'tsx', '--test', '--test-concurrency=1', ...testFiles(resolve(root, 'server/src')), ...testFiles(resolve(root, 'tests'))], {
  cwd: root,
  env: environment,
  stdio: 'inherit',
})
if (result.error) throw result.error
process.exitCode = result.status ?? 1
