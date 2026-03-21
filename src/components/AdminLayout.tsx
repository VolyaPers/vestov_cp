import { useState } from 'react'
import { Route, Switch, Link, useLocation } from 'wouter'
import {
  FileText,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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
import { GlobalSearchLauncher } from '@/components/GlobalSearchLauncher'
import { MobileBottomNav } from '@/components/MobileBottomNav'
import { MobileSidebarSheet } from '@/components/MobileSidebarSheet'
import { Sidebar } from '@/components/Sidebar'
import { useAppSignOut } from '@/hooks/useAppSignOut'
import { getActiveNavigationLabel } from '@/lib/navigation'

import type { User } from '@/types/common'

interface AdminLayoutProps {
  user?: User
}

export function AdminLayout({ user }: AdminLayoutProps = {}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const signOut = useAppSignOut()
  const [location] = useLocation()
  const todayLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'long',
    day: 'numeric',
  })
  const mobileTitle = getActiveNavigationLabel('admin', location) ?? 'Workspace'

  const handleLogout = async () => {
    await signOut()
  }

  return (
    <div className="app-shell min-h-screen">
      <MobileSidebarSheet
        open={sidebarOpen}
        onOpenChange={setSidebarOpen}
        title="Admin workspace"
        subtitle="Operations, reporting and team controls in one menu."
      >
        <Sidebar role="admin" user={user} onLogout={handleLogout} />
      </MobileSidebarSheet>

      <div className="fixed inset-y-4 left-4 z-30 hidden w-[288px] lg:flex">
        <Sidebar role="admin" user={user} onLogout={handleLogout} />
      </div>

      <div className="flex min-h-screen flex-col lg:pl-[320px]">
        <header className="sticky top-0 z-20">
          <div className="mobile-top-chrome lg:hidden">
            <div className="mobile-top-chrome-main">
              <div className="min-w-0 flex-1">
                <p className="text-[0.65rem] font-extrabold uppercase tracking-[0.24em] text-primary/80">
                  Admin Workspace
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
                  Admin Workspace
                </p>
                <h1 className="mt-1 font-display text-xl font-semibold text-foreground sm:text-2xl">
                  Operations, finance and delivery control
                </h1>
                <p className="mt-1 hidden text-sm text-muted-foreground sm:block">
                  Shared shell refreshed with shadcn-based surfaces, clearer hierarchy and faster navigation affordances.
                </p>
              </div>

              <div className="workspace-date-chip hidden rounded-full px-4 py-2 text-sm font-semibold text-muted-foreground md:block">
                {todayLabel}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="stripe-badge-success">
                <div className="h-2 w-2 rounded-full animate-pulse bg-[var(--stripe-success)]"></div>
                <span>Live system status</span>
              </div>
              <GlobalSearchLauncher className="w-full max-w-[280px]" />
            </div>
          </div>
          </div>
        </header>

        <main className="flex-1">
          <div className="mobile-page-pad mx-auto w-full max-w-[1600px] px-3 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
            <div className="mx-auto max-w-[1500px]">
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
                    <div className="flex min-h-[60vh] items-center justify-center">
                      <Card className="max-w-lg text-center">
                        <CardContent className="p-10 sm:p-12">
                          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-[1.35rem] bg-primary/10 text-primary">
                            <FileText className="h-8 w-8" />
                          </div>
                          <h2 className="font-display text-3xl font-semibold text-foreground">Page not found</h2>
                          <p className="mx-auto mt-3 max-w-sm text-sm text-muted-foreground">
                            The route does not match the refreshed admin workspace. Jump back to the main dashboard.
                          </p>
                          <Link href="/admin/dashboard">
                            <Button className="mt-6">Go to dashboard</Button>
                          </Link>
                        </CardContent>
                      </Card>
                    </div>
                  )}
                </Route>
              </Switch>
            </div>
          </div>
        </main>
      </div>

      <MobileBottomNav role="admin" onOpenMenu={() => setSidebarOpen(true)} />
    </div>
  )
}
