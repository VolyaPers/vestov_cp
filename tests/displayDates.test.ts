import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { formatDate, parseLocalDate, calculateDays } from '../src/lib/utils'

test('missing or invalid profile dates never crash rendering', () => {
  for (const value of [undefined, null, '', 'invalid', '2026-02-31', new Date(NaN)]) assert.equal(formatDate(value), 'Not specified')
})

test('date-only display and leave calculation retain local calendar dates', () => {
  const originalTimezone = process.env.TZ
  try {
    for (const timezone of ['Europe/Kyiv', 'America/Los_Angeles']) {
      process.env.TZ = timezone
      assert.equal(formatDate('2026-09-07'), '7 September 2026')
      assert.equal(parseLocalDate('2026-09-07').getDate(), 7)
      assert.equal(calculateDays('2026-09-04', '2026-09-07'), 2)
      assert.equal(calculateDays('2026-09-04', '2026-09-07', true, true), 1)
    }
  } finally { if (originalTimezone === undefined) delete process.env.TZ; else process.env.TZ = originalTimezone }
})
