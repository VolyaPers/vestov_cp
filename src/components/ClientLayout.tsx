import { useState, useEffect } from 'react'
import { useLocation, Route, Switch, Redirect } from 'wouter'
import { LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ClientDashboard } from '@/pages/client/ClientDashboard'
import { ClientPortal } from '@/pages/client/ClientPortal'
import { ClientTeamStatus } from '@/pages/client/ClientTeamStatus'
import { ClientDocuments } from '@/pages/client/ClientDocuments'
import { ClientInvoices } from '@/pages/client/ClientInvoices'
import { ClientProfile } from '@/pages/client/ClientProfile'
import { ClientFeedbackPage } from '@/pages/client/ClientFeedbackPage'
import { GlobalSearchLauncher } from '@/components/GlobalSearchLauncher'
import { MobileBottomNav } from '@/components/MobileBottomNav'
import { MobileSidebarSheet } from '@/components/MobileSidebarSheet'
import { Sidebar } from '@/components/Sidebar'
import { useAppSignOut } from '@/hooks/useAppSignOut'
import { api } from '@/lib/api'
import { getActiveNavigationLabel } from '@/lib/navigation'
import type { User, Client } from '@/types/common'

interface ClientLayoutProps {
  user: User
}

export function ClientLayout({ user }: ClientLayoutProps) {
  const [location, setLocation] = useLocation()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const signOut = useAppSignOut()
  const [assignedClients, setAssignedClients] = useState<Client[]>([])
  const [currentClient, setCurrentClient] = useState<Client | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const todayLabel = new Date().toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const mobileTitle = getActiveNavigationLabel('client', location, currentClient) ?? 'Workspace'

  useEffect(() => {
    let isMounted = true

    const loadAssignedClients = async () => {
      try {
        const clients = await api.getClients()
        if (!isMounted) return

        setAssignedClients(clients)

        // If user has assigned clients, set the first one as current
        if (clients && clients.length > 0) {
          setCurrentClient(clients[0])

          // Redirect to the client portal if on generic paths
          const currentPath = window.location.pathname
          if (currentPath === '/client' || currentPath === '/client/' || currentPath === '/client/portal') {
            setLocation(`/client/portal/${clients[0].id}`)
          }
        }
      } catch (error) {
        console.error('[ClientLayout] Failed to load assigned clients:', error)
        // Even if there's an error, stop loading to show the error state
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    loadAssignedClients()

    return () => {
      isMounted = false
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleLogout = async () => {
    await signOut()
  }

  return (
    <div className="app-shell min-h-screen">
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

      <div className="fixed inset-y-4 left-4 z-30 hidden w-[288px] lg:flex">
        <Sidebar
          role="client"
          user={user}
          onLogout={handleLogout}
          currentClient={currentClient}
        />
      </div>

      <div className="flex min-h-screen flex-col lg:pl-[320px]">
        <header className="sticky top-0 z-20">
          <div className="mobile-top-chrome lg:hidden">
            <div className="mobile-top-chrome-main">
              <div className="min-w-0 flex-1">
                <p className="text-[0.65rem] font-extrabold uppercase tracking-[0.24em] text-primary/80">
                  {currentClient?.name || 'Client Workspace'}
                </p>
                <h1 className="mt-1 truncate font-display text-[1.35rem] font-semibold text-foreground">
                  {mobileTitle}
                </h1>
              </div>
              <div className="mobile-top-chip">{todayLabel}</div>
            </div>

            <div className="px-4 pb-4">
              <GlobalSearchLauncher className="w-full" />
            </div>
          </div>

          <div className="hidden workspace-topbar lg:block">
            <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[0.7rem] font-extrabold uppercase tracking-[0.26em] text-primary/80">
                  Client Workspace
                </p>
                <h1 className="mt-1 font-display text-xl font-semibold text-foreground sm:text-2xl">
                  {currentClient?.name || 'Client portal'}
                </h1>
                <p className="mt-1 hidden text-sm text-muted-foreground sm:block">
                  Cleaner access to delivery visibility, documents and invoices across your assigned accounts.
                </p>
              </div>

              <div className="workspace-date-chip hidden rounded-full px-4 py-2 text-sm font-semibold text-muted-foreground md:block">
                {todayLabel}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="stripe-badge-success">
                <div className="h-2 w-2 rounded-full animate-pulse bg-[var(--stripe-success)]"></div>
                <span>{assignedClients.length || 0} active account{assignedClients.length === 1 ? '' : 's'}</span>
              </div>

              <div className="flex items-center gap-2">
                <GlobalSearchLauncher className="w-full max-w-[280px]" />
                <Button variant="outline" size="icon" onClick={handleLogout} className="shrink-0">
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
          </div>
        </header>

        <main className="flex-1">
          <div className="mobile-page-pad mx-auto w-full max-w-[1600px] px-3 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : assignedClients.length === 0 ? (
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
              <Switch>
                <Route path="/client/dashboard" component={ClientDashboard} />
                <Route path="/client/team-status" component={ClientTeamStatus} />
                <Route path="/client/documents/:id" component={ClientDocuments} />
                <Route path="/client/invoices/:id" component={ClientInvoices} />
                <Route path="/client/feedback" component={ClientFeedbackPage} />
                <Route path="/client/profile" component={ClientProfile} />
                <Route path="/client/portal/:id" component={ClientPortal} />
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
  )
}
