import test from 'node:test';
import assert from 'node:assert/strict';
import { employmentCycleForDate, getEffectiveDay, isoDate, leaveDaySegments, leaveOverlaps, zonedDateTime, shiftWorkMinutes } from './calendar.js';
import { summarizeLeave } from './vacationBalanceCalculator.js';
const vacation = {
  id: 1,
  name: 'Vacation',
  isDeductible: true,
  halfDaySupported: true
};
function context(requests: any[] = [], startDate = '2026-01-01', balances: any[] = []) {
  return {
    member: {
      id: 1,
      startDate,
      timezone: 'UTC'
    },
    cycles: [{
      id: 1,
      cycleStart: '2026-01-01',
      cycleEnd: '2026-12-31'
    }],
    balances,
    types: [vacation],
    requests
  } as any;
}
const approved = (startDate: string, endDate: string, extra: any = {}) => ({
  id: 1,
  leaveTypeId: 1,
  status: 'approved',
  startDate,
  endDate,
  ...extra
});
test('first-year allowance is available during both halves', () => {
  const balance = summarizeLeave(context(), vacation, '2026-09-01');
  assert.equal(balance.totalAllocated, 16);
  assert.equal(balance.secondHalfRemaining, 16);
  assert.equal(balance.currentlyAvailable, 16);
});
test('later years enforce separate half allocations with correct locked amount', () => {
  const balance = summarizeLeave(context([approved('2026-01-05', '2026-01-09')], '2025-01-01'), vacation, '2026-02-01');
  assert.equal(balance.totalAllocated, 20);
  assert.equal(balance.firstHalfRemaining, 5);
  assert.equal(balance.secondHalfRemaining, 10);
  assert.equal(balance.lockedUntilSecondHalf, 10);
});
test('a request crossing the midpoint charges each half by actual dates', () => {
  const balance = summarizeLeave(context([approved('2026-06-30', '2026-07-02')], '2025-01-01'), vacation, '2026-09-01');
  assert.equal(balance.firstHalfUsed, 1);
  assert.equal(balance.secondHalfUsed, 2);
  assert.equal(balance.totalUsed, 3);
});
test('an absence crossing anniversary is split across cycles exactly once', () => {
  const c = context([approved('2026-12-31', '2027-01-02')]);
  assert.equal(summarizeLeave(c, vacation, '2026-12-31').totalUsed, 1);
  // January 2, 2027 is Saturday; only the Friday in the next cycle consumes leave.
  assert.equal(summarizeLeave(c, vacation, '2027-01-02').totalUsed, 1);
});
test('half-day overlap allows complementary halves and rejects intersecting slots', () => {
  const am = {
    startDate: '2026-09-01',
    endDate: '2026-09-01',
    halfDayEnd: true
  };
  const pm = {
    startDate: '2026-09-01',
    endDate: '2026-09-01',
    halfDayStart: true
  };
  assert.equal(leaveOverlaps(am, pm), false);
  assert.equal(leaveOverlaps(am, am), true);
  assert.equal(leaveDaySegments(pm)[0].units, 0.5);
  assert.throws(() => leaveDaySegments({
    ...pm,
    halfDayEnd: true
  }), /Choose one/);
});
test('invalid and reversed dates cannot silently charge positive leave', () => {
  assert.throws(() => isoDate('2026-02-30'));
  assert.throws(() => leaveDaySegments({
    startDate: '2026-09-02',
    endDate: '2026-09-01'
  }));
});
test('anniversary years stay correct across leap year and February 29', () => {
  assert.equal(employmentCycleForDate('2024-01-01', '2024-12-31').careerYear, 1);
  assert.equal(employmentCycleForDate('2024-01-01', '2025-01-01').careerYear, 2);
  assert.equal(employmentCycleForDate('2024-02-29', '2025-02-28').cycleStart, '2025-02-28');
});
test('individual allocation and adjustments are respected everywhere', () => {
  const balance = summarizeLeave(context([], '2026-01-01', [{
    employmentCycleId: 1,
    leaveTypeId: 1,
    totalDays: '30',
    adjustmentDays: '2'
  }]), vacation, '2026-09-01');
  assert.equal(balance.totalAllocated, 32);
  assert.equal(balance.currentlyAvailable, 32);
  assert.ok(balance.allocationWarning);
});
test('schedule timezone maps 09:00 New York to 13:00 UTC in summer', () => {
  assert.equal(zonedDateTime('2026-09-07', '09:00', 'America/New_York').toISOString(), '2026-09-07T13:00:00.000Z');
});
test('overnight shift uses actual elapsed minutes over DST; nonexistent time rejected', () => {
  const day = getEffectiveDay({
    date: '2026-03-07',
    timezone: 'America/New_York',
    schedule: {
      startTime: '22:00',
      endTime: '06:00'
    }
  });
  assert.equal(day.scheduledMinutes, 420);
  assert.throws(() => zonedDateTime('2026-03-08', '02:30', 'America/New_York'), /does not exist/);
});
test('override and approved half leave control expected attendance; denied leave does not', () => {
  const input = {
    date: '2026-09-07',
    timezone: 'UTC',
    schedule: {
      startTime: '09:00',
      endTime: '17:00'
    }
  };
  const leave = {
    startDate: input.date,
    endDate: input.date,
    halfDayEnd: true,
    status: 'approved'
  };
  const day = getEffectiveDay({
    ...input,
    leaves: [leave]
  });
  assert.equal(day.workingMinutes, 240);
  assert.equal(day.absenceMinutes, 240);
  assert.equal(day.expectedStartAt, '2026-09-07T13:00:00.000Z');
  assert.equal(getEffectiveDay({
    ...input,
    leaves: [{
      ...leave,
      status: 'denied'
    }]
  }).workingMinutes, 480);
  assert.equal(getEffectiveDay({
    ...input,
    override: {
      startTime: '00:00',
      endTime: '00:00',
      isDayOff: true
    }
  }).workingMinutes, 0);
  assert.equal(getEffectiveDay(input).workingMinutes, 480); // Sunday shifts remain real schedules.
});
test('actual work time clips and merges historical overlapping breaks', () => {
  const shift = {
    startTime: '2026-09-01T09:00:00Z',
    endTime: '2026-09-01T17:00:00Z'
  };
  const pauses = [{
    startTime: '2026-09-01T08:00:00Z',
    endTime: '2026-09-01T09:30:00Z'
  }, {
    startTime: '2026-09-01T12:00:00Z',
    endTime: '2026-09-01T13:00:00Z'
  }, {
    startTime: '2026-09-01T12:30:00Z',
    endTime: '2026-09-01T13:30:00Z'
  }, {
    startTime: '2026-09-01T18:00:00Z',
    endTime: null
  }];
  assert.deepEqual(shiftWorkMinutes(shift, pauses, new Date('2026-09-01T19:00:00Z')), {
    elapsedMinutes: 480,
    breakMinutes: 120,
    workingMinutes: 360
  });
});
test('configured career-year allocation supplies missing cycles, saved individual overrides remain authoritative', () => {
  const c = {
    ...context(),
    settings: [{
      leaveTypeId: 1,
      cycleNumber: 1,
      allocatedDays: '18',
      isDefault: false
    }, {
      leaveTypeId: 1,
      cycleNumber: 3,
      allocatedDays: '26',
      isDefault: true
    }]
  };
  assert.equal(summarizeLeave(c, vacation, '2026-09-01').totalAllocated, 18);
  assert.equal(summarizeLeave(c, vacation, '2027-09-01').totalAllocated, 20);
  assert.equal(summarizeLeave(c, vacation, '2030-09-01').totalAllocated, 26);
});
