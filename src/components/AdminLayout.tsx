import { useState, useEffect } from 'react'
import { Route, Switch, Link, useLocation } from 'wouter'
import {
  Users,
  UserCog,
  BarChart3,
  FileText,
  Clock,
  Star,
  Calendar,
  LogOut,
  Menu,
  X,
  Building2,
  DollarSign,
  ChevronDown,
  ChevronRight
} from 'lucide-react'
import { AdminDashboard } from '@/pages/admin/AdminDashboard'
import { ClientsPage } from '@/pages/admin/ClientsPage'
import { ClientDetailsPage } from '@/pages/admin/ClientDetailsPage'
import { InvoicesPage } from '@/pages/admin/InvoicesPage'
import { UsersPage } from '@/pages/admin/UsersPage'
import { TeamOverview } from '@/pages/admin/TeamOverview'
import { TeamMemberDetails } from '@/pages/admin/TeamMemberDetails'
import { EmployeeDetailsPage } from '@/pages/admin/EmployeeDetailsPage'
import { VacationPage } from '@/pages/admin/VacationPage'
import { ServicesPage } from '@/pages/admin/ServicesPage'
import { AdminReimbursements } from '@/pages/admin/AdminReimbursements'
import { AdminShifts } from '@/pages/admin/AdminShifts'
import { AdminDocumentsPage } from '@/pages/admin/AdminDocumentsPage'
import { UserImpersonation } from '@/components/UserImpersonation'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import vestovLogo from '@/assets/vestov-logo.png'

const navigation = [
  { name: 'Dashboard', href: '/admin/dashboard', icon: BarChart3 },
  { name: 'Services', href: '/admin/services', icon: Building2 },
  { 
    name: 'CRM', 
    href: '/admin/clients', 
    icon: Users,
    children: [
      { name: 'Clients', href: '/admin/clients', icon: Users },
      { name: 'Invoices', href: '/admin/invoices', icon: DollarSign },
    ]
  },
  { name: 'Users', href: '/admin/users', icon: UserCog },
  { name: 'Team', href: '/admin/team', icon: Users },
  { name: 'Shifts', href: '/admin/shifts', icon: Clock },
  { name: 'Vacation', href: '/admin/vacation', icon: Calendar },
  { name: 'Reimbursements', href: '/admin/reimbursements', icon: FileText },
  { name: 'Documents', href: '/admin/documents', icon: FileText },
  // { name: 'Time Tracking', href: '/admin/time', icon: Clock },
  { name: 'Feedback', href: '/admin/feedback', icon: Star },
]

import type { User } from '@/types/common'

interface AdminLayoutProps {
  user?: User
}

export function AdminLayout({ user }: AdminLayoutProps = {}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [location] = useLocation()

  const handleLogout = async () => {
    try {
      await api.logout()
      window.location.href = '/'
    } catch (error) {
      console.error('Logout failed:', error)
      window.location.href = '/'
    }
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--stripe-background)' }}>
      {/* Mobile sidebar */}
      <div className={cn(
        'fixed inset-0 flex z-50 lg:hidden',
        sidebarOpen ? 'block' : 'hidden'
      )}>
        <div className="fixed inset-0 bg-black/20" onClick={() => setSidebarOpen(false)} />
        <div className="relative flex-1 flex flex-col max-w-xs w-full stripe-card shadow-lg">
          <div className="absolute top-0 right-0 -mr-12 pt-4">
            <button
              type="button"
              className="stripe-btn-primary ml-1 h-10 w-10 rounded-lg focus:outline-none focus:ring-2 focus:ring-opacity-20"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <Sidebar user={user} onLogout={handleLogout} />
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:flex lg:w-72 lg:flex-col lg:fixed lg:inset-y-0">
        <Sidebar user={user} onLogout={handleLogout} />
      </div>

      {/* Main content */}
      <div className="lg:pl-72 flex flex-col flex-1 min-h-screen">
        {/* Top bar */}
        <div className="sticky top-0 z-10 lg:hidden">
          <div className="stripe-card stripe-border-bottom px-4 py-3">
            <div className="flex items-center justify-between">
              <button
                type="button"
                className="stripe-btn-primary h-10 w-10 rounded-lg focus:outline-none focus:ring-2 focus:ring-opacity-20"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="flex items-center gap-3">
                <div className="stripe-badge-success">
                  <div className="w-2 h-2 rounded-full animate-pulse mr-2" style={{ backgroundColor: 'var(--stripe-success)' }}></div>
                  <span>Online</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <main className="flex-1">
          <div className="p-4 lg:p-6">
            <div className="max-w-[95%] mx-auto">
              <Switch>
                <Route path="/admin/dashboard" component={AdminDashboard} />
                <Route path="/admin/services" component={ServicesPage} />
                <Route path="/admin/clients/:id">
                  {() => <ClientDetailsPage />}
                </Route>
                <Route path="/admin/clients" component={ClientsPage} />
                <Route path="/admin/invoices" component={InvoicesPage} />
                <Route path="/admin/users" component={UsersPage} />
                <Route path="/admin/team-detail/:id">
                  {() => <TeamMemberDetails />}
                </Route>
                <Route path="/admin/team" component={TeamOverview} />
                <Route path="/admin/employees/:id" component={EmployeeDetailsPage} />
                <Route path="/admin/vacation" component={VacationPage} />
                <Route path="/admin/reimbursements" component={AdminReimbursements} />
                <Route path="/admin/shifts" component={AdminShifts} />
                <Route path="/admin/documents" component={AdminDocumentsPage} />
                <Route path="/admin" component={AdminDashboard} />
                <Route path="*">
                  {() => (
                      <div className="flex items-center justify-center min-h-[60vh]">
                        <div className="text-center stripe-card p-12">
                          <div className="w-16 h-16 mx-auto mb-6 rounded-lg flex items-center justify-center stripe-surface">
                            <FileText className="h-8 w-8 stripe-text-muted" />
                          </div>
                          <h2 className="text-2xl font-bold stripe-text-primary mb-3">Page Not Found</h2>
                          <p className="stripe-text-secondary mb-6 max-w-sm">The page you're looking for doesn't exist or has been moved.</p>
                          <Link href="/admin/dashboard">
                            <button className="stripe-btn-primary">
                              Go to Dashboard
                            </button>
                          </Link>
                        </div>
                      </div>
                    )}
                </Route>
              </Switch>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

function Sidebar({ user, onLogout }: { user?: User; onLogout: () => void }) {
  const [location] = useLocation()
  
  // Check if CRM submenu should be open
  const isCrmActive = location.startsWith('/admin/clients') || location.startsWith('/admin/invoices')
  const [crmOpen, setCrmOpen] = useState(isCrmActive)

  // Auto-open CRM dropdown when on CRM pages
  useEffect(() => {
    if (isCrmActive) {
      setCrmOpen(true)
    }
  }, [isCrmActive])

  return (
    <div className="flex-1 flex flex-col min-h-0 stripe-card stripe-border shadow-sm">
      <div className="flex-1 flex flex-col pt-8 pb-6 overflow-y-auto">
        <div className="flex items-center flex-shrink-0 px-6 mb-8">
          <div className="flex items-center gap-3">
            {/* Vestov Logo */}
            <img src={vestovLogo} alt="Vestov Logo" className="h-10 w-auto drop-shadow-lg" />
            <div>
              <h1 className="text-xl font-bold stripe-text-primary">
                Vestov Portal
              </h1>
              <p className="text-xs stripe-text-muted font-medium">Admin Dashboard</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          {navigation.map((item) => {
            const isActive = !item.children && location.startsWith(item.href.replace('/admin', ''))
            const hasChildren = !!item.children
            
            if (hasChildren) {
              const isParentActive = isCrmActive
              return (
                <div key={item.name}>
                  <button
                    onClick={() => setCrmOpen(!crmOpen)}
                    className={cn(
                      'stripe-nav-item w-full',
                      isParentActive && 'stripe-nav-item-active'
                    )}
                  >
                    <div className={cn(
                      'flex items-center justify-center w-8 h-8 rounded-md mr-3 transition-all duration-150',
                      isParentActive
                        ? 'text-[var(--stripe-primary)]'
                        : 'text-[var(--stripe-text-tertiary)]'
                    )}>
                      <item.icon className="h-5 w-5" />
                    </div>
                    <span className="flex-1 font-medium text-left">{item.name}</span>
                    {crmOpen || isParentActive ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </button>
                  {(crmOpen || isParentActive) && item.children && (
                    <div className="ml-4 mt-1 space-y-1">
                      {item.children.map((child) => {
                        const isChildActive = location.startsWith(child.href.replace('/admin', ''))
                        return (
                          <Link key={child.name} href={child.href}>
                            <div className={cn(
                              'stripe-nav-item pl-8',
                              isChildActive && 'stripe-nav-item-active'
                            )}>
                              <div className={cn(
                                'flex items-center justify-center w-6 h-6 rounded-md mr-3 transition-all duration-150',
                                isChildActive
                                  ? 'text-[var(--stripe-primary)]'
                                  : 'text-[var(--stripe-text-tertiary)]'
                              )}>
                                <child.icon className="h-4 w-4" />
                              </div>
                              <span className="flex-1 font-medium text-sm">{child.name}</span>
                              {isChildActive && (
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--stripe-primary)' }}></div>
                              )}
                            </div>
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            }

            return (
              <Link key={item.name} href={item.href}>
                <div className={cn(
                  'stripe-nav-item',
                  isActive && 'stripe-nav-item-active'
                )}>
                  <div className={cn(
                    'flex items-center justify-center w-8 h-8 rounded-md mr-3 transition-all duration-150',
                    isActive
                      ? 'text-[var(--stripe-primary)]'
                      : 'text-[var(--stripe-text-tertiary)]'
                  )}>
                    <item.icon className="h-5 w-5" />
                  </div>
                  <span className="flex-1 font-medium">{item.name}</span>
                  {isActive && (
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--stripe-primary)' }}></div>
                  )}
                </div>
              </Link>
            )
          })}
        </nav>
      </div>

      <div className="flex-shrink-0 stripe-border p-4" style={{ borderTopColor: 'var(--stripe-border)' }}>
        <UserImpersonation
          currentUser={user}
          onImpersonate={async () => {
            // API handles impersonation and reloads page
          }}
          onStopImpersonation={async () => {
            // API handles stop impersonation and reloads page
          }}
        />

        <div className="flex items-center stripe-surface rounded-lg p-4 stripe-border">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg shadow-sm mr-3" style={{ backgroundColor: 'var(--stripe-primary)', color: 'white' }}>
            <span className="text-sm font-bold">
              {user?.fullName?.split(' ').map((n: string) => n[0]).join('') || 'AD'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold stripe-text-primary truncate">{user?.fullName || 'Admin User'}</p>
            <p className="text-xs stripe-text-muted font-medium">{user?.role || 'Administrator'}</p>
          </div>
          <button
            onClick={onLogout}
            className="ml-2 h-9 w-9 p-0 rounded-lg transition-all duration-150 flex items-center justify-center stripe-btn-secondary hover:bg-red-50 hover:text-red-600 hover:border-red-200"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}