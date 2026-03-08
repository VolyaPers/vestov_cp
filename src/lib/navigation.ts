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
  Handshake,
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
  external?: boolean
  children?: NavItemChild[]
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
  { name: 'Dashboard', href: '/admin/dashboard', icon: BarChart3 },
  { name: 'Reports', href: '/admin/reports', icon: TrendingUp },
  { name: 'Services', href: '/admin/services', icon: Briefcase },
  {
    name: 'CRM',
    href: '/admin/clients',
    icon: Handshake,
    children: [
      { name: 'Clients', href: '/admin/clients', icon: Building2 },
      { name: 'Invoices', href: '/admin/invoices', icon: DollarSign },
    ],
  },
  { name: 'Finances', href: '/admin/finances', icon: Wallet },
  { name: 'Users', href: '/admin/users', icon: UserCog },
  { name: 'Team', href: '/admin/team', icon: Users },
  { name: 'Shifts', href: '/admin/shifts', icon: Clock },
  { name: 'Calendar', href: '/admin/vacation', icon: Calendar },
  { name: 'Reimbursements', href: '/admin/reimbursements', icon: Receipt },
  { name: 'Documents', href: '/admin/documents', icon: FileText },
  { name: 'Feedback', href: '/admin/feedback', icon: Star },
]

export const teamMemberNavigation: NavItem[] = [
  { name: 'Dashboard', href: '/employee/dashboard', icon: BarChart3 },
  { name: 'Roadmap', href: '/employee/roadmap', icon: TrendingUp },
  { name: 'Calendar', href: '/employee/vacations', icon: Calendar },
  { name: 'Reimbursements', href: '/employee/reimbursements', icon: Receipt },
  { name: 'Profile', href: '/employee/profile', icon: User },
  {
    name: 'Knowledge Base',
    href: 'https://www.notion.so/Vestov-Knowledge-Base-2611a26473ed80c08f2dd2178bccc864',
    icon: BookOpen,
    external: true,
  },
]

export function getClientNavigation(clientId?: number): NavItem[] {
  if (!clientId) {
    return [
      { name: 'Team Status', href: '/client/team-status', icon: Users },
      { name: 'Feedback', href: '/client/feedback', icon: Star },
      { name: 'Profile', href: '/client/profile', icon: User },
    ]
  }

  return [
    { name: 'Overview', href: `/client/portal/${clientId}`, icon: Building },
    { name: 'Team Status', href: '/client/team-status', icon: Users },
    { name: 'Documents', href: `/client/documents/${clientId}`, icon: FileText },
    { name: 'Invoices', href: `/client/invoices/${clientId}`, icon: DollarSign },
    { name: 'Feedback', href: '/client/feedback', icon: Star },
    { name: 'Profile', href: '/client/profile', icon: User },
  ]
}

export function getNavigation(role: UserRole, currentClient?: Client | null): NavItem[] {
  if (role === 'admin') return adminNavigation
  if (role === 'team_member') return teamMemberNavigation
  return getClientNavigation(currentClient?.id)
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
