import type { LucideIcon } from 'lucide-react'
import {
  BarChart3,
  BookOpen,
  Briefcase,
  Building,
  Building2,
  Calendar,
  Clock,
  DollarSign,
  FileText,
  Home,
  Receipt,
  Star,
  TrendingUp,
  User,
  UserCog,
  Users,
  Wallet,
} from 'lucide-react'
import type { Client, UserRole } from '@/types/common'

export interface NavItemChild {
  name: string
  href: string
  icon: LucideIcon
}

export interface NavItem {
  name: string
  href: string
  icon: LucideIcon
  section?: string
  external?: boolean
  children?: NavItemChild[]
}

export interface MobileNavItem {
  name: string
  href: string
  icon: LucideIcon
}

export interface SearchShortcut {
  id: string
  type: 'page'
  title: string
  subtitle: string
  href: string
  badge: string
  keywords: string[]
  external?: boolean
}

export const adminNavigation: NavItem[] = [
  { name: 'Home', href: '/admin/dashboard', icon: Home, section: 'Main' },
  { name: 'Reports', href: '/admin/reports', icon: TrendingUp, section: 'Main' },
  { name: 'Clients', href: '/admin/clients', icon: Building2, section: 'Revenue' },
  { name: 'Invoices', href: '/admin/invoices', icon: DollarSign, section: 'Revenue' },
  { name: 'Finances', href: '/admin/finances', icon: Wallet, section: 'Revenue' },
  { name: 'Services', href: '/admin/services', icon: Briefcase, section: 'Workspace' },
  { name: 'Time Tracking', href: '/admin/time-tracking', icon: Clock, section: 'Workspace' },
  { name: 'Team', href: '/admin/team', icon: Users, section: 'People' },
  { name: 'Users', href: '/admin/users', icon: UserCog, section: 'People' },
  { name: 'Shifts', href: '/admin/shifts', icon: Clock, section: 'People' },
  { name: 'Calendar', href: '/admin/vacation', icon: Calendar, section: 'People' },
  { name: 'Reimbursements', href: '/admin/reimbursements', icon: Receipt, section: 'Shortcuts' },
  { name: 'Documents', href: '/admin/documents', icon: FileText, section: 'Shortcuts' },
  { name: 'Feedback', href: '/admin/feedback', icon: Star, section: 'Shortcuts' },
]

export const teamMemberNavigation: NavItem[] = [
  { name: 'Dashboard', href: '/employee/dashboard', icon: BarChart3, section: 'Overview' },
  { name: 'Roadmap', href: '/employee/roadmap', icon: TrendingUp, section: 'Growth' },
  { name: 'Calendar', href: '/employee/vacations', icon: Calendar, section: 'Operations' },
  { name: 'Reimbursements', href: '/employee/reimbursements', icon: Receipt, section: 'Operations' },
  { name: 'Profile', href: '/employee/profile', icon: User, section: 'Account' },
  {
    name: 'Knowledge Base',
    href: 'https://www.notion.so/Vestov-Knowledge-Base-2611a26473ed80c08f2dd2178bccc864',
    icon: BookOpen,
    section: 'Account',
    external: true,
  },
]

export function getClientNavigation(clientId?: number): NavItem[] {
  if (!clientId) {
    return [
      { name: 'Team Status', href: '/client/team-status', icon: Users, section: 'Overview' },
      { name: 'Feedback', href: '/client/feedback', icon: Star, section: 'Collaboration' },
      { name: 'Profile', href: '/client/profile', icon: User, section: 'Account' },
    ]
  }

  return [
    { name: 'Overview', href: `/client/portal/${clientId}`, icon: Building, section: 'Overview' },
    { name: 'Team Status', href: '/client/team-status', icon: Users, section: 'Overview' },
    { name: 'Documents', href: `/client/documents/${clientId}`, icon: FileText, section: 'Shared Data' },
    { name: 'Invoices', href: `/client/invoices/${clientId}`, icon: DollarSign, section: 'Shared Data' },
    { name: 'Feedback', href: '/client/feedback', icon: Star, section: 'Collaboration' },
    { name: 'Profile', href: '/client/profile', icon: User, section: 'Account' },
  ]
}

export function getNavigation(role: UserRole, currentClient?: Client | null): NavItem[] {
  if (role === 'admin') return adminNavigation
  if (role === 'team_member') return teamMemberNavigation
  return getClientNavigation(currentClient?.id)
}

export function getPrimaryMobileNavigation(role: UserRole, currentClient?: Client | null): MobileNavItem[] {
  if (role === 'admin') {
    return [
      { name: 'Home', href: '/admin/dashboard', icon: BarChart3 },
      { name: 'Reports', href: '/admin/reports', icon: TrendingUp },
      { name: 'Users', href: '/admin/users', icon: UserCog },
      { name: 'Finance', href: '/admin/finances', icon: Wallet },
    ]
  }

  if (role === 'team_member') {
    return [
      { name: 'Home', href: '/employee/dashboard', icon: BarChart3 },
      { name: 'Calendar', href: '/employee/vacations', icon: Calendar },
      { name: 'Expenses', href: '/employee/reimbursements', icon: Receipt },
      { name: 'Profile', href: '/employee/profile', icon: User },
    ]
  }

  if (currentClient?.id) {
    return [
      { name: 'Overview', href: `/client/portal/${currentClient.id}`, icon: Building },
      { name: 'Team', href: '/client/team-status', icon: Users },
      { name: 'Docs', href: `/client/documents/${currentClient.id}`, icon: FileText },
      { name: 'Bills', href: `/client/invoices/${currentClient.id}`, icon: DollarSign },
    ]
  }

  return [
    { name: 'Team', href: '/client/team-status', icon: Users },
    { name: 'Feedback', href: '/client/feedback', icon: Star },
    { name: 'Profile', href: '/client/profile', icon: User },
  ]
}

export function getActiveNavigationLabel(
  role: UserRole,
  pathname: string,
  currentClient?: Client | null
): string | null {
  const navigation = getNavigation(role, currentClient)

  for (const item of navigation) {
    if (pathname === item.href || pathname.startsWith(item.href + '/')) {
      return item.name
    }

    if (item.children) {
      for (const child of item.children) {
        if (pathname === child.href || pathname.startsWith(child.href + '/')) {
          return child.name
        }
      }
    }
  }

  return null
}

export function getSearchShortcuts(role: UserRole, currentClientId?: number | null): SearchShortcut[] {
  if (role === 'admin') {
    return [
      { id: 'page:admin-dashboard', type: 'page', title: 'Dashboard', subtitle: 'Admin overview and KPIs', href: '/admin/dashboard', badge: 'Page', keywords: ['dashboard', 'overview', 'home'] },
      { id: 'page:admin-reports', type: 'page', title: 'Reports', subtitle: 'Analytics and reporting', href: '/admin/reports', badge: 'Page', keywords: ['reports', 'analytics', 'insights'] },
      { id: 'page:admin-services', type: 'page', title: 'Services', subtitle: 'Service catalog and assignments', href: '/admin/services', badge: 'Page', keywords: ['services', 'service types', 'offerings'] },
      { id: 'page:admin-clients', type: 'page', title: 'Clients', subtitle: 'CRM and client records', href: '/admin/clients', badge: 'Page', keywords: ['clients', 'crm', 'accounts'] },
      { id: 'page:admin-invoices', type: 'page', title: 'Invoices', subtitle: 'All issued invoices', href: '/admin/invoices', badge: 'Page', keywords: ['invoices', 'billing'] },
      { id: 'page:admin-finances-overview', type: 'page', title: 'Finances Overview', subtitle: 'Revenue, expenses, and balances', href: '/admin/finances/overview', badge: 'Page', keywords: ['finances', 'money', 'overview', 'revenue'] },
      { id: 'page:admin-finances-transactions', type: 'page', title: 'Transactions', subtitle: 'Income, expenses, and salary records', href: '/admin/finances/transactions', badge: 'Page', keywords: ['transactions', 'expenses', 'income', 'salaries'] },
      { id: 'page:admin-finances-salaries', type: 'page', title: 'Salaries', subtitle: 'Salary history and payouts', href: '/admin/finances/salaries', badge: 'Page', keywords: ['salary', 'payroll', 'payouts'] },
      { id: 'page:admin-time-tracking', type: 'page', title: 'Time Tracking', subtitle: 'ClickUp sync, mappings, and tracked hours', href: '/admin/time-tracking', badge: 'Page', keywords: ['time tracking', 'clickup', 'hours', 'tracked time'] },
      { id: 'page:admin-users', type: 'page', title: 'Users', subtitle: 'User accounts and access', href: '/admin/users', badge: 'Page', keywords: ['users', 'accounts', 'permissions'] },
      { id: 'page:admin-team', type: 'page', title: 'Team', subtitle: 'Team member roster and staffing', href: '/admin/team', badge: 'Page', keywords: ['team', 'employees', 'people'] },
      { id: 'page:admin-shifts', type: 'page', title: 'Shifts', subtitle: 'Shift activity and status', href: '/admin/shifts', badge: 'Page', keywords: ['shifts', 'time tracking'] },
      { id: 'page:admin-vacation', type: 'page', title: 'Calendar', subtitle: 'Leave and vacation planning', href: '/admin/vacation', badge: 'Page', keywords: ['calendar', 'vacation', 'leave'] },
      { id: 'page:admin-reimbursements', type: 'page', title: 'Reimbursements', subtitle: 'Expense reimbursement requests', href: '/admin/reimbursements', badge: 'Page', keywords: ['reimbursements', 'expenses'] },
      { id: 'page:admin-documents', type: 'page', title: 'Documents', subtitle: 'Client and service files', href: '/admin/documents', badge: 'Page', keywords: ['documents', 'files'] },
      { id: 'page:admin-feedback', type: 'page', title: 'Feedback', subtitle: 'Client and team feedback', href: '/admin/feedback', badge: 'Page', keywords: ['feedback', 'reviews'] },
    ]
  }

  if (role === 'team_member') {
    return [
      { id: 'page:employee-dashboard', type: 'page', title: 'Dashboard', subtitle: 'Employee overview', href: '/employee/dashboard', badge: 'Page', keywords: ['dashboard', 'overview'] },
      { id: 'page:employee-roadmap', type: 'page', title: 'Roadmap', subtitle: 'Career roadmap and progress', href: '/employee/roadmap', badge: 'Page', keywords: ['roadmap', 'career'] },
      { id: 'page:employee-vacations', type: 'page', title: 'Calendar', subtitle: 'Vacations and leave', href: '/employee/vacations', badge: 'Page', keywords: ['calendar', 'vacations', 'leave'] },
      { id: 'page:employee-reimbursements', type: 'page', title: 'Reimbursements', subtitle: 'Workspace reimbursement requests', href: '/employee/reimbursements', badge: 'Page', keywords: ['reimbursements', 'expenses'] },
      { id: 'page:employee-profile', type: 'page', title: 'Profile', subtitle: 'Personal profile and settings', href: '/employee/profile', badge: 'Page', keywords: ['profile', 'account'] },
      { id: 'page:employee-kb', type: 'page', title: 'Knowledge Base', subtitle: 'Open the team knowledge base', href: 'https://www.notion.so/Vestov-Knowledge-Base-2611a26473ed80c08f2dd2178bccc864', badge: 'External', keywords: ['knowledge base', 'notion', 'docs'], external: true },
    ]
  }

  const clientId = currentClientId ?? undefined

  return [
    ...(clientId ? [{ id: 'page:client-overview', type: 'page' as const, title: 'Overview', subtitle: 'Client portal overview', href: `/client/portal/${clientId}`, badge: 'Page', keywords: ['overview', 'portal', 'home'] }] : []),
    { id: 'page:client-team-status', type: 'page', title: 'Team Status', subtitle: 'Assigned team activity', href: '/client/team-status', badge: 'Page', keywords: ['team status', 'team', 'activity'] },
    ...(clientId ? [{ id: 'page:client-documents', type: 'page' as const, title: 'Documents', subtitle: 'Shared documents and folders', href: `/client/documents/${clientId}`, badge: 'Page', keywords: ['documents', 'files'] }] : []),
    ...(clientId ? [{ id: 'page:client-invoices', type: 'page' as const, title: 'Invoices', subtitle: 'Client invoice history', href: `/client/invoices/${clientId}`, badge: 'Page', keywords: ['invoices', 'billing'] }] : []),
    { id: 'page:client-feedback', type: 'page', title: 'Feedback', subtitle: 'Send service feedback', href: '/client/feedback', badge: 'Page', keywords: ['feedback', 'review'] },
    { id: 'page:client-profile', type: 'page', title: 'Profile', subtitle: 'Your client profile', href: '/client/profile', badge: 'Page', keywords: ['profile', 'account'] },
  ]
}
