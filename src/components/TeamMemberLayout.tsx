import { useState } from 'react'
import { Route, Switch, Link } from 'wouter'
import {
  FileText,
  Menu,
  X
} from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { EmployeeDashboard } from '@/pages/employee/EmployeeDashboard'
import { EmployeeProfile } from '@/pages/employee/EmployeeProfile'
import { EmployeeVacations } from '@/pages/employee/EmployeeVacations'
import { EmployeeReimbursements } from '@/pages/employee/EmployeeReimbursements'
import { EmployeeRoadmap } from '@/pages/employee/EmployeeRoadmap'
import { GlobalSearchLauncher } from '@/components/GlobalSearchLauncher'
import { Sidebar } from '@/components/Sidebar'
import { ShiftReminderModal } from '@/components/ShiftReminderModal'

interface TeamMemberLayoutProps {
  user?: any
}

export function TeamMemberLayout({ user }: TeamMemberLayoutProps = {}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

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
      <ShiftReminderModal />

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
          <Sidebar role="team_member" user={user} onLogout={handleLogout} />
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:flex lg:w-72 lg:flex-col lg:fixed lg:inset-y-0">
        <Sidebar role="team_member" user={user} onLogout={handleLogout} />
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
              <div className="mb-4 flex justify-end">
                <GlobalSearchLauncher className="w-full sm:w-[220px]" />
              </div>
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
