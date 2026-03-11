import { Link, useLocation } from 'wouter'
import { Menu } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getPrimaryMobileNavigation } from '@/lib/navigation'
import type { Client, UserRole } from '@/types/common'

interface MobileBottomNavProps {
  role: UserRole
  currentClient?: Client | null
  onOpenMenu: () => void
}

export function MobileBottomNav({ role, currentClient, onOpenMenu }: MobileBottomNavProps) {
  const [location] = useLocation()
  const items = getPrimaryMobileNavigation(role, currentClient)

  return (
    <div className="mobile-bottom-dock lg:hidden">
      <div className="mobile-bottom-dock-shell">
        {items.map((item) => {
          const isActive = location === item.href || location.startsWith(item.href + '/')

          return (
            <Link
              key={item.href}
              href={item.href}
              className="mobile-bottom-dock-link block min-w-0 no-underline hover:no-underline"
            >
              <div className={cn('mobile-bottom-dock-item', isActive && 'mobile-bottom-dock-item-active')}>
                <item.icon className="h-[1.1rem] w-[1.1rem] shrink-0" />
                <span className="mobile-bottom-dock-label">{item.name}</span>
              </div>
            </Link>
          )
        })}

        <button
          type="button"
          className="mobile-bottom-dock-item"
          onClick={onOpenMenu}
          aria-label="Open workspace menu"
        >
          <Menu className="h-[1.1rem] w-[1.1rem] shrink-0" />
          <span className="mobile-bottom-dock-label">Menu</span>
        </button>
      </div>
    </div>
  )
}
