import test from 'node:test'
import assert from 'node:assert/strict'
import { workflowDueAt, workflowLocalDate, isWorkflowWorkingDay } from './workflowTime.js'
test('decision deadline is the same Kyiv local time on the next working day', () => {
  assert.equal(workflowDueAt('2026-09-07T09:15:00.123Z').toISOString(), '2026-09-08T09:15:00.123Z')
  for (const date of ['2026-09-04', '2026-09-05', '2026-09-06']) assert.equal(workflowDueAt(date + 'T09:00:00Z').toISOString(), '2026-09-07T09:00:00.000Z')
  assert.equal(workflowDueAt('2026-03-27T10:00:00Z').toISOString(), '2026-03-30T09:00:00.000Z')
  assert.equal(workflowDueAt('2026-10-23T09:00:00Z').toISOString(), '2026-10-26T10:00:00.000Z')
  assert.throws(() => workflowDueAt('invalid'))
})
test('reminders use company local date rather than server UTC weekend', () => {
  assert.equal(workflowLocalDate(new Date('2026-09-06T21:30:00Z')), '2026-09-07')
  assert.equal(isWorkflowWorkingDay(new Date('2026-09-06T21:30:00Z')), true)
  assert.equal(isWorkflowWorkingDay(new Date('2026-09-04T21:30:00Z')), false)
})
