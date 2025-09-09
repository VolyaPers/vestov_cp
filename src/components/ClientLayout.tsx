import { useState } from 'react'
import { Router, Route, Switch, Link, useLocation } from 'wouter'
import { 
  BarChart3, 
  Users, 
  FileText, 
  MessageSquare, 
  Star,
  Settings,
  LogOut,
  Menu,
  X
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ClientDashboard } from '@/pages/client/ClientDashboard'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

const navigation = [
  { name: 'Dashboard', href: '/client/dashboard', icon: BarChart3 },
  { name: 'Team', href: '/client/team', icon: Users },
  { name: 'Services', href: '/client/services', icon: Settings },
  { name: 'Documents', href: '/client/documents', icon: FileText },
  { name: 'Messages', href: '/client/messages', icon: MessageSquare },
  { name: 'Feedback', href: '/client/feedback', icon: Star },
]

interface ClientLayoutProps {
  user?: any
}

export function ClientLayout({ user }: ClientLayoutProps = {}) {
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
              <Router base="/client">
                <Switch>
                  <Route path="/dashboard" component={ClientDashboard} />
                  <Route path="*">
                    <div className="text-center py-12">
                      <h2 className="text-2xl font-bold text-gray-900">Page Not Found</h2>
                      <p className="mt-2 text-gray-600">The page you're looking for doesn't exist.</p>
                      <Link href="/client/dashboard">
                        <Button className="mt-4">Go to Dashboard</Button>
                      </Link>
                    </div>
                  </Route>
                </Switch>
              </Router>
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
        <div className="mt-5 px-4">
          <p className="text-sm text-gray-600">Welcome back,</p>
          <p className="text-lg font-semibold text-gray-900">{user?.fullName}</p>
          {user?.client && (
            <p className="text-sm text-gray-500">{user.client.name}</p>
          )}
        </div>
        <nav className="mt-5 flex-1 px-2 space-y-1">
          {navigation.map((item) => {
            const isActive = location.startsWith(item.href.replace('/client', ''))
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
            <p className="text-xs text-gray-500">{user?.position}</p>
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