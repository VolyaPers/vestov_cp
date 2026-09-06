/** Response SLAs use the company's Monday–Friday calendar in Kyiv.
 * Preserve local clock time across DST. Weekend submissions are due the next Monday at the same local time.
 * No public-holiday calendar has been configured by the company.
 */
export const WORKFLOW_TIMEZONE = 'Europe/Kyiv'
const formatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: WORKFLOW_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
})
function localClock(date: Date): number {
  const parts = Object.fromEntries(formatter.formatToParts(date).map(p => [p.type, p.value]))
  return Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second, date.getUTCMilliseconds())
}
function clockToInstant(clock: number): Date {
  let instant = clock
  for (let i = 0; i < 4; i++) instant += clock - localClock(new Date(instant))
  return new Date(instant)
}
export function workflowDueAt(createdAt: Date | string): Date {
  const source = new Date(createdAt)
  if (!Number.isFinite(source.getTime())) throw new Error('Invalid workflow creation date')
  const local = new Date(localClock(source))
  do { local.setUTCDate(local.getUTCDate() + 1) } while ([0, 6].includes(local.getUTCDay()))
  return clockToInstant(local.getTime())
}
export function workflowLocalDate(now = new Date()): string {
  return new Date(localClock(now)).toISOString().slice(0, 10)
}
export function isWorkflowWorkingDay(now = new Date()): boolean {
  return ![0, 6].includes(new Date(localClock(now)).getUTCDay())
}
