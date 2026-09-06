import test from 'node:test';
import assert from 'node:assert/strict';
import { sickEpisodeDays } from './leavePolicy.js';

const leave = (startDate: string, endDate = startDate, extra: Record<string, any> = {}) => ({ startDate, endDate, ...extra });
const sick = (id: number, startDate: string, endDate = startDate, extra: Record<string, any> = {}) => ({
  ...leave(startDate, endDate), id, leaveTypeId: 2, status: 'approved', ...extra,
});

test('short sick policy uses working days and half-day fractions', () => {
  assert.equal(sickEpisodeDays(leave('2027-01-08', '2027-01-11'), [], [2]), 2, 'Friday through Monday is two working days');
  assert.equal(sickEpisodeDays(leave('2027-01-11', '2027-01-13', { halfDayStart: true, halfDayEnd: true }), [], [2]), 2);
  assert.equal(sickEpisodeDays(leave('2027-01-09', '2027-01-10'), [], [2]), 0);
});

test('splitting or extending adjacent sick leave cannot renew the automatic approval allowance', () => {
  const requests = [sick(1, '2027-01-07', '2027-01-08'), sick(2, '2027-01-11', '2027-01-12', { status: 'pending' })];
  assert.equal(sickEpisodeDays(leave('2027-01-13'), requests, [2]), 5, 'Finds the whole transitive episode through a weekend');
  assert.equal(sickEpisodeDays(leave('2027-01-11'), [sick(1, '2027-01-08')], [2]), 2);
  assert.equal(sickEpisodeDays(leave('2027-01-12'), [sick(1, '2027-01-08')], [2]), 1, 'A full working day between episodes starts a new episode');
  assert.equal(sickEpisodeDays(leave('2027-01-11', '2027-01-13'), [sick(1, '2027-01-11', '2027-01-12')], [2], 1), 3, 'Edit excludes the saved version');
});

test('sick episode ignores closed and other leave while recognizing sick-type aliases and complementary half-days', () => {
  const requests = [
    sick(1, '2027-01-11', '2027-01-11', { halfDayEnd: true, leaveTypeId: 3 }),
    sick(2, '2027-01-12', '2027-01-13', { status: 'canceled' }),
    sick(3, '2027-01-12', '2027-01-13', { status: 'denied' }),
    sick(4, '2027-01-12', '2027-01-13', { archivedAt: new Date() }),
    sick(5, '2027-01-12', '2027-01-13', { leaveTypeId: 1 }),
  ];
  assert.equal(sickEpisodeDays(leave('2027-01-11', '2027-01-11', { halfDayStart: true }), requests, [2, 3]), 1);
});
