import { Suspense, lazy, useState } from 'react'
import type { ComponentType, LazyExoticComponent } from 'react'
import { Route, Switch, Link, useLocation } from 'wouter'
import {
  FileText,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useAppSignOut } from '@/hooks/useAppSignOut'
import { WorkspaceHeader } from '@/components/WorkspaceHeader'
import { MobileBottomNav } from '@/components/MobileBottomNav'
const MobileSidebarSheet = lazy(() => import('@/components/MobileSidebarSheet').then(module => ({ default: module.MobileSidebarSheet })))
import { WorkspaceRouteSkeleton } from '@/components/page-primitives'
import { Sidebar } from '@/components/Sidebar'
import { ShiftReminderModal } from '@/components/ShiftReminderModal'
import { getActiveNavigationLabel } from '@/lib/navigation'

interface TeamMemberLayoutProps {
  user?: any
}

const EmployeeDashboard = lazy(async () => {
  const module = await import('@/pages/employee/EmployeeDashboard')
  return { default: module.EmployeeDashboard }
})

const EmployeeProfile = lazy(async () => {
  const module = await import('@/pages/employee/EmployeeProfile')
  return { default: module.EmployeeProfile }
})

const EmployeeVacations = lazy(async () => {
  const module = await import('@/pages/employee/EmployeeVacations')
  return { default: module.EmployeeVacations }
})

const EmployeeReimbursements = lazy(async () => {
  const module = await import('@/pages/employee/EmployeeReimbursements')
  return { default: module.EmployeeReimbursements }
})

const EmployeeSalary = lazy(async () => ({ default: (await import('@/pages/employee/EmployeeSalary')).EmployeeSalary }))
const EmployeeSalaryRoute = createLazyRoute(EmployeeSalary)

const EmployeeRoadmap = lazy(async () => {
  const module = await import('@/pages/employee/EmployeeRoadmap')
  return { default: module.EmployeeRoadmap }
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

const EmployeeDashboardRoute = createLazyRoute(EmployeeDashboard)
const EmployeeProfileRoute = createLazyRoute(EmployeeProfile)
const EmployeeVacationsRoute = createLazyRoute(EmployeeVacations)
const EmployeeReimbursementsRoute = createLazyRoute(EmployeeReimbursements)
const EmployeeRoadmapRoute = createLazyRoute(EmployeeRoadmap)

export function TeamMemberLayout({ user }: TeamMemberLayoutProps = {}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const signOut = useAppSignOut()
  const [location] = useLocation()
  const mobileTitle = getActiveNavigationLabel('team_member', location) ?? 'Workspace'

  const handleLogout = async () => {
    await signOut()
  }

  return (
    <div className="app-shell min-h-[100dvh]">
      <ShiftReminderModal />

      {sidebarOpen && <Suspense fallback={null}>
      <MobileSidebarSheet
        open={sidebarOpen}
        onOpenChange={setSidebarOpen}
        title="Employee workspace"
        subtitle="Roadmap, leave and expenses live inside one fast mobile shell."
      >
        <Sidebar role="team_member" user={user} onLogout={handleLogout} />
      </MobileSidebarSheet>
      </Suspense>}

      <div className="workspace-sidebar fixed inset-y-0 left-0 z-30 hidden w-[232px] lg:flex">
        <Sidebar role="team_member" user={user} onLogout={handleLogout} />
      </div>

      <div className="flex min-h-[100dvh] flex-col lg:pl-[232px]">
        <WorkspaceHeader workspace="My workspace" title={mobileTitle} onOpenMenu={() => setSidebarOpen(true)} />

        <main id="workspace-content" className="min-w-0 flex-1">
          <div className="mobile-page-pad mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            <div className="mx-auto max-w-[1400px]">
              <Switch>
                <Route path="/employee/salary" component={EmployeeSalaryRoute} />
                <Route path="/employee/dashboard" component={EmployeeDashboardRoute} />
                <Route path="/employee/profile" component={EmployeeProfileRoute} />
                <Route path="/employee/roadmap" component={EmployeeRoadmapRoute} />
                <Route path="/employee/vacations" component={EmployeeVacationsRoute} />
                <Route path="/employee/reimbursements" component={EmployeeReimbursementsRoute} />
                <Route path="/employee" component={EmployeeDashboardRoute} />
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
                            This page could not be found.
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
