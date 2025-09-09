import { useState, useEffect } from 'react'
import { Route, Switch, Link, useLocation } from 'wouter'
import { 
  Users, 
  Settings, 
  BarChart3, 
  FileText, 
  Clock, 
  MessageSquare, 
  Star,
  Calendar,
  LogOut,
  Menu,
  X,
  Building2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AdminDashboard } from '@/pages/admin/AdminDashboard'
import { ClientsPage } from '@/pages/admin/ClientsPage'
import { ClientDetailsPage } from '@/pages/admin/ClientDetailsPage'
import { TeamPage } from '@/pages/admin/TeamPage'
import { EmployeeDetailsPage } from '@/pages/admin/EmployeeDetailsPage'
import { VacationPage } from '@/pages/admin/VacationPage'
import { ServicesPage } from '@/pages/admin/ServicesPage'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

const navigation = [
  { name: 'Dashboard', href: '/admin/dashboard', icon: BarChart3 },
  { name: 'Services', href: '/admin/services', icon: Building2 },
  { name: 'Clients', href: '/admin/clients', icon: Users },
  { name: 'Team', href: '/admin/team', icon: Users },
  { name: 'Vacation', href: '/admin/vacation', icon: Calendar },
  { name: 'Documents', href: '/admin/documents', icon: FileText },
  { name: 'Time Tracking', href: '/admin/time', icon: Clock },
  { name: 'Feedback', href: '/admin/feedback', icon: Star },
]

interface AdminLayoutProps {
  user?: any
}

export function AdminLayout({ user }: AdminLayoutProps = {}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [location] = useLocation()
  
  console.log('AdminLayout - current location:', location)

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
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar */}
      <div className={cn(
        'fixed inset-0 flex z-40 lg:hidden',
        sidebarOpen ? 'block' : 'hidden'
      )}>
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setSidebarOpen(false)} />
        <div className="relative flex-1 flex flex-col max-w-xs w-full bg-white">
          <div className="absolute top-0 right-0 -mr-12 pt-2">
            <button
              type="button"
              className="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-6 w-6 text-white" />
            </button>
          </div>
          <Sidebar user={user} onLogout={handleLogout} />
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0">
        <Sidebar user={user} onLogout={handleLogout} />
      </div>

      {/* Main content */}
      <div className="lg:pl-64 flex flex-col flex-1">
        {/* Top bar */}
        <div className="sticky top-0 z-10 lg:hidden pl-1 pt-1 sm:pl-3 sm:pt-3 bg-gray-50">
          <button
            type="button"
            className="-ml-0.5 -mt-0.5 h-12 w-12 inline-flex items-center justify-center rounded-md text-gray-500 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-6 w-6" />
          </button>
        </div>

        <main className="flex-1">
          <div className="py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <Switch>
                <Route path="/admin/dashboard" component={AdminDashboard} />
                <Route path="/admin/services" component={ServicesPage} />
                <Route path="/admin/clients/:id">
                  {(params) => {
                    console.log('ClientDetailsPage route matched with params:', params)
                    return <ClientDetailsPage />
                  }}
                </Route>
                <Route path="/admin/clients" component={ClientsPage} />
                <Route path="/admin/team" component={TeamPage} />
                <Route path="/admin/employees/:id" component={EmployeeDetailsPage} />
                <Route path="/admin/vacation" component={VacationPage} />
                <Route path="/admin" component={AdminDashboard} />
                <Route path="*">
                  {() => {
                    console.log('No route matched, current location:', location)
                    return (
                      <div className="text-center py-12">
                        <h2 className="text-2xl font-bold text-gray-900">Page Not Found</h2>
                        <p className="mt-2 text-gray-600">The page you're looking for doesn't exist.</p>
                        <Link href="/admin/dashboard">
                          <Button className="mt-4">Go to Dashboard</Button>
                        </Link>
                      </div>
                    )
                  }}
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
    <div className="flex-1 flex flex-col min-h-0 bg-white border-r border-gray-200">
      <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
        <div className="flex items-center flex-shrink-0 px-4">
          <h1 className="text-xl font-bold text-gray-900">Vestov Portal</h1>
        </div>
        <nav className="mt-5 flex-1 px-2 space-y-1">
          {navigation.map((item) => {
            const isActive = location.startsWith(item.href.replace('/admin', ''))
            return (
              <Link key={item.name} href={item.href}>
                <div className={cn(
                  isActive
                    ? 'bg-gray-100 text-gray-900'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
                  'group flex items-center px-2 py-2 text-sm font-medium rounded-md cursor-pointer'
                )}>
                  <item.icon
                    className={cn(
                      isActive ? 'text-gray-500' : 'text-gray-400 group-hover:text-gray-500',
                      'mr-3 flex-shrink-0 h-6 w-6'
                    )}
                  />
                  {item.name}
                </div>
              </Link>
            )
          })}
        </nav>
      </div>
      <div className="flex-shrink-0 flex border-t border-gray-200 p-4">
        <div className="flex items-center w-full">
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-900">{user?.fullName}</p>
            <p className="text-xs text-gray-500">{user?.role}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onLogout}
            className="ml-3"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}