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
    glow: 'from-cyan-500/8 via-sky-400/4 to-transparent',
  },
  team_member: {
    badge: 'Employee Space',
    icon: BriefcaseBusiness,
    glow: 'from-emerald-400/9 via-teal-400/5 to-transparent',
  },
  client: {
    badge: 'Client Portal',
    icon: Building2,
    glow: 'from-amber-400/8 via-cyan-400/4 to-transparent',
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
    <div className="flex min-h-full flex-col overflow-visible rounded-[1.75rem] border border-white/70 bg-white/78 shadow-[0_28px_56px_-28px_rgba(15,23,42,0.32)] backdrop-blur-2xl lg:h-full lg:min-h-0 lg:overflow-hidden">
      <div className="relative overflow-hidden border-b border-border/60 px-5 pb-4 pt-5">
        <div className={cn('absolute inset-0 bg-gradient-to-br opacity-80', theme.glow)} />
        <div className="absolute right-0 top-0 h-24 w-24 rounded-full bg-primary/6 blur-3xl" />
        <div className="relative">
          <Badge variant="outline" className="border-white/70 bg-white/72 text-[0.6rem] text-muted-foreground">
            {theme.badge}
          </Badge>

          <div className="mt-4 flex items-start gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-[1.15rem] border border-white/80 bg-white/90 shadow-[0_14px_26px_-22px_rgba(15,23,42,0.7)]">
              <img src={vestovLogo} alt="Vestov Logo" className="h-9 w-auto" />
            </div>
            <div className="min-w-0 pt-1">
              <h1 className="font-display text-[1.45rem] font-semibold text-foreground">
                Vestov Hub
              </h1>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-[0.9rem] bg-primary/10 text-primary">
              <ThemeIcon className="h-4 w-4" />
            </div>
            <Badge variant="outline" className="border-white/70 bg-white/72 text-muted-foreground">
              {roleSubtitles[role]}
            </Badge>
          </div>

          {role === 'client' && currentClient && (
            <div className="mt-3 rounded-[1.15rem] border border-white/75 bg-white/72 p-3 shadow-[0_14px_26px_-24px_rgba(15,23,42,0.7)]">
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
        <div className="mb-2 px-2 text-[0.66rem] font-extrabold uppercase tracking-[0.22em] text-muted-foreground">
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

      <div className="space-y-4 border-t border-border/60 bg-white/50 p-4 backdrop-blur-sm">
        {role === 'team_member' && (
          <div className="rounded-[1.15rem] border border-white/75 bg-white/72 p-3 shadow-[0_14px_26px_-24px_rgba(15,23,42,0.7)]">
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
          <div className="rounded-[1.2rem] border border-white/75 bg-white/80 p-4 shadow-[0_16px_28px_-24px_rgba(15,23,42,0.65)]">
            <div className="flex items-start gap-3.5">
              {role === 'admin' ? (
                <div className="flex h-10 w-10 items-center justify-center rounded-[0.95rem] bg-primary text-sm font-bold text-primary-foreground shadow-[0_16px_30px_-18px_hsl(var(--primary)/0.8)]">
                  {user.fullName?.split(' ').map((n: string) => n[0]).join('') || 'AD'}
                </div>
              ) : (
                <Avatar className="h-10 w-10 border border-white/70 shadow-[0_12px_24px_-18px_rgba(15,23,42,0.7)]">
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
                    className="h-9 w-9 rounded-xl border-border/60 bg-white/75"
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
