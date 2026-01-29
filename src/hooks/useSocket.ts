import { useEffect, useRef, useCallback, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import { useQueryClient } from '@tanstack/react-query'

// Global event emitter for shift updates
type ShiftUpdateListener = () => void
const shiftUpdateListeners: Set<ShiftUpdateListener> = new Set()

export function useShiftUpdateListener(callback: ShiftUpdateListener) {
  useEffect(() => {
    shiftUpdateListeners.add(callback)
    return () => {
      shiftUpdateListeners.delete(callback)
    }
  }, [callback])
}

function notifyShiftUpdate() {
  shiftUpdateListeners.forEach(listener => listener())
}

// Event types matching server
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

type ShiftEvent = 'shift:started' | 'shift:ended' | 'break:started' | 'break:ended'

const SOCKET_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3001'

export function useSocket() {
  const socketRef = useRef<Socket | null>(null)
  const queryClient = useQueryClient()

  useEffect(() => {
    // Create socket connection
    socketRef.current = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      withCredentials: true,
    })

    socketRef.current.on('connect_error', (error) => {
      console.error('[SOCKET] Connection error:', error.message)
    })

    // Clean up on unmount
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect()
        socketRef.current = null
      }
    }
  }, [])

  // Join admin room (call this on admin pages)
  const joinAdminRoom = useCallback(() => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('join:admin')
    }
  }, [])

  // Join client room (call this on client pages)
  const joinClientRoom = useCallback((clientId: number) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('join:client', clientId)
    }
  }, [])

  return {
    socket: socketRef.current,
    joinAdminRoom,
    joinClientRoom,
  }
}

// Hook specifically for admin/client pages to listen for shift events
export function useShiftEvents() {
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    // Create socket connection
    socketRef.current = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      withCredentials: true,
    })

    socketRef.current.on('connect', () => {
      socketRef.current?.emit('join:admin')
    })

    // Listen for shift events and notify listeners to refetch data
    const handleEvent = () => {
      notifyShiftUpdate()
    }

    socketRef.current.on('shift:started', handleEvent)
    socketRef.current.on('shift:ended', handleEvent)
    socketRef.current.on('break:started', handleEvent)
    socketRef.current.on('break:ended', handleEvent)

    // Clean up on unmount
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect()
        socketRef.current = null
      }
    }
  }, [])

  return { socket: socketRef.current }
}
