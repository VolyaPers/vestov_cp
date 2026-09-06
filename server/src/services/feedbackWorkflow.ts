export type FeedbackStatus = 'pending' | 'in_progress' | 'awaiting_client' | 'resolved'
export type FeedbackAction = 'manager_reply' | 'request_confirmation' | 'client_reply' | 'confirm' | 'reopen'

export class FeedbackWorkflowError extends Error {
  constructor(message: string, public status = 409) { super(message) }
}

export function feedbackStatus(value: string | null): FeedbackStatus {
  // A historical admin response was never a client confirmation of resolution.
  if (value === 'reviewed') return 'awaiting_client'
  return value === 'in_progress' || value === 'awaiting_client' || value === 'resolved' ? value : 'pending'
}

export function nextFeedbackStatus(current: string | null, action: FeedbackAction, hasManagerResponse: boolean): FeedbackStatus {
  const status = feedbackStatus(current)
  if (action === 'reopen') {
    if (status !== 'resolved') throw new FeedbackWorkflowError('Only a resolved thread can be reopened')
    return 'in_progress'
  }
  if (status === 'resolved') throw new FeedbackWorkflowError('The client must reopen this thread before adding a reply')
  if (action === 'confirm') {
    if (status !== 'awaiting_client') throw new FeedbackWorkflowError('Resolution has not been proposed yet')
    return 'resolved'
  }
  if (action === 'request_confirmation') return 'awaiting_client'
  if (action === 'manager_reply') return 'in_progress'
  return hasManagerResponse ? 'in_progress' : 'pending'
}

export function feedbackMessageBody(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 10000) {
    throw new FeedbackWorkflowError('A message of 1–10000 characters is required', 400)
  }
  return value.trim()
}
