const pages = import.meta.glob('../pages/**/*.tsx')
const routes: Record<string, string> = {
  '/admin/decisions': 'admin/MyDecisionsPage',
  '/admin/dashboard': 'admin/AdminDashboard', '/admin/reports': 'admin/ReportsPage',
  '/admin/clients': 'admin/ClientsPage', '/admin/invoices': 'admin/InvoicesPage',
  '/admin/finances': 'admin/FinancesPage', '/admin/services': 'admin/ServicesPage',
  '/admin/time-tracking': 'admin/TimeTrackingPage', '/admin/team': 'admin/TeamOverview',
  '/admin/users': 'admin/UsersPage', '/admin/shifts': 'admin/AdminShifts',
  '/admin/vacation': 'admin/VacationPage', '/admin/reimbursements': 'admin/AdminReimbursements',
  '/admin/documents': 'admin/AdminDocumentsPage', '/admin/feedback': 'admin/AdminFeedbackPage',
  '/employee/dashboard': 'employee/EmployeeDashboard', '/employee/vacations': 'employee/EmployeeVacations',
  '/employee/salary': 'employee/EmployeeSalary', '/employee/reimbursements': 'employee/EmployeeReimbursements',
  '/employee/roadmap': 'employee/EmployeeRoadmap', '/employee/profile': 'employee/EmployeeProfile',
  '/client/dashboard': 'client/ClientDashboard', '/client/portal': 'client/ClientPortal',
  '/client/team-status': 'client/ClientTeamStatus', '/client/documents': 'client/ClientDocuments',
  '/client/invoices': 'client/ClientInvoices', '/client/feedback': 'client/ClientFeedbackPage',
  '/client/profile': 'client/ClientProfile',
}
const loaded = new Set<string>()

/** Warm code on navigation intent, without fetching account data or preloading every page. */
export function preloadRoute(href: string) {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection
  if (connection?.saveData || connection?.effectiveType?.includes('2g')) return
  const key = Object.keys(routes).find(route => href === route || href.startsWith(route + '/'))
  if (!key || loaded.has(key)) return
  const load = pages[`../pages/${routes[key]}.tsx`]
  if (!load) return
  loaded.add(key)
  void load().catch(() => loaded.delete(key))
}
