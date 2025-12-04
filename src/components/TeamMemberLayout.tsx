import { useState } from 'react'
import { Route, Switch, Link, useLocation } from 'wouter'
import {
  User,
  Calendar,
  LogOut,
  Menu,
  X,
  FileText,
  Clock,
  TrendingUp,
  LayoutDashboard,
  ExternalLink,
  BookOpen
} from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { EmployeeDashboard } from '@/pages/employee/EmployeeDashboard'
import { EmployeeProfile } from '@/pages/employee/EmployeeProfile'
import { EmployeeVacations } from '@/pages/employee/EmployeeVacations'
import { EmployeeReimbursements } from '@/pages/employee/EmployeeReimbursements'
import { EmployeeRoadmap } from '@/pages/employee/EmployeeRoadmap'
import { UserImpersonation } from '@/components/UserImpersonation'
import { ShiftWidget } from '@/components/ShiftWidget'
import vestovLogo from '@/assets/vestov-logo.png'

interface NavigationItem {
  name: string
  href: string
  icon: any
  external?: boolean
}

const navigation: NavigationItem[] = [
  { name: 'Dashboard', href: '/employee/dashboard', icon: LayoutDashboard },
  { name: 'Roadmap', href: '/employee/roadmap', icon: TrendingUp },
  { name: 'Vacations', href: '/employee/vacations', icon: Calendar },
  { name: 'Reimbursements', href: '/employee/reimbursements', icon: FileText },
  { name: 'Profile', href: '/employee/profile', icon: User },
  { name: 'Knowledge Base', href: 'https://www.notion.so/Vestov-Knowledge-Base-2611a26473ed80c08f2dd2178bccc864', icon: BookOpen, external: true },

]

interface TeamMemberLayoutProps {
  user?: any
}

export function TeamMemberLayout({ user }: TeamMemberLayoutProps = {}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [location] = useLocation()

  // Debug: Log user object to console
  console.log('TeamMemberLayout user:', user)

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
          <div className="p-6 lg:p-8">
            <div className="max-w-7xl mx-auto">
              <Switch>
                <Route path="/employee/dashboard" component={EmployeeDashboard} />
                <Route path="/employee/profile" component={EmployeeProfile} />
                <Route path="/employee/roadmap" component={EmployeeRoadmap} />
                <Route path="/employee/vacations" component={EmployeeVacations} />
                <Route path="/employee/reimbursements" component={EmployeeReimbursements} />
                <Route path="/employee" component={EmployeeDashboard} />
                <Route path="*">
                  {() => (
                    <div className="flex items-center justify-center min-h-[60vh]">
                      <div className="text-center stripe-card p-12">
                        <div className="w-16 h-16 mx-auto mb-6 rounded-lg flex items-center justify-center stripe-surface">
                          <FileText className="h-8 w-8 stripe-text-muted" />
                        </div>
                        <h2 className="text-2xl font-bold stripe-text-primary mb-3">Page Not Found</h2>
                        <p className="stripe-text-secondary mb-6 max-w-sm">The page you're looking for doesn't exist or has been moved.</p>
                        <Link href="/employee/dashboard">
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

function Sidebar({ user, onLogout }: { user: any; onLogout: () => void }) {
  const [location] = useLocation()

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
              <p className="text-xs stripe-text-muted font-medium">Employee Portal</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          {navigation.map((item) => {
            const isActive = !item.external && (location === item.href || location.startsWith(item.href + '/'))
            const Icon = item.icon

            // For external links, use a regular anchor tag
            if (item.external) {
              return (
                <a
                  key={item.name}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center justify-between px-3 py-3 text-sm font-medium rounded-lg transition-all duration-200 cursor-pointer stripe-nav-inactive hover:bg-blue-50"
                >
                  <div className="flex items-center">
                    <Icon
                      className="mr-3 flex-shrink-0 h-5 w-5 transition-colors stripe-icon-inactive"
                      aria-hidden="true"
                    />
                    <span>{item.name}</span>
                  </div>
                  <ExternalLink className="h-4 w-4 stripe-icon-inactive opacity-70" />
                </a>
              )
            }

            // For internal links, use wouter Link
            return (
              <Link key={item.name} href={item.href}>
                <div
                  className={cn(
                    'group flex items-center px-3 py-3 text-sm font-medium rounded-lg transition-all duration-200 cursor-pointer',
                    isActive
                      ? 'stripe-nav-active'
                      : 'stripe-nav-inactive'
                  )}
                >
                  <Icon
                    className={cn(
                      'mr-3 flex-shrink-0 h-5 w-5 transition-colors',
                      isActive
                        ? 'stripe-icon-active'
                        : 'stripe-icon-inactive'
                    )}
                    aria-hidden="true"
                  />
                  {item.name}
                </div>
              </Link>
            )
          })}
        </nav>

        <div className="flex-shrink-0 px-4 pb-4 space-y-4">
          {/* User Switcher - Show if impersonating */}
          {user?.isImpersonating && (
            <div className="stripe-border-bottom pb-4" style={{ borderBottomColor: 'var(--stripe-border)' }}>
              <UserImpersonation
                currentUser={user}
                onImpersonate={async () => {
                  // API handles impersonation and reloads page
                }}
                onStopImpersonation={async () => {
                  // API handles stop impersonation and reloads page
                }}
              />
            </div>
          )}

          {/* User info */}
          {user && (
            <div className="stripe-card-hover rounded-lg p-4">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={user.avatarUrl} alt={user.fullName || user.username} />
                    <AvatarFallback className="bg-blue-100 text-blue-600 text-sm font-semibold">
                      {(user.fullName || user.username)
                        .split(' ')
                        .map((n: string) => n[0])
                        .join('')
                        .toUpperCase()
                        .slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                </div>
                <div className="ml-3 flex-1 min-w-0">
                  <p className="text-sm font-medium stripe-text-primary truncate">
                    {user.fullName || user.username}
                  </p>
                  <p className="text-xs stripe-text-muted truncate">
                    {user.position || 'Team Member'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Shift Widget */}
          <ShiftWidget />

          {/* Logout button */}
          <button
            onClick={onLogout}
            className="w-full group flex items-center px-3 py-3 text-sm font-medium rounded-lg stripe-nav-inactive"
          >
            <LogOut
              className="mr-3 flex-shrink-0 h-5 w-5 stripe-icon-inactive"
              aria-hidden="true"
            />
            Sign Out
          </button>
        </div>
      </div>
    </div>
  )
}
