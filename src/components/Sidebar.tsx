import { preloadRoute } from '@/lib/preloadRoute'
import { lazy, Suspense } from 'react'
import { Link, useLocation } from 'wouter'
import {
  LogOut,
  ExternalLink,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
const UserImpersonation = lazy(() => import('@/components/UserImpersonation').then(module => ({default: module.UserImpersonation})))
const ShiftWidget = lazy(() => import('@/components/ShiftWidget').then(module => ({default: module.ShiftWidget})))
import vestovLogo from '@/assets/vestov-logo.svg'
import { getNavigation } from '@/lib/navigation'
import type { NavigationIndicators } from '@/lib/api'
import type { User as UserType, Client } from '@/types/common'

// Props interface
export interface SidebarProps {
  role: 'admin' | 'team_member' | 'client'
  user?: UserType
  onLogout: () => void
  currentClient?: Client | null
  navigationIndicators?: Partial<NavigationIndicators>
}

export function Sidebar({ role, user, onLogout, currentClient, navigationIndicators }: SidebarProps) {
  const [location] = useLocation()

  // Get navigation based on role
  const navigation = getNavigation(role, currentClient)
  const navigationGroups = navigation.reduce<Array<{ title: string; items: typeof navigation }>>((groups, item) => {
    const section = item.section || 'Workspace'
    const existingGroup = groups.find((group) => group.title === section)

    if (existingGroup) {
      existingGroup.items.push(item)
    } else {
      groups.push({ title: section, items: [item] })
    }

    return groups
  }, [])

  const showImpersonation = role === 'admin' || user?.isImpersonating

  return (
    <div className="relative flex min-h-full w-full flex-col border-r border-border bg-[#f8f9fa] lg:h-full lg:min-h-0 lg:overflow-hidden">
      <div className="flex h-16 shrink-0 items-center px-5">
        <div className="flex w-full items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-[0.55rem] border border-slate-200 bg-white">
            <img src={vestovLogo} alt="" className="h-6 w-auto" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">Vestov <span className="font-normal text-muted-foreground">Hub</span></p>
          </div>

        </div>


      </div>

      <div className="px-2 py-3 lg:flex-1 lg:overflow-y-auto lg:px-2.5 lg:py-4">
        <div className="space-y-5">
          {navigationGroups.map((group) => (
            <div key={group.title}>
              <div className="mb-1.5 px-2 text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-slate-400">
                {group.title}
              </div>
              <nav className="space-y-0.5">
                {group.items.map((item) => {
                  const indicatorValue = item.indicatorKey ? navigationIndicators?.[item.indicatorKey] ?? 0 : 0
                  const indicatorLabel = indicatorValue > 99 ? '99+' : String(indicatorValue)

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
                          className="mr-3 h-4 w-4 flex-shrink-0 transition-colors text-[var(--stripe-text-tertiary)]"
                          aria-hidden="true"
                        />
                        <span className="flex-1">{item.name}</span>
                        {indicatorValue > 0 && (
                          <span className="stripe-nav-indicator" aria-label={`${indicatorValue} open ${item.name.toLowerCase()} requests`}>
                            {indicatorLabel}
                          </span>
                        )}
                        <ExternalLink className="h-4 w-4 text-[var(--stripe-text-tertiary)] opacity-70" />
                      </a>
                    )
                  }

                  const isActive = (location === item.href || location.startsWith(item.href + '/')) && !navigation.some(other => other.href !== item.href && other.href.startsWith(item.href + '/') && (location === other.href || location.startsWith(other.href + '/')))
                  return (
                    <Link key={item.name} href={item.href} onPointerEnter={(event) => { if (event.pointerType === 'mouse') preloadRoute(item.href) }} onFocus={() => preloadRoute(item.href)} aria-current={isActive ? 'page' : undefined} className="stripe-nav-link block no-underline hover:no-underline">
                      <div className={cn(
                        'stripe-nav-item',
                        isActive && 'stripe-nav-item-active'
                      )}>
                        <div className={cn(
                          'mr-3 flex h-6 w-6 items-center justify-center rounded-md transition-all duration-150',
                          !isActive && 'text-[var(--stripe-text-tertiary)]'
                        )}>
                          <item.icon className="h-4 w-4" />
                        </div>
                        <span className="min-w-0 flex-1 truncate font-medium">{item.name}</span>
                        {indicatorValue > 0 && (
                          <span className="stripe-nav-indicator" aria-label={`${indicatorValue} open ${item.name.toLowerCase()} requests`}>
                            {indicatorLabel}
                          </span>
                        )}
                      </div>
                    </Link>
                  )
                })}
              </nav>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3 border-t border-border p-3">
        {role === 'team_member' && (
          <div className="rounded-[0.8rem] border border-slate-200 bg-white p-3">
            <Suspense fallback={<div className="h-20" />}><ShiftWidget /></Suspense>
          </div>
        )}

        {showImpersonation && (
          <Suspense fallback={<div className="h-8" />}><UserImpersonation
            currentUser={user}
            onImpersonate={async () => {
              // API handles impersonation and reloads page
            }}
            onStopImpersonation={async () => {
              // API handles stop impersonation and reloads page
            }}
          /></Suspense>
        )}

        {user && (
          <div className="px-1 py-2">
            <div className="flex items-start gap-3">
              {role === 'admin' ? (
                <div className="flex h-8 w-8 items-center justify-center rounded-[0.6rem] bg-slate-900 text-xs font-bold text-white">
                  {user.fullName?.split(' ').map((n: string) => n[0]).join('') || 'AD'}
                </div>
              ) : (
                <Avatar className="h-8 w-8 border border-slate-200">
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
                    <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                      {role === 'admin' ? (user.role || 'Administrator') :
                       role === 'team_member' ? ((user as any).position || 'Team Member') :
                       'Client access'}
                    </p>
                  </div>

                  <Button
                    variant="outline"
                    size="icon"
                    onClick={onLogout}
                    className="h-8 w-8 rounded-[0.6rem] border-border bg-white"
                    title="Sign out" aria-label="Sign out"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                  </Button>
                </div>

                {user.isImpersonating && <Badge variant="destructive" className="mt-2">Impersonation</Badge>}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
