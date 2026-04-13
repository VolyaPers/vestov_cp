import { useState } from 'react'
import { Route, Switch, Link, useLocation } from 'wouter'
import {
  FileText,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useAppSignOut } from '@/hooks/useAppSignOut'
import { EmployeeDashboard } from '@/pages/employee/EmployeeDashboard'
import { EmployeeProfile } from '@/pages/employee/EmployeeProfile'
import { EmployeeVacations } from '@/pages/employee/EmployeeVacations'
import { EmployeeReimbursements } from '@/pages/employee/EmployeeReimbursements'
import { EmployeeRoadmap } from '@/pages/employee/EmployeeRoadmap'
import { GlobalSearchLauncher } from '@/components/GlobalSearchLauncher'
import { MobileBottomNav } from '@/components/MobileBottomNav'
import { MobileSidebarSheet } from '@/components/MobileSidebarSheet'
import { Sidebar } from '@/components/Sidebar'
import { ShiftReminderModal } from '@/components/ShiftReminderModal'
import { getActiveNavigationLabel } from '@/lib/navigation'

interface TeamMemberLayoutProps {
  user?: any
}

export function TeamMemberLayout({ user }: TeamMemberLayoutProps = {}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const signOut = useAppSignOut()
  const [location] = useLocation()
  const todayLabel = new Date().toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const mobileTitle = getActiveNavigationLabel('team_member', location) ?? 'Workspace'

  const handleLogout = async () => {
    await signOut()
  }

  return (
    <div className="app-shell min-h-screen">
      <ShiftReminderModal />

      <MobileSidebarSheet
        open={sidebarOpen}
        onOpenChange={setSidebarOpen}
        title="Employee workspace"
        subtitle="Roadmap, leave and expenses live inside one fast mobile shell."
      >
        <Sidebar role="team_member" user={user} onLogout={handleLogout} />
      </MobileSidebarSheet>

      <div className="fixed inset-y-4 left-4 z-30 hidden w-[288px] lg:flex">
        <Sidebar role="team_member" user={user} onLogout={handleLogout} />
      </div>

      <div className="flex min-h-screen flex-col lg:pl-[320px]">
        <header className="sticky top-0 z-20">
          <div className="mobile-top-chrome lg:hidden">
            <div className="mobile-top-chrome-main">
              <div className="min-w-0 flex-1">
                <p className="text-[0.65rem] font-extrabold uppercase tracking-[0.24em] text-primary/80">
                  Employee Workspace
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
                  Employee Workspace
                </p>
                <h1 className="mt-1 font-display text-xl font-semibold text-foreground sm:text-2xl">
                  Personal operations and growth dashboard
                </h1>
                <p className="mt-1 hidden text-sm text-muted-foreground sm:block">
                  Schedule, reimbursements and roadmap now sit inside the same upgraded shadcn-driven shell.
                </p>
              </div>

              <div className="workspace-date-chip hidden rounded-full px-4 py-2 text-sm font-semibold text-muted-foreground md:block">
                {todayLabel}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="stripe-badge-success">
                <div className="h-2 w-2 rounded-full animate-pulse bg-[var(--stripe-success)]"></div>
                <span>Workspace synced</span>
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
                <Route path="/employee/dashboard" component={EmployeeDashboard} />
                <Route path="/employee/profile" component={EmployeeProfile} />
                <Route path="/employee/roadmap" component={EmployeeRoadmap} />
                <Route path="/employee/vacations" component={EmployeeVacations} />
                <Route path="/employee/reimbursements" component={EmployeeReimbursements} />
                <Route path="/employee" component={EmployeeDashboard} />
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
                            This employee route is not available in the updated workspace shell.
                          </p>
                          <Link href="/employee/dashboard">
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

      <MobileBottomNav role="team_member" onOpenMenu={() => setSidebarOpen(true)} />
    </div>
  )
}
