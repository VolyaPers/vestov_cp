import { useState, useEffect } from 'react'
import { useLocation, Route, Switch } from 'wouter'
import { Building, FileText, DollarSign, User as UserIcon, LogOut, Menu, X, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ClientPortal } from '@/pages/client/ClientPortal'
import { ClientTeamStatus } from '@/pages/client/ClientTeamStatus'
import { ClientDocuments } from '@/pages/client/ClientDocuments'
import { ClientInvoices } from '@/pages/client/ClientInvoices'
import { ClientProfile } from '@/pages/client/ClientProfile'
import { UserImpersonation } from '@/components/UserImpersonation'
import { api } from '@/lib/api'
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

          // Redirect to the client portal if on paths without client ID
          if (location === '/client' || location === '/client/' || location === '/client/portal') {
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
  }, [location, setLocation])

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

  const navigation = currentClient ? [
    {
      name: 'Overview',
      href: `/client/portal/${currentClient.id}`,
      icon: Building,
      current: location === `/client/portal/${currentClient.id}` || location.startsWith('/client/portal/')
    },
    {
      name: 'Team Status',
      href: '/client/team-status',
      icon: Users,
      current: location === '/client/team-status'
    },
    {
      name: 'Documents',
      href: `/client/documents/${currentClient.id}`,
      icon: FileText,
      current: location === `/client/documents/${currentClient.id}`
    },
    {
      name: 'Invoices',
      href: `/client/invoices/${currentClient.id}`,
      icon: DollarSign,
      current: location === `/client/invoices/${currentClient.id}`
    },
    {
      name: 'Profile',
      href: '/client/profile',
      icon: UserIcon,
      current: location === '/client/profile'
    }
  ] : []

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile menu */}
      <div className={`fixed inset-0 z-50 lg:hidden ${isMobileMenuOpen ? 'block' : 'hidden'}`}>
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setIsMobileMenuOpen(false)} />
        <div className="fixed inset-y-0 left-0 flex w-full max-w-xs flex-col bg-white shadow-xl">
          <div className="flex h-16 items-center justify-between px-4">
            <div className="flex items-center gap-2">
              <img src={vestovLogo} alt="Vestov Logo" className="h-8 w-auto" />
              <span className="text-xl font-bold text-gray-900">Client Portal</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMobileMenuOpen(false)}
              data-testid="mobile-menu-close"
            >
              <X className="h-6 w-6" />
            </Button>
          </div>

          <nav className="flex-1 space-y-1 px-4 py-4">
            {navigation.map((item) => {
              const Icon = item.icon
              return (
                <a
                  key={item.name}
                  href={item.href}
                  className={`group flex items-center rounded-md px-2 py-2 text-sm font-medium ${
                    item.current
                      ? 'bg-primary text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                  onClick={(e) => {
                    e.preventDefault()
                    setLocation(item.href)
                    setIsMobileMenuOpen(false)
                  }}
                >
                  <Icon className="mr-3 h-5 w-5" />
                  {item.name}
                </a>
              )
            })}
          </nav>

          {/* Mobile user section */}
          <div className="border-t border-gray-200 p-4">
            <div className="mb-4">
              <p className="text-sm font-medium text-gray-900">{user?.fullName || 'Client User'}</p>
              <p className="text-sm text-gray-500">{currentClient?.name || 'Client Portal'}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="w-full"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </Button>
          </div>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-72 lg:flex-col">
        <div className="flex grow flex-col gap-y-5 overflow-y-auto border-r border-gray-200 bg-white px-6">
          <div className="flex h-16 shrink-0 items-center gap-2">
            <img src={vestovLogo} alt="Vestov Logo" className="h-8 w-auto" />
            <span className="text-xl font-bold text-gray-900">Client Portal</span>
          </div>

          <nav className="flex flex-1 flex-col">
            <ul role="list" className="flex flex-1 flex-col gap-y-7">
              <li>
                <ul role="list" className="-mx-2 space-y-1">
                  {navigation.map((item) => {
                    const Icon = item.icon
                    return (
                      <li key={item.name}>
                        <a
                          href={item.href}
                          className={`group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold ${
                            item.current
                              ? 'bg-primary text-white'
                              : 'text-gray-700 hover:text-primary hover:bg-gray-50'
                          }`}
                          onClick={(e) => {
                            e.preventDefault()
                            setLocation(item.href)
                          }}
                        >
                          <Icon className="h-6 w-6 shrink-0" />
                          {item.name}
                        </a>
                      </li>
                    )
                  })}
                </ul>
              </li>

              {/* Client info section */}
              <li className="mt-auto">
                <div className="rounded-lg bg-gray-50 p-4">
                  <h3 className="text-sm font-medium text-gray-900 mb-2">Current Client</h3>
                  <p className="text-sm text-gray-600 font-medium">{currentClient?.name || 'Loading...'}</p>
                  <p className="text-xs text-gray-500 mt-1">You have read-only access</p>
                </div>
              </li>

              {/* User Switcher - Show if impersonating */}
              {user?.isImpersonating && (
                <li className="-mx-6 mt-auto border-t border-gray-200 p-4">
                  <UserImpersonation
                    currentUser={user}
                    onImpersonate={async () => {
                      // API handles impersonation and reloads page
                    }}
                    onStopImpersonation={async () => {
                      // API handles stop impersonation and reloads page
                    }}
                  />
                </li>
              )}

              {/* User section */}
              <li className="-mx-6 mt-auto">
                <div className="flex items-center gap-x-4 px-6 py-3 text-sm font-semibold leading-6 text-gray-900 border-t border-gray-200">
                  <div className="h-8 w-8 bg-primary/10 rounded-full flex items-center justify-center">
                    <UserIcon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{user?.fullName || 'Client User'}</p>
                    <p className="text-xs text-gray-500">Client Role</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleLogout}
                    title="Sign out"
                  >
                    <LogOut className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            </ul>
          </nav>
        </div>
      </div>

      {/* Mobile header */}
      <div className="sticky top-0 z-40 lg:hidden">
        <div className="flex h-16 items-center gap-x-4 border-b border-gray-200 bg-white px-4 shadow-sm sm:gap-x-6 sm:px-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsMobileMenuOpen(true)}
            data-testid="mobile-menu-button"
          >
            <Menu className="h-6 w-6" />
          </Button>

          <div className="flex-1">
            <h1 className="text-lg font-semibold text-gray-900">
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

      {/* Main content */}
      <main className="lg:pl-72">
        <div className="px-4 py-6 sm:px-6 lg:px-8">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : assignedClients.length === 0 ? (
            <div className="text-center py-12">
              <h2 className="text-2xl font-bold text-gray-900">No Access</h2>
              <p className="mt-2 text-gray-600">You don't have access to any clients yet.</p>
            </div>
          ) : (
            <Switch>
              <Route path="/client/team-status" component={ClientTeamStatus} />
              <Route path="/client/documents/:id" component={ClientDocuments} />
              <Route path="/client/invoices/:id" component={ClientInvoices} />
              <Route path="/client/profile" component={ClientProfile} />
              <Route path="/client/portal/:id" component={ClientPortal} />
              <Route path="/client/*">
                {currentClient && location.startsWith('/client/portal/') ? (
                  <ClientPortal />
                ) : currentClient ? (
                  (() => {
                    setLocation(`/client/portal/${currentClient.id}`)
                    return (
                      <div className="text-center py-12">
                        <h2 className="text-2xl font-bold text-gray-900">Redirecting...</h2>
                      </div>
                    )
                  })()
                ) : (
                  <div className="text-center py-12">
                    <h2 className="text-2xl font-bold text-gray-900">Loading...</h2>
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