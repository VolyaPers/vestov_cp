import { Search } from 'lucide-react'
import { openGlobalSearch } from '@/lib/globalSearch'
import { cn } from '@/lib/utils'

interface GlobalSearchLauncherProps {
  className?: string
}

export function GlobalSearchLauncher({ className }: GlobalSearchLauncherProps) {
  return (
    <button
      type="button"
      onClick={openGlobalSearch}
      className={cn('global-search-launcher', className)}
      aria-label="Open universal search"
    >
      <span className="global-search-launcher-icon">
        <Search className="h-4 w-4" />
      </span>
      <span className="flex-1 text-left">
        <span className="block text-sm font-medium stripe-text-primary">Search</span>
      </span>
      <span className="global-search-launcher-shortcut">Cmd K</span>
    </button>
  )
}
