import { useQuery } from '@tanstack/react-query'
import { Suspense, lazy, useEffect, useState } from 'react'
import type { ComponentType, LazyExoticComponent } from 'react'
import { useLocation, Route, Switch, Redirect } from 'wouter'
import { LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { WorkspaceHeader } from '@/components/WorkspaceHeader'
import { MobileBottomNav } from '@/components/MobileBottomNav'
const MobileSidebarSheet = lazy(() => import('@/components/MobileSidebarSheet').then(module => ({ default: module.MobileSidebarSheet })))
import { WorkspaceRouteSkeleton, WorkspaceShellSkeleton } from '@/components/page-primitives'
import { Sidebar } from '@/components/Sidebar'
import { useAppSignOut } from '@/hooks/useAppSignOut'
import { api } from '@/lib/api'
import { getActiveNavigationLabel } from '@/lib/navigation'
import { ClientWorkspaceContext, ClientLoadError } from '@/lib/clientWorkspace'
import type { User, Client } from '@/types/common'

interface ClientLayoutProps {
  user: User
}

const ClientDashboard = lazy(async () => {
  const module = await import('@/pages/client/ClientDashboard')
  return { default: module.ClientDashboard }
})

const ClientPortal = lazy(async () => {
  const module = await import('@/pages/client/ClientPortal')
  return { default: module.ClientPortal }
})

const ClientTeamStatus = lazy(async () => {
  const module = await import('@/pages/client/ClientTeamStatus')
  return { default: module.ClientTeamStatus }
})

const ClientDocuments = lazy(async () => {
  const module = await import('@/pages/client/ClientDocuments')
  return { default: module.ClientDocuments }
})

const ClientInvoices = lazy(async () => {
  const module = await import('@/pages/client/ClientInvoices')
  return { default: module.ClientInvoices }
})

const ClientProfile = lazy(async () => {
  const module = await import('@/pages/client/ClientProfile')
  return { default: module.ClientProfile }
})

const ClientFeedbackPage = lazy(async () => {
  const module = await import('@/pages/client/ClientFeedbackPage')
  return { default: module.ClientFeedbackPage }
})

function createLazyRoute(PageComponent: LazyExoticComponent<ComponentType<any>>) {
  return function LazyRoute() {
    return (
      <Suspense fallback={<WorkspaceRouteSkeleton />}>
        <PageComponent />
      </Suspense>
    )
  }
}

const ClientDashboardRoute = createLazyRoute(ClientDashboard)
const ClientTeamStatusRoute = createLazyRoute(ClientTeamStatus)
const ClientDocumentsRoute = createLazyRoute(ClientDocuments)
const ClientInvoicesRoute = createLazyRoute(ClientInvoices)
const ClientFeedbackPageRoute = createLazyRoute(ClientFeedbackPage)
const ClientProfileRoute = createLazyRoute(ClientProfile)
const ClientPortalRoute = createLazyRoute(ClientPortal)

export function ClientLayout({ user }: ClientLayoutProps) {
  const [location, setLocation] = useLocation()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const signOut = useAppSignOut()
  const { data: assignedClients = [], isLoading, error: loadError, refetch } = useQuery<Client[]>({
    queryKey: ['clientWorkspaces', user.id],
    queryFn: () => api.getClients(),
  })
  const [currentClient, setCurrentClient] = useState<Client | null>(null)
  const mobileTitle = getActiveNavigationLabel('client', location, currentClient) ?? 'Workspace'

  useEffect(() => {
    if (!assignedClients.length) return
    const routeId = Number(window.location.pathname.match(/^\/client\/(?:portal|documents|invoices)\/(\d+)/)?.[1])
    let savedId = 0
    try { savedId = Number(localStorage.getItem(`client-workspace:${user.id}`)) } catch {}
    const selected = assignedClients.find(client => client.id === routeId)
      || assignedClients.find(client => client.id === savedId) || assignedClients[0]
    setCurrentClient(selected)
    if (['/client', '/client/', '/client/portal'].includes(window.location.pathname)) setLocation(`/client/portal/${selected.id}`)
  }, [assignedClients, user.id, setLocation])

  useEffect(() => {
    const id = Number(location.match(/^\/client\/(?:portal|documents|invoices)\/(\d+)/)?.[1])
    const selected = assignedClients.find(client => client.id === id)
    if (selected) setCurrentClient(selected)
  }, [location, assignedClients])

  const selectClient = (id: number) => {
    const selected = assignedClients.find(client => client.id === id)
    if (!selected) return
    setCurrentClient(selected)
    try { localStorage.setItem(`client-workspace:${user.id}`, String(id)) } catch {}
    if (/^\/client\/(?:portal|documents|invoices)\//.test(location)) setLocation(location.replace(/\d+$/, String(id)))
  }

  const handleLogout = async () => {
    await signOut()
  }

  return (
    <ClientWorkspaceContext.Provider value={{ client: currentClient }}>
    <div className="app-shell min-h-[100dvh]">
      {isMobileMenuOpen && <Suspense fallback={null}>
      <MobileSidebarSheet
        open={isMobileMenuOpen}
        onOpenChange={setIsMobileMenuOpen}
        title={currentClient?.name || 'Client workspace'}
        subtitle="Documents, billing and delivery views are always one tap away."
      >
        <Sidebar
          role="client"
          user={user}
          onLogout={handleLogout}
          currentClient={currentClient}
        />
      </MobileSidebarSheet>
      </Suspense>}

      <div className="workspace-sidebar fixed inset-y-0 left-0 z-30 hidden w-[232px] lg:flex">
        <Sidebar
          role="client"
          user={user}
          onLogout={handleLogout}
          currentClient={currentClient}
        />
      </div>

      <div className="flex min-h-[100dvh] flex-col lg:pl-[232px]">
        <WorkspaceHeader workspace={currentClient?.name || 'Client workspace'} title={mobileTitle} onOpenMenu={() => setIsMobileMenuOpen(true)} />

        <main id="workspace-content" className="min-w-0 flex-1">
          <div className="mobile-page-pad mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            {!isLoading && !loadError && assignedClients.length > 1 && (
              <label className="mb-5 flex flex-wrap items-center gap-3 text-sm font-medium">
                Client workspace
                <select aria-label="Client workspace" value={currentClient?.id || ''} onChange={event => selectClient(Number(event.target.value))} className="max-w-full rounded-xl border bg-white px-3 py-2">
                  {assignedClients.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}
                </select>
              </label>
            )}
            {isLoading ? (
              <WorkspaceRouteSkeleton />
            ) : loadError ? (<ClientLoadError message="Unable to load your client workspaces." onRetry={() => refetch()} />) : assignedClients.length === 0 ? (
              <div className="flex min-h-[60vh] items-center justify-center">
                <Card className="max-w-lg text-center">
                  <CardContent className="p-10 sm:p-12">
                    <h2 className="font-display text-3xl font-semibold text-foreground">No client access yet</h2>
                    <p className="mt-3 text-sm text-muted-foreground">
                      Your account is active, but there are no assigned client workspaces available to open.
                    </p>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Switch key={currentClient?.id}>
                <Route path="/client/dashboard" component={ClientDashboardRoute} />
                <Route path="/client/team-status" component={ClientTeamStatusRoute} />
                <Route path="/client/documents/:id" component={ClientDocumentsRoute} />
                <Route path="/client/invoices/:id" component={ClientInvoicesRoute} />
                <Route path="/client/feedback" component={ClientFeedbackPageRoute} />
                <Route path="/client/profile" component={ClientProfileRoute} />
                <Route path="/client/portal/:id" component={ClientPortalRoute} />
                <Route path="/client/*">
                  {currentClient ? (
                    <Redirect to={`/client/portal/${currentClient.id}`} />
                  ) : (
                    <div className="text-center py-12">
                      <h2 className="text-2xl font-bold stripe-text-primary">Loading...</h2>
                    </div>
                  )}
                </Route>
              </Switch>
            )}
          </div>
        </main>
      </div>

      <MobileBottomNav
        role="client"
        currentClient={currentClient}
        onOpenMenu={() => setIsMobileMenuOpen(true)}
      />
    </div>
    </ClientWorkspaceContext.Provider>
  )
}
