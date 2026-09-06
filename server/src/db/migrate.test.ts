import test from 'node:test'
import assert from 'node:assert/strict'
import { assertLegacyUpgradeSafe } from './migrate.js'

function legacyFixture({ developers = 0, assignments = 0, memberships = 0 } = {}) {
  return { query: async (query: string, values?: string[]) => {
    assert.match(query, /^SELECT /, 'Preflight must not modify historical data')
    if (query.includes('to_regclass')) return { rows: [{ relation: values![0] }] }
    if (query.includes('information_schema')) return { rows: [{ exists: true }] }
    if (query.includes('"developers"')) return { rows: [{ count: developers }] }
    if (query.includes('"client_service_developers"')) return { rows: [{ count: assignments }] }
    if (query.includes('client_id IS NOT NULL')) return { rows: [{ count: memberships }] }
    throw new Error(`Unexpected query ${query}`)
  } } as any
}

test('legacy upgrade refuses to drop personnel, orphan assignments or client memberships', async () => {
  await assert.rejects(assertLegacyUpgradeSafe(legacyFixture({ developers: 1 })), /Legacy developers/)
  await assert.rejects(assertLegacyUpgradeSafe(legacyFixture({ assignments: 1 })), /Legacy client_service_developers/)
  await assert.rejects(assertLegacyUpgradeSafe(legacyFixture({ memberships: 1 })), /Legacy user client memberships/)
})

test('legacy upgrade permits empty obsolete structures', async () => {
  await assert.doesNotReject(assertLegacyUpgradeSafe(legacyFixture()))
})
