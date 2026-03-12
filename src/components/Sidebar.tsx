import { useState, useEffect } from 'react'
import { Link, useLocation } from 'wouter'
import {
  BriefcaseBusiness,
  Building2,
  LogOut,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { UserImpersonation } from '@/components/UserImpersonation'
import { ShiftWidget } from '@/components/ShiftWidget'
import vestovLogo from '@/assets/vestov-logo.png'
import { getNavigation } from '@/lib/navigation'
import type { User as UserType, Client } from '@/types/common'

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

const roleThemes = {
  admin: {
    badge: 'Admin HQ',
    icon: ShieldCheck,
    badgeClass: 'border-sky-200/80 bg-sky-50/88 text-sky-700',
    iconSurface: 'border-sky-200/80 bg-sky-50/88 text-sky-700',
    halo: 'bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,0.16),transparent_42%)]',
  },
  team_member: {
    badge: 'Employee Space',
    icon: BriefcaseBusiness,
    badgeClass: 'border-emerald-200/80 bg-emerald-50/88 text-emerald-700',
    iconSurface: 'border-emerald-200/80 bg-emerald-50/88 text-emerald-700',
    halo: 'bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.14),transparent_42%)]',
  },
  client: {
    badge: 'Client Portal',
    icon: Building2,
    badgeClass: 'border-amber-200/80 bg-amber-50/88 text-amber-700',
    iconSurface: 'border-amber-200/80 bg-amber-50/88 text-amber-700',
    halo: 'bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.14),transparent_42%)]',
  },
} as const

export function Sidebar({ role, user, onLogout, currentClient }: SidebarProps) {
  const [location] = useLocation()
  const theme = roleThemes[role]
  const ThemeIcon = theme.icon

  // Get navigation based on role
  const navigation = getNavigation(role, currentClient)

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
    <div className="relative flex min-h-full flex-col overflow-visible rounded-[1.9rem] border border-white/65 bg-[rgba(255,255,255,0.72)] shadow-[0_34px_70px_-38px_rgba(15,23,42,0.34)] backdrop-blur-2xl before:pointer-events-none before:absolute before:inset-x-6 before:top-0 before:h-px before:bg-white/95 lg:h-full lg:min-h-0 lg:overflow-hidden">
      <div className="relative overflow-hidden border-b border-slate-200/70 px-5 pb-5 pt-5">
        <div className={cn('absolute inset-0 opacity-95', theme.halo)} />
        <div className="absolute right-6 top-4 h-24 w-24 rounded-full bg-slate-900/[0.035] blur-3xl" />
        <div className="relative">
          <Badge variant="outline" className={cn('text-[0.6rem] shadow-[0_14px_28px_-24px_rgba(15,23,42,0.3)]', theme.badgeClass)}>
            {theme.badge}
          </Badge>

          <div className="mt-4 flex items-start gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-[1.15rem] border border-white/80 bg-white/92 shadow-[0_18px_34px_-24px_rgba(15,23,42,0.38)]">
              <img src={vestovLogo} alt="Vestov Logo" className="h-9 w-auto" />
            </div>
            <div className="min-w-0 pt-1">
              <h1 className="font-display text-[1.45rem] font-semibold text-foreground">
                Vestov Hub
              </h1>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <div className={cn('flex h-8 w-8 items-center justify-center rounded-[0.95rem] border shadow-[0_14px_28px_-24px_rgba(15,23,42,0.26)]', theme.iconSurface)}>
              <ThemeIcon className="h-4 w-4" />
            </div>
            <Badge variant="outline" className="border-white/75 bg-white/76 text-muted-foreground">
              {roleSubtitles[role]}
            </Badge>
          </div>

          {role === 'client' && currentClient && (
            <div className="mt-4 rounded-[1.2rem] border border-white/75 bg-white/78 p-3 shadow-[0_20px_36px_-28px_rgba(15,23,42,0.32)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-muted-foreground">Current account</p>
                  <p className="mt-1.5 font-display text-base font-semibold text-foreground">{currentClient.name}</p>
                </div>
                <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">
                  {currentClient.accessLevel || 'read'}
                </Badge>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="px-3 py-3 lg:flex-1 lg:overflow-y-auto">
        <div className="mb-3 px-2 text-[0.64rem] font-extrabold uppercase tracking-[0.22em] text-muted-foreground">
          Workspace
        </div>
        <nav className="space-y-1">
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
                      'mr-3 flex h-7 w-7 items-center justify-center rounded-md transition-all duration-150',
                      !isParentActive && 'text-[var(--stripe-text-tertiary)]'
                    )}>
                      <item.icon className="h-4.5 w-4.5" />
                    </div>
                    <span className="flex-1 font-medium text-left">{item.name}</span>
                    {crmOpen || isParentActive ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </button>
                  {(crmOpen || isParentActive) && item.children && (
                    <div className="ml-3 mt-1.5 space-y-1">
                      {item.children.map((child) => {
                        const isChildActive = location === child.href || location.startsWith(child.href + '/')
                        return (
                          <Link key={child.name} href={child.href} className="stripe-nav-link block no-underline hover:no-underline">
                            <div className={cn(
                              'stripe-nav-item pl-4.5',
                              isChildActive && 'stripe-nav-item-active'
                            )}>
                              <div className={cn(
                                'mr-3 flex h-7 w-7 items-center justify-center rounded-xl transition-all duration-150',
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
                  className="stripe-nav-item no-underline hover:no-underline"
                >
                  <item.icon
                    className="mr-3 h-4.5 w-4.5 flex-shrink-0 transition-colors text-[var(--stripe-text-tertiary)]"
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
              <Link key={item.name} href={item.href} className="stripe-nav-link block no-underline hover:no-underline">
                <div className={cn(
                  'stripe-nav-item',
                  isActive && 'stripe-nav-item-active'
                )}>
                  <div className={cn(
                    'mr-3 flex h-7 w-7 items-center justify-center rounded-md transition-all duration-150',
                    !isActive && 'text-[var(--stripe-text-tertiary)]'
                  )}>
                    <item.icon className="h-4.5 w-4.5" />
                  </div>
                  <span className="flex-1 font-medium">{item.name}</span>
                </div>
              </Link>
            )
          })}
        </nav>
      </div>

      <div className="space-y-4 border-t border-slate-200/70 bg-white/48 p-4 backdrop-blur-sm">
        {role === 'team_member' && (
          <div className="rounded-[1.2rem] border border-white/75 bg-white/76 p-3 shadow-[0_18px_34px_-28px_rgba(15,23,42,0.3)]">
            <ShiftWidget />
          </div>
        )}

        {showImpersonation && (
          <UserImpersonation
            currentUser={user}
            onImpersonate={async () => {
              // API handles impersonation and reloads page
            }}
            onStopImpersonation={async () => {
              // API handles stop impersonation and reloads page
            }}
          />
        )}

        {user && (
          <div className="rounded-[1.25rem] border border-white/80 bg-white/82 p-4 shadow-[0_22px_38px_-30px_rgba(15,23,42,0.34)]">
            <div className="flex items-start gap-3.5">
              {role === 'admin' ? (
                <div className="flex h-10 w-10 items-center justify-center rounded-[0.95rem] bg-slate-950 text-sm font-bold text-white shadow-[0_18px_30px_-20px_rgba(15,23,42,0.55)]">
                  {user.fullName?.split(' ').map((n: string) => n[0]).join('') || 'AD'}
                </div>
              ) : (
                <Avatar className="h-10 w-10 border border-white/75 shadow-[0_16px_28px_-22px_rgba(15,23,42,0.34)]">
                  <AvatarImage src={(user as any).avatarUrl} alt={user.fullName || user.username} />
                  <AvatarFallback className="bg-primary/12 text-primary text-sm font-semibold">
                    {(user.fullName || user.username)
                      .split(' ')
                      .map((n: string) => n[0])
                      .join('')
                      .toUpperCase()
                      .slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
              )}

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{user.fullName || user.username || 'User'}</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {role === 'admin' ? (user.role || 'Administrator') :
                       role === 'team_member' ? ((user as any).position || 'Team Member') :
                       'Client access'}
                    </p>
                  </div>

                  <Button
                    variant="outline"
                    size="icon"
                    onClick={onLogout}
                    className="h-9 w-9 rounded-[0.95rem] border-border/65 bg-white/82"
                    title="Sign out"
                  >
                    <LogOut className="h-4 w-4" />
                  </Button>
                </div>

                <div className="mt-2.5 flex flex-wrap gap-2">
                  <Badge variant="outline" className="border-white/70 bg-muted/70 text-muted-foreground">
                    {roleSubtitles[role]}
                  </Badge>
                  {user.isImpersonating && (
                    <Badge variant="destructive" className="bg-destructive/10 text-destructive">
                      Impersonation
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
