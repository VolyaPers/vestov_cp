import { createContext, useContext, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

const WorkflowUserContext = createContext<{ userId?: number; isPreview: boolean }>({ isPreview: false })

export function WorkflowUserProvider({ userId, isPreview = false, children }: { userId: number; isPreview?: boolean; children: ReactNode }) {
  return <WorkflowUserContext.Provider value={{ userId, isPreview }}>{children}</WorkflowUserContext.Provider>
}

export const useWorkflowUserId = () => useContext(WorkflowUserContext).userId
export const useWorkflowPreview = () => useContext(WorkflowUserContext).isPreview

export interface WorkflowAccess {
  isOwner: boolean
  isDeputy: boolean
  canViewQueue: boolean
  canApproveLeave: boolean
  canApprovePurchase: boolean
  canManageFeedback: boolean
  canRecordPayment: boolean
}

export function useWorkflowAccess() {
  const userId = useWorkflowUserId()
  const isPreview = useWorkflowPreview()
  return useQuery<WorkflowAccess>({
    queryKey: ['workflowAccess', userId, isPreview],
    queryFn: () => api.request('/workflow/access'),
    enabled: userId !== undefined,
    staleTime: 60_000,
  })
}

export function workflowDate(value: string | null | undefined) {
  if (!value) return 'No deadline'
  const date = new Date(value)
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Kyiv' }).format(date)
    : 'Date unavailable'
}
