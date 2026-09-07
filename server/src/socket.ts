import { isFreelancerAccount } from './services/employmentPolicy.js'
import type { Request, RequestHandler } from 'express'
import passport from 'passport'
import { and, eq, inArray, sql } from 'drizzle-orm'
import { db } from './db/index.js'
import { users, clientServiceTeamMembers, clientServices } from './db/schema.js'
import { accessibleClientIds, effectiveProjectPredicate, resolveEmployeeId } from './services/access.js'
import { Server as HttpServer } from 'http'
import { Server, Socket } from 'socket.io'

let io: Server | null = null

// Event types for type safety
export interface ShiftEventData {
  shiftId: number
  employeeId: number
  employeeName: string
  employeeEmail: string
  serviceId?: number
  serviceName?: string
  clientName?: string
  timestamp: string
}

export interface BreakEventData {
  breakId: number
  shiftId: number
  employeeId: number
  employeeName: string
  employeeEmail: string
  breakType?: string
  breakNote?: string
  timestamp: string
}

export type ShiftEvents = {
  'shift:started': ShiftEventData
  'shift:ended': ShiftEventData
  'break:started': BreakEventData
  'break:ended': BreakEventData
}

export function initializeSocket(httpServer: HttpServer, corsOrigin: string | string[] | false, sessionMiddleware: RequestHandler): Server {
  io = new Server(httpServer, {
    path: '/api/socket.io',
    cors: { origin: corsOrigin || false, methods: ['GET', 'POST'], credentials: true },
    transports: ['polling'],
  })
  io.engine.use(sessionMiddleware)
  io.engine.use(passport.initialize())
  io.engine.use(passport.session())
  io.use(async (socket, next) => {
    const request = socket.request as Request
    if (!request.isAuthenticated?.() || request.user?.isActive === false) return next(new Error('Authentication required'))
    try {
      if (await isFreelancerAccount(request.user)) return next(new Error('Freelancers do not have portal access'))
      next()
    } catch (error) { next(error as Error) }
  })
  io.on('connection', (socket: Socket) => {
    const request = socket.request as Request
    socket.join(`session:${request.sessionID}`)
    socket.join(`user:${request.user!.id}`)
    // Rooms are selected exclusively by the server. Client join requests are ignored.
    const timer = setInterval(() => {
      request.session.reload((error) => {
        if (error || !(request.session as any).passport?.user) socket.disconnect(true)
      })
    }, 30_000)
    timer.unref()
    socket.on('disconnect', () => clearInterval(timer))
  })
  return io
}

export function getIO(): Server {
  if (!io) throw new Error('Socket.IO not initialized')
  return io
}

export function revokeUserSockets(userId: number) { io?.in(`user:${userId}`).disconnectSockets(true) }
export function revokeSessionSockets(sessionId: string) { io?.in(`session:${sessionId}`).disconnectSockets(true) }

async function emitAuthorized(event: keyof ShiftEvents, data: ShiftEventData | BreakEventData) {
  if (!io) return
  // Re-read permissions per notification so revoked assignments cannot keep a stale room.
  for (const socket of io.sockets.sockets.values()) {
    try {
      const request = socket.request as Request
      await new Promise<void>((resolve, reject) => request.session.reload(error => error ? reject(error) : resolve()))
      const sessionUser = (request.session as any).passport?.user
      if (!sessionUser || Number(sessionUser.id ?? sessionUser) !== request.user?.id) { socket.disconnect(true); continue }
      const [user] = await db.select().from(users).where(eq(users.id, request.user!.id)).limit(1)
      if (!user?.isActive) { socket.disconnect(true); continue }
      if (sessionUser.originalUserId) {
        const [original] = await db.select().from(users).where(eq(users.id, sessionUser.originalUserId)).limit(1)
        if (!original?.isActive || original.role !== 'admin') { socket.disconnect(true); continue }
      }
      if (user.role === 'admin') { socket.emit(event, data); continue }
      if (user.role === 'team_member' && await resolveEmployeeId(user) === data.employeeId) {
        socket.emit(event, { employeeId: data.employeeId, timestamp: data.timestamp }); continue
      }
      if (user.role !== 'client') continue
      const clientIds = await accessibleClientIds(user)
      if (!clientIds.length) continue
      const assigned = await db.select({ id: clientServiceTeamMembers.id }).from(clientServiceTeamMembers)
        .innerJoin(clientServices, eq(clientServices.id, clientServiceTeamMembers.clientServiceId))
        .where(and(eq(clientServiceTeamMembers.teamMemberId, data.employeeId), eq(clientServiceTeamMembers.isActive, true),
          effectiveProjectPredicate(), inArray(clientServices.clientId, clientIds),
          sql`${clientServiceTeamMembers.startDate} <= CURRENT_DATE`,
          sql`(${clientServiceTeamMembers.endDate} IS NULL OR ${clientServiceTeamMembers.endDate} >= CURRENT_DATE)`)).limit(1)
      if (assigned.length) socket.emit(event, { timestamp: data.timestamp })
    } catch { socket.disconnect(true) }
  }
}
export function emitShiftStarted(data: ShiftEventData) { return emitAuthorized('shift:started', data) }
export function emitShiftEnded(data: ShiftEventData) { return emitAuthorized('shift:ended', data) }
export function emitBreakStarted(data: BreakEventData) { return emitAuthorized('break:started', data) }
export function emitBreakEnded(data: BreakEventData) { return emitAuthorized('break:ended', data) }
