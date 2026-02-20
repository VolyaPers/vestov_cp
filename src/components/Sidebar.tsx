import { useState, useEffect } from 'react'
import { Link, useLocation } from 'wouter'
import {
  Users,
  UserCog,
  BarChart3,
  FileText,
  Clock,
  Star,
  Calendar,
  LogOut,
  Building2,
  DollarSign,
  ChevronDown,
  ChevronRight,
  User,
  TrendingUp,
  ExternalLink,
  BookOpen,
  Building,
  Briefcase,
  Handshake,
  Receipt,
  Wallet
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { UserImpersonation } from '@/components/UserImpersonation'
import { ShiftWidget } from '@/components/ShiftWidget'
import vestovLogo from '@/assets/vestov-logo.png'
import type { User as UserType, Client } from '@/types/common'

// Navigation item types
interface NavItemChild {
  name: string
  href: string
  icon: React.ElementType
}

interface NavItem {
  name: string
  href: string
  icon: React.ElementType
  external?: boolean
  children?: NavItemChild[]
}

// Navigation configurations per role
const adminNavigation: NavItem[] = [
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
    ]
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

const teamMemberNavigation: NavItem[] = [
  { name: 'Dashboard', href: '/employee/dashboard', icon: BarChart3 },
  { name: 'Roadmap', href: '/employee/roadmap', icon: TrendingUp },
  { name: 'Calendar', href: '/employee/vacations', icon: Calendar },
  { name: 'Reimbursements', href: '/employee/reimbursements', icon: Receipt },
  { name: 'Profile', href: '/employee/profile', icon: User },
  { name: 'Knowledge Base', href: 'https://www.notion.so/Vestov-Knowledge-Base-2611a26473ed80c08f2dd2178bccc864', icon: BookOpen, external: true },
]

const getClientNavigation = (clientId: number | undefined): NavItem[] => {
  if (!clientId) return []
  return [
    { name: 'Overview', href: `/client/portal/${clientId}`, icon: Building },
    { name: 'Team Status', href: '/client/team-status', icon: Users },
    { name: 'Documents', href: `/client/documents/${clientId}`, icon: FileText },
    { name: 'Invoices', href: `/client/invoices/${clientId}`, icon: DollarSign },
    { name: 'Feedback', href: '/client/feedback', icon: Star },
    { name: 'Profile', href: '/client/profile', icon: User },
  ]
}

// Role subtitles
const roleSubtitles: Record<string, string> = {
  admin: 'Admin Dashboard',
  team_member: 'Employee Portal',
  client: 'Client Portal',
}

// Props interface
export interface SidebarProps {
  role: 'admin' | 'team_member' | 'client'
  user?: UserType
  onLogout: () => void
  currentClient?: Client | null
}

export function Sidebar({ role, user, onLogout, currentClient }: SidebarProps) {
  const [location] = useLocation()

  // Get navigation based on role
  const navigation = role === 'admin'
    ? adminNavigation
    : role === 'team_member'
      ? teamMemberNavigation
      : getClientNavigation(currentClient?.id)

  // CRM dropdown state (admin only)
  const isCrmActive = location.startsWith('/admin/clients') || location.startsWith('/admin/invoices')
  const [crmOpen, setCrmOpen] = useState(isCrmActive)

  // Auto-open CRM dropdown when on CRM pages
  useEffect(() => {
    if (isCrmActive) {
      setCrmOpen(true)
    }
  }, [isCrmActive])

  // Show impersonation widget
  const showImpersonation = role === 'admin' || user?.isImpersonating

  return (
    <div className="flex-1 flex flex-col min-h-0 stripe-card stripe-border shadow-sm">
      <div className="flex-1 flex flex-col pt-8 pb-6 overflow-y-auto">
        {/* Header with logo */}
        <div className="flex items-center flex-shrink-0 px-6 mb-8">
          <div className="flex items-center gap-3">
            <img src={vestovLogo} alt="Vestov Logo" className="h-10 w-auto drop-shadow-lg" />
            <div>
              <h1 className="text-xl font-bold stripe-text-primary">
                Vestov Hub
              </h1>
              <p className="text-xs stripe-text-muted font-medium">{roleSubtitles[role]}</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 space-y-1">
          {navigation.map((item) => {
            const hasChildren = !!item.children

            // Handle items with children (CRM dropdown)
            if (hasChildren) {
              const isParentActive = isCrmActive
              return (
                <div key={item.name}>
                  <button
                    onClick={() => setCrmOpen(!crmOpen)}
                    className={cn(
                      'stripe-nav-item w-full',
                      isParentActive && 'stripe-nav-item-active'
                    )}
                  >
                    <div className={cn(
                      'flex items-center justify-center w-8 h-8 rounded-md mr-3 transition-all duration-150',
                      !isParentActive && 'text-[var(--stripe-text-tertiary)]'
                    )}>
                      <item.icon className="h-5 w-5" />
                    </div>
                    <span className="flex-1 font-medium text-left">{item.name}</span>
                    {crmOpen || isParentActive ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </button>
                  {(crmOpen || isParentActive) && item.children && (
                    <div className="ml-4 mt-1 space-y-1">
                      {item.children.map((child) => {
                        const isChildActive = location === child.href || location.startsWith(child.href + '/')
                        return (
                          <Link key={child.name} href={child.href}>
                            <div className={cn(
                              'stripe-nav-item pl-8',
                              isChildActive && 'stripe-nav-item-active'
                            )}>
                              <div className={cn(
                                'flex items-center justify-center w-6 h-6 rounded-md mr-3 transition-all duration-150',
                                !isChildActive && 'text-[var(--stripe-text-tertiary)]'
                              )}>
                                <child.icon className="h-4 w-4" />
                              </div>
                              <span className="flex-1 font-medium text-sm">{child.name}</span>
                            </div>
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            }

            // Handle external links
            if (item.external) {
              return (
                <a
                  key={item.name}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="stripe-nav-item"
                >
                  <item.icon
                    className="mr-3 flex-shrink-0 h-5 w-5 transition-colors text-[var(--stripe-text-tertiary)]"
                    aria-hidden="true"
                  />
                  <span className="flex-1">{item.name}</span>
                  <ExternalLink className="h-4 w-4 text-[var(--stripe-text-tertiary)] opacity-70" />
                </a>
              )
            }

            // Handle regular internal links
            const isActive = location === item.href || location.startsWith(item.href + '/')
            return (
              <Link key={item.name} href={item.href}>
                <div className={cn(
                  'stripe-nav-item',
                  isActive && 'stripe-nav-item-active'
                )}>
                  <div className={cn(
                    'flex items-center justify-center w-8 h-8 rounded-md mr-3 transition-all duration-150',
                    !isActive && 'text-[var(--stripe-text-tertiary)]'
                  )}>
                    <item.icon className="h-5 w-5" />
                  </div>
                  <span className="flex-1 font-medium">{item.name}</span>
                </div>
              </Link>
            )
          })}
        </nav>
      </div>

      {/* Bottom section with widgets and user info */}
      <div className="flex-shrink-0 p-4 space-y-4" style={{ borderTopColor: 'var(--stripe-border)' }}>
        {/* ShiftWidget - Team Member only */}
        {role === 'team_member' && <ShiftWidget />}

        {/* Current Client Info - Client only */}
        {role === 'client' && currentClient && (
          <div className="rounded-lg bg-gray-50 p-4">
            <h3 className="text-sm font-medium text-gray-900 mb-2">Current Client</h3>
            <p className="text-sm text-gray-600 font-medium">{currentClient.name}</p>
            <p className="text-xs text-gray-500 mt-1">You have read-only access</p>
          </div>
        )}

        {/* User Impersonation */}
        {showImpersonation && (
          <div className={role !== 'admin' ? 'stripe-border-bottom pb-4' : ''} style={{ borderBottomColor: 'var(--stripe-border)' }}>
            <UserImpersonation
              currentUser={user}
              onImpersonate={async () => {
                // API handles impersonation and reloads page
              }}
              onStopImpersonation={async () => {
                // API handles stop impersonation and reloads page
              }}
            />
          </div>
        )}

        {/* User info */}
        {user && (
          <div className={cn(
            'flex items-center rounded-lg p-4',
            role === 'admin' ? 'stripe-surface stripe-border' : 'stripe-card-hover'
          )}>
            {role === 'admin' ? (
              // Admin avatar style (initials)
              <div className="flex items-center justify-center w-10 h-10 rounded-lg shadow-sm mr-3" style={{ backgroundColor: 'var(--stripe-primary)', color: 'white' }}>
                <span className="text-sm font-bold">
                  {user.fullName?.split(' ').map((n: string) => n[0]).join('') || 'AD'}
                </span>
              </div>
            ) : (
              // Team member and client avatar style
              <div className="flex-shrink-0">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={(user as any).avatarUrl} alt={user.fullName || user.username} />
                  <AvatarFallback className="bg-blue-100 text-blue-600 text-sm font-semibold">
                    {(user.fullName || user.username)
                      .split(' ')
                      .map((n: string) => n[0])
                      .join('')
                      .toUpperCase()
                      .slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
              </div>
            )}
            <div className={cn('flex-1 min-w-0', role !== 'admin' && 'ml-3')}>
              <p className="text-sm font-semibold stripe-text-primary truncate">{user.fullName || user.username || 'User'}</p>
              <p className="text-xs stripe-text-muted font-medium">
                {role === 'admin' ? (user.role || 'Administrator') :
                 role === 'team_member' ? ((user as any).position || 'Team Member') :
                 'Client Role'}
              </p>
            </div>
            {/* Logout button in user info - Admin and Client only (Team Member has separate Sign Out) */}
            {role !== 'team_member' && (
              <button
                onClick={onLogout}
                className={cn(
                  'ml-2 h-9 w-9 p-0 rounded-lg transition-all duration-150 flex items-center justify-center',
                  role === 'admin'
                    ? 'stripe-btn-secondary hover:bg-red-50 hover:text-red-600 hover:border-red-200'
                    : ''
                )}
                title="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            )}
          </div>
        )}

        {/* Sign Out button (Team Member style) */}
        {role === 'team_member' && (
          <button
            onClick={onLogout}
            className="w-full stripe-nav-item"
          >
            <LogOut
              className="mr-3 flex-shrink-0 h-5 w-5 text-[var(--stripe-text-tertiary)]"
              aria-hidden="true"
            />
            Sign Out
          </button>
        )}
      </div>
    </div>
  )
}
