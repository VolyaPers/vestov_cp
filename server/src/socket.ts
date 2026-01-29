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

export function initializeSocket(httpServer: HttpServer, corsOrigin: string | string[] | false): Server {
  io = new Server(httpServer, {
    cors: {
      origin: corsOrigin || ['http://localhost:5173'],
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  })

  io.on('connection', (socket: Socket) => {
    console.log(`[SOCKET] Client connected: ${socket.id}`)

    // Join rooms based on user role (can be extended later)
    socket.on('join:admin', () => {
      socket.join('admin')
      console.log(`[SOCKET] ${socket.id} joined admin room`)
    })

    socket.on('join:client', (clientId: number) => {
      socket.join(`client:${clientId}`)
      console.log(`[SOCKET] ${socket.id} joined client:${clientId} room`)
    })

    socket.on('disconnect', (reason) => {
      console.log(`[SOCKET] Client disconnected: ${socket.id} - ${reason}`)
    })
  })

  console.log('[SOCKET] Socket.IO initialized')
  return io
}

export function getIO(): Server {
  if (!io) {
    throw new Error('Socket.IO not initialized. Call initializeSocket first.')
  }
  return io
}

// Helper functions to emit events
export function emitShiftStarted(data: ShiftEventData) {
  if (!io) return
  console.log(`[SOCKET] Emitting shift:started for employee ${data.employeeName}`)
  io.to('admin').emit('shift:started', data)
  // Also emit to specific client room if serviceId is known
  // Client room handling can be added later based on service->client mapping
}

export function emitShiftEnded(data: ShiftEventData) {
  if (!io) return
  console.log(`[SOCKET] Emitting shift:ended for employee ${data.employeeName}`)
  io.to('admin').emit('shift:ended', data)
}

export function emitBreakStarted(data: BreakEventData) {
  if (!io) return
  console.log(`[SOCKET] Emitting break:started for employee ${data.employeeName}`)
  io.to('admin').emit('break:started', data)
}

export function emitBreakEnded(data: BreakEventData) {
  if (!io) return
  console.log(`[SOCKET] Emitting break:ended for employee ${data.employeeName}`)
  io.to('admin').emit('break:ended', data)
}
