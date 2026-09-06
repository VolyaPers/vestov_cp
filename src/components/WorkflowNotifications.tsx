import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { BellIcon, Cross2Icon } from '@radix-ui/react-icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'wouter'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { useWorkflowPreview, useWorkflowUserId, workflowDate } from '@/lib/workflow'

interface Notification { id: number | string; title: string; body: string; href: string; createdAt: string; readAt: string | null }
interface NotificationsResponse { items: Notification[]; unreadCount: number }

export function WorkflowNotifications() {
  const [open, setOpen] = useState(false)
  const userId = useWorkflowUserId()
  const isPreview = useWorkflowPreview()
  const client = useQueryClient()
  const queryKey = ['workflowNotifications', userId, isPreview]
  const query = useQuery<NotificationsResponse>({ queryKey, queryFn: () => api.request('/workflow/notifications'), enabled: userId !== undefined, refetchInterval: 60_000 })
  const markRead = useMutation({
    mutationFn: (id: Notification['id'] | null) => api.request(id === null ? '/workflow/notifications/read-all' : `/workflow/notifications/${id}/read`, { method: id === null ? 'POST' : 'PATCH' }),
    onSuccess: () => client.invalidateQueries({ queryKey }),
  })
  if (userId === undefined) return null
  const count = query.data?.unreadCount ?? 0
  return <Dialog.Root open={open} onOpenChange={value => { setOpen(value); if (value) void query.refetch() }}>
    <Dialog.Trigger asChild><Button variant="ghost" size="icon" className="relative h-10 w-10" aria-label={count ? `Notifications, ${count} unread` : 'Notifications'}><BellIcon className="h-5 w-5" />{count > 0 && <span className="absolute right-0 top-0 flex min-w-4 items-center justify-center rounded-full bg-foreground px-1 text-[10px] leading-4 text-background" aria-hidden="true">{count > 99 ? '99+' : count}</span>}</Button></Dialog.Trigger>
    <Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-40 bg-black/20" />
      <Dialog.Content className="fixed right-4 top-20 z-50 flex max-h-[calc(100dvh-7rem)] w-[calc(100vw-2rem)] max-w-md flex-col rounded-lg border bg-background shadow-lg focus:outline-none">
        <div className="flex items-center justify-between border-b px-5 py-4"><Dialog.Title className="font-semibold">Notifications</Dialog.Title><Dialog.Close asChild><Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Close notifications"><Cross2Icon className="h-4 w-4" /></Button></Dialog.Close></div>
        <Dialog.Description className="sr-only">Updates about your requests and decisions.</Dialog.Description>
        <div className="flex items-center justify-between gap-3 border-b px-5 py-3"><p className="text-xs text-muted-foreground">{isPreview ? 'Read only in user preview' : query.error ? 'Updates unavailable' : `${count} unread`}</p><Button size="sm" variant="ghost" disabled={!count || markRead.isPending || isPreview} onClick={() => markRead.mutate(null)}>Mark all as read</Button></div>
        {markRead.error && <p role="alert" className="px-5 py-3 text-sm text-red-700">Could not mark notifications as read. Please try again.</p>}
        <div className="min-h-24 overflow-y-auto overscroll-contain">
          {query.isLoading ? <div className="space-y-3 p-5" role="status" aria-label="Loading notifications"><div className="h-14 animate-pulse rounded bg-muted" /><div className="h-14 animate-pulse rounded bg-muted" /></div>
            : query.error ? <div role="alert" className="space-y-3 p-5"><p className="text-sm">Notifications could not be loaded.</p><Button variant="outline" size="sm" onClick={() => void query.refetch()}>Try again</Button></div>
            : !query.data?.items.length ? <p className="p-5 text-sm text-muted-foreground">You’re up to date. Request updates will appear here.</p>
            : <ul className="divide-y">{query.data.items.map(item => <li key={item.id} className={item.readAt ? '' : 'bg-muted/40'}><Link href={item.href} className="block px-5 py-4 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring" onClick={() => { if (!item.readAt && !isPreview) markRead.mutate(item.id); setOpen(false) }}><div className="flex gap-2"><p className="min-w-0 flex-1 break-words text-sm font-medium">{item.title}</p>{!item.readAt && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-foreground"><span className="sr-only">Unread</span></span>}</div><p className="mt-1 break-words text-sm text-muted-foreground">{item.body}</p><p className="mt-2 text-xs text-muted-foreground">{workflowDate(item.createdAt)} · Kyiv</p></Link></li>)}</ul>}
        </div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
}
