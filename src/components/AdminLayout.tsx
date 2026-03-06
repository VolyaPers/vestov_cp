import { useState } from 'react'
import { Route, Switch, Link } from 'wouter'
import {
  FileText,
  Menu,
  X
} from 'lucide-react'
import { AdminDashboard } from '@/pages/admin/AdminDashboard'
import { ReportsPage } from '@/pages/admin/ReportsPage'
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
import { AdminFeedbackPage } from '@/pages/admin/AdminFeedbackPage'
import { FinancesPage } from '@/pages/admin/FinancesPage'
import { Sidebar } from '@/components/Sidebar'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

import type { User } from '@/types/common'

interface AdminLayoutProps {
  user?: User
}

export function AdminLayout({ user }: AdminLayoutProps = {}) {
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
          <Sidebar role="admin" user={user} onLogout={handleLogout} />
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:flex lg:w-72 lg:flex-col lg:fixed lg:inset-y-0">
        <Sidebar role="admin" user={user} onLogout={handleLogout} />
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
                <Route path="/admin/reports" component={ReportsPage} />
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
                <Route path="/admin/feedback" component={AdminFeedbackPage} />
                <Route path="/admin/finances/:section" component={FinancesPage} />
                <Route path="/admin/finances" component={FinancesPage} />
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
