import type { Request, Response } from 'express'
import { accessibleClientIds, canAccessClient } from './access.js'
import { addDays } from '../utils/calendar.js'

export const dateKey = (date = new Date()) => date.toISOString().slice(0, 10)

export function coversDate(record: { isActive?: boolean; startDate?: string | null; endDate?: string | null }, date: string) {
  return record.isActive !== false && (!record.startDate || record.startDate <= date) && (!record.endDate || record.endDate >= date)
}

export function overlapsPeriod(record: { isActive?: boolean; startDate?: string | null; endDate?: string | null }, start: string, end: string) {
  // A closed assignment still belongs to the historical dates before its end.
  return (record.isActive !== false || !!record.endDate) && (!record.startDate || record.startDate <= end) && (!record.endDate || record.endDate >= start)
}

export function assignmentCapacity(schedule: unknown, dayOfWeek: number): number {
  if (!schedule || typeof schedule !== 'object' || Array.isArray(schedule)) return 1
  const day = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][dayOfWeek]
  const value = (schedule as Record<string, unknown>)[day]
  return value === 'half' ? 0.5 : value === 'full' ? 1 : 0
}

export function scopedLeaveSegments<T extends { startDate: string; endDate: string; halfDayStart: boolean; halfDayEnd: boolean }>(leave: T, allowedDates: string[]) {
  const dates = [...new Set(allowedDates)].filter(date => date >= leave.startDate && date <= leave.endDate).sort()
  const ranges: { startDate: string; endDate: string }[] = []
  for (const date of dates) {
    const previous = ranges[ranges.length - 1]
    if (previous && addDays(previous.endDate, 1) === date) previous.endDate = date
    else ranges.push({ startDate: date, endDate: date })
  }
  return ranges.map(range => ({ ...leave, ...range,
    halfDayStart: range.startDate === leave.startDate && leave.halfDayStart,
    halfDayEnd: range.endDate === leave.endDate && leave.halfDayEnd,
  }))
}

export async function resolveClientScope(req: Request, res: Response, value: unknown = req.query.clientId ?? req.body?.clientId): Promise<number | null> {
  if (!req.user || !['admin', 'client'].includes(req.user.role)) {
    res.status(403).json({ error: 'Client access required' })
    return null
  }
  let clientId = value === undefined || value === null || value === '' ? null : Number(value)
  if (clientId === null) {
    const allowed = await accessibleClientIds(req.user)
    if (allowed.length === 1) clientId = allowed[0]
    else {
      res.status(400).json({ error: 'Select a client workspace' })
      return null
    }
  }
  if (!Number.isSafeInteger(clientId) || clientId <= 0) {
    res.status(400).json({ error: 'Invalid client ID' })
    return null
  }
  if (!await canAccessClient(req.user, clientId)) {
    res.status(403).json({ error: 'Access denied to this client' })
    return null
  }
  return clientId
}

export function clientServiceDto<T extends Record<string, any>>(service: T) {
  const { rate, serviceLevelPrice, slackChannelId, clickupListId, clickupListName, projectBotEnabled, projectBotDailyUpdateEnabled, projectBotDailyUpdateTime, projectBotTimezone, projectBotAuthorizedSlackUserIds, ...publicFields } = service
  return publicFields
}

export function clientAssignmentDto<T extends Record<string, any>>(assignment: T) {
  const { hourlyRate, fixedPrice, ...publicFields } = assignment
  return { ...publicFields, assignmentId: assignment.id, employeeId: assignment.developerId ?? assignment.teamMemberId }
}
