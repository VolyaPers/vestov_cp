import test from 'node:test'
import assert from 'node:assert/strict'
import { assignmentCapacity, clientAssignmentDto, clientServiceDto, coversDate, overlapsPeriod, scopedLeaveSegments } from './clientWorkspace.js'

test('client active team is date-effective and inclusive on the final assignment day', () => {
  const assignment = { isActive: true, startDate: '2026-09-10', endDate: '2026-09-20' }
  assert.equal(coversDate(assignment, '2026-09-09'), false)
  assert.equal(coversDate(assignment, '2026-09-10'), true)
  assert.equal(coversDate(assignment, '2026-09-20'), true)
  assert.equal(coversDate(assignment, '2026-09-21'), false)
  assert.equal(coversDate({ ...assignment, isActive: false }, '2026-09-12'), false)
})

test('closed assignments remain in historical months but never leak into future periods', () => {
  const ended = { isActive: false, startDate: '2026-03-10', endDate: '2026-03-20' }
  assert.equal(overlapsPeriod(ended, '2026-03-01', '2026-03-31'), true)
  assert.equal(overlapsPeriod(ended, '2026-04-01', '2026-04-30'), false)
  assert.equal(overlapsPeriod(ended, '2026-02-01', '2026-02-28'), false)
  assert.equal(overlapsPeriod({ isActive: false, startDate: '2026-03-10' }, '2026-03-01', '2026-03-31'), false)
})

test('client assignment identity never confuses assignment and employee and excludes prices', () => {
  const dto = clientAssignmentDto({ id: 800, developerId: 42, name: 'Fixture', hourlyRate: '50', fixedPrice: '4000' })
  assert.equal(dto.assignmentId, 800)
  assert.equal(dto.employeeId, 42)
  assert.equal('hourlyRate' in dto, false)
  assert.equal('fixedPrice' in dto, false)
})

test('client project payload contains no financial or bot authorization configuration', () => {
  const dto = clientServiceDto({ id: 1, serviceTitle: 'Project A', rate: '50', serviceLevelPrice: '4000', slackChannelId: 'private', clickupListId: 'private', projectBotAuthorizedSlackUserIds: ['private'], projectBotEnabled: true })
  assert.deepEqual(dto, { id: 1, serviceTitle: 'Project A' })
})

test('project allocation honors explicit half and off days without inventing weekdays', () => {
  assert.equal(assignmentCapacity(null, 6), 1)
  assert.equal(assignmentCapacity({ saturday: 'full', monday: 'half', tuesday: 'off' }, 6), 1)
  assert.equal(assignmentCapacity({ monday: 'half' }, 1), 0.5)
  assert.equal(assignmentCapacity({ tuesday: 'off' }, 2), 0)
  assert.equal(assignmentCapacity({ monday: 'full' }, 6), 0)
})

test('absence disclosure is restricted to assignment dates and keeps only original half-day boundaries', () => {
  const leave = { startDate: '2026-09-08', endDate: '2026-09-15', halfDayStart: true, halfDayEnd: true }
  assert.deepEqual(scopedLeaveSegments(leave, ['2026-09-10', '2026-09-11', '2026-09-14', '2026-09-15']), [
    { startDate: '2026-09-10', endDate: '2026-09-11', halfDayStart: false, halfDayEnd: false },
    { startDate: '2026-09-14', endDate: '2026-09-15', halfDayStart: false, halfDayEnd: true },
  ])
  assert.deepEqual(scopedLeaveSegments(leave, ['2026-09-07', '2026-09-16']), [])
})
