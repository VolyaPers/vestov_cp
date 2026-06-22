import { Suspense, lazy, useState } from 'react'
import type { ComponentType, LazyExoticComponent } from 'react'
import { UserButton } from '@clerk/react'
import { useQuery } from '@tanstack/react-query'
import { Route, Switch, Link, useLocation } from 'wouter'
import {
  FileText,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { GlobalSearchLauncher } from '@/components/GlobalSearchLauncher'
import { MobileBottomNav } from '@/components/MobileBottomNav'
import { MobileSidebarSheet } from '@/components/MobileSidebarSheet'
import { WorkspaceRouteSkeleton } from '@/components/page-primitives'
import { Sidebar } from '@/components/Sidebar'
import { useAppSignOut } from '@/hooks/useAppSignOut'
import { api } from '@/lib/api'
import { getActiveNavigationLabel } from '@/lib/navigation'

import type { User } from '@/types/common'

interface AdminLayoutProps {
  user?: User
}

const AdminDashboard = lazy(async () => {
  const module = await import('@/pages/admin/AdminDashboard')
  return { default: module.AdminDashboard }
})

const ReportsPage = lazy(async () => {
  const module = await import('@/pages/admin/ReportsPage')
  return { default: module.ReportsPage }
})

const ClientsPage = lazy(async () => {
  const module = await import('@/pages/admin/ClientsPage')
  return { default: module.ClientsPage }
})

const ClientDetailsPage = lazy(async () => {
  const module = await import('@/pages/admin/ClientDetailsPage')
  return { default: module.ClientDetailsPage }
})

const InvoicesPage = lazy(async () => {
  const module = await import('@/pages/admin/InvoicesPage')
  return { default: module.InvoicesPage }
})

const UsersPage = lazy(async () => {
  const module = await import('@/pages/admin/UsersPage')
  return { default: module.UsersPage }
})

const TeamOverview = lazy(async () => {
  const module = await import('@/pages/admin/TeamOverview')
  return { default: module.TeamOverview }
})

const TeamMemberDetails = lazy(async () => {
  const module = await import('@/pages/admin/TeamMemberDetails')
  return { default: module.TeamMemberDetails }
})

const EmployeeDetailsPage = lazy(async () => {
  const module = await import('@/pages/admin/EmployeeDetailsPage')
  return { default: module.EmployeeDetailsPage }
})

const VacationPage = lazy(async () => {
  const module = await import('@/pages/admin/VacationPage')
  return { default: module.VacationPage }
})

const ServicesPage = lazy(async () => {
  const module = await import('@/pages/admin/ServicesPage')
  return { default: module.ServicesPage }
})

const AdminReimbursements = lazy(async () => {
  const module = await import('@/pages/admin/AdminReimbursements')
  return { default: module.AdminReimbursements }
})

const AdminShifts = lazy(async () => {
  const module = await import('@/pages/admin/AdminShifts')
  return { default: module.AdminShifts }
})

const AdminDocumentsPage = lazy(async () => {
  const module = await import('@/pages/admin/AdminDocumentsPage')
  return { default: module.AdminDocumentsPage }
})

const AdminFeedbackPage = lazy(async () => {
  const module = await import('@/pages/admin/AdminFeedbackPage')
  return { default: module.AdminFeedbackPage }
})

const FinancesPage = lazy(async () => {
  const module = await import('@/pages/admin/FinancesPage')
  return { default: module.FinancesPage }
})

const TimeTrackingPage = lazy(async () => {
  const module = await import('@/pages/admin/TimeTrackingPage')
  return { default: module.TimeTrackingPage }
})

function createLazyRoute(PageComponent: LazyExoticComponent<ComponentType<any>>) {
  return function LazyRoute() {
    return (
      <Suspense fallback={<WorkspaceRouteSkeleton />}>
        <PageComponent />
      </Suspense>
    )
  }
}

const AdminDashboardRoute = createLazyRoute(AdminDashboard)
const ReportsPageRoute = createLazyRoute(ReportsPage)
const ServicesPageRoute = createLazyRoute(ServicesPage)
const ClientDetailsPageRoute = createLazyRoute(ClientDetailsPage)
const ClientsPageRoute = createLazyRoute(ClientsPage)
const InvoicesPageRoute = createLazyRoute(InvoicesPage)
const UsersPageRoute = createLazyRoute(UsersPage)
const TeamMemberDetailsRoute = createLazyRoute(TeamMemberDetails)
const TeamOverviewRoute = createLazyRoute(TeamOverview)
const EmployeeDetailsPageRoute = createLazyRoute(EmployeeDetailsPage)
const VacationPageRoute = createLazyRoute(VacationPage)
const AdminReimbursementsRoute = createLazyRoute(AdminReimbursements)
const AdminShiftsRoute = createLazyRoute(AdminShifts)
const AdminDocumentsPageRoute = createLazyRoute(AdminDocumentsPage)
const AdminFeedbackPageRoute = createLazyRoute(AdminFeedbackPage)
const FinancesPageRoute = createLazyRoute(FinancesPage)
const TimeTrackingPageRoute = createLazyRoute(TimeTrackingPage)

export function AdminLayout({ user }: AdminLayoutProps = {}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const signOut = useAppSignOut()
  const [location] = useLocation()
  const { data: navigationIndicators } = useQuery({
    queryKey: ['adminNavigationIndicators'],
    queryFn: () => api.getAdminNavigationIndicators(),
    refetchInterval: 60 * 1000,
    staleTime: 30 * 1000,
  })
  const todayLabel = new Date().toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
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
        <Sidebar role="admin" user={user} onLogout={handleLogout} navigationIndicators={navigationIndicators} />
      </MobileSidebarSheet>

      <div className="fixed inset-y-0 left-0 z-30 hidden w-[220px] xl:w-[232px] lg:flex">
        <Sidebar role="admin" user={user} onLogout={handleLogout} navigationIndicators={navigationIndicators} />
      </div>

      <div className="flex min-h-screen flex-col lg:pl-[220px] xl:pl-[232px]">
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
            <div className="mx-auto flex w-full max-w-[1600px] items-center gap-4 px-6 py-3 xl:px-8">
              <GlobalSearchLauncher className="max-w-[340px] flex-1" />

              <div className="ml-auto flex items-center gap-2">
                <div className="workspace-date-chip rounded-[0.7rem] px-3 py-1.5 text-[11px] font-medium text-muted-foreground">
                  {todayLabel}
                </div>
                <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-white">
                  <UserButton />
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1">
          <div className="mobile-page-pad mx-auto w-full max-w-[1600px] px-3 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-5 xl:px-10">
            <div className="mx-auto max-w-[1500px]">
              <Switch>
                <Route path="/admin/dashboard" component={AdminDashboardRoute} />
                <Route path="/admin/reports" component={ReportsPageRoute} />
                <Route path="/admin/services" component={ServicesPageRoute} />
                <Route path="/admin/clients/:id" component={ClientDetailsPageRoute} />
                <Route path="/admin/clients" component={ClientsPageRoute} />
                <Route path="/admin/invoices" component={InvoicesPageRoute} />
                <Route path="/admin/users" component={UsersPageRoute} />
                <Route path="/admin/team-detail/:id" component={TeamMemberDetailsRoute} />
                <Route path="/admin/team" component={TeamOverviewRoute} />
                <Route path="/admin/employees/:id" component={EmployeeDetailsPageRoute} />
                <Route path="/admin/vacation" component={VacationPageRoute} />
                <Route path="/admin/reimbursements" component={AdminReimbursementsRoute} />
                <Route path="/admin/shifts" component={AdminShiftsRoute} />
                <Route path="/admin/documents" component={AdminDocumentsPageRoute} />
                <Route path="/admin/feedback" component={AdminFeedbackPageRoute} />
                <Route path="/admin/finances/:section" component={FinancesPageRoute} />
                <Route path="/admin/finances" component={FinancesPageRoute} />
                <Route path="/admin/time-tracking" component={TimeTrackingPageRoute} />
                <Route path="/admin" component={AdminDashboardRoute} />
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
