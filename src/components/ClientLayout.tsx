import { useState, useEffect } from 'react'
import { useLocation, Route, Switch, Redirect } from 'wouter'
import { LogOut, Menu, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ClientDashboard } from '@/pages/client/ClientDashboard'
import { ClientPortal } from '@/pages/client/ClientPortal'
import { ClientTeamStatus } from '@/pages/client/ClientTeamStatus'
import { ClientDocuments } from '@/pages/client/ClientDocuments'
import { ClientInvoices } from '@/pages/client/ClientInvoices'
import { ClientProfile } from '@/pages/client/ClientProfile'
import { ClientFeedbackPage } from '@/pages/client/ClientFeedbackPage'
import { GlobalSearchLauncher } from '@/components/GlobalSearchLauncher'
import { Sidebar } from '@/components/Sidebar'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import vestovLogo from '@/assets/vestov-logo.png'
import type { User, Client } from '@/types/common'

interface ClientLayoutProps {
  user: User
}

export function ClientLayout({ user }: ClientLayoutProps) {
  const [location, setLocation] = useLocation()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [assignedClients, setAssignedClients] = useState<Client[]>([])
  const [currentClient, setCurrentClient] = useState<Client | null>(null)
  const [isLoading, setIsLoading] = useState(true)

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
    try {
      // Try to logout - don't check current user first since that might fail if session expired
      await api.logout()
    } catch (error) {
      // This is fine - session might already be expired
    }

    // Always navigate to login and force page reload to clear all state
    window.location.href = '/login'
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--stripe-background)' }}>
      {/* Mobile sidebar */}
      <div className={cn(
        'fixed inset-0 flex z-50 lg:hidden',
        isMobileMenuOpen ? 'block' : 'hidden'
      )}>
        <div className="fixed inset-0 bg-black/20" onClick={() => setIsMobileMenuOpen(false)} />
        <div className="relative flex-1 flex flex-col max-w-xs w-full stripe-card shadow-lg">
          <div className="absolute top-0 right-0 -mr-12 pt-4">
            <button
              type="button"
              className="stripe-btn-primary ml-1 h-10 w-10 rounded-lg focus:outline-none focus:ring-2 focus:ring-opacity-20"
              onClick={() => setIsMobileMenuOpen(false)}
              data-testid="mobile-menu-close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <Sidebar
            role="client"
            user={user}
            onLogout={handleLogout}
            currentClient={currentClient}
          />
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:flex lg:w-72 lg:flex-col lg:fixed lg:inset-y-0">
        <Sidebar
          role="client"
          user={user}
          onLogout={handleLogout}
          currentClient={currentClient}
        />
      </div>

      {/* Mobile header */}
      <div className="sticky top-0 z-40 lg:hidden">
        <div className="stripe-card stripe-border-bottom px-4 py-3">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMobileMenuOpen(true)}
              data-testid="mobile-menu-button"
            >
              <Menu className="h-6 w-6" />
            </Button>

            <div className="flex-1 ml-4">
              <h1 className="text-lg font-semibold stripe-text-primary">
                {currentClient?.name || 'Client Portal'}
              </h1>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <main className="lg:pl-72">
        <div className="px-4 py-6 sm:px-6 lg:px-8">
          <div className="mb-4 flex justify-end">
            <GlobalSearchLauncher className="w-full sm:w-[220px]" />
          </div>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : assignedClients.length === 0 ? (
            <div className="text-center py-12">
              <h2 className="text-2xl font-bold stripe-text-primary">No Access</h2>
              <p className="mt-2 stripe-text-secondary">You don't have access to any clients yet.</p>
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
  )
}
