import { useEffect } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface MobileSidebarSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  subtitle: string
  children: React.ReactNode
}

export function MobileSidebarSheet({
  open,
  onOpenChange,
  title,
  subtitle,
  children,
}: MobileSidebarSheetProps) {
  useEffect(() => {
    if (!open) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onOpenChange(false)
      }
    }

    document.addEventListener('keydown', handleEscape)

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open, onOpenChange])

  return (
    <div
      className={cn(
        'mobile-sidebar-sheet lg:hidden',
        open ? 'pointer-events-auto visible' : 'pointer-events-none invisible'
      )}
      aria-hidden={!open}
    >
      <button
        type="button"
        className={cn('mobile-sidebar-sheet-backdrop', open ? 'opacity-100' : 'opacity-0')}
        aria-label="Close workspace menu"
        onClick={() => onOpenChange(false)}
      />

      <div className={cn('mobile-sidebar-sheet-panel', open ? 'translate-x-0 opacity-100' : '-translate-x-6 opacity-0')}>
        <div className="mobile-sidebar-sheet-header">
          <div className="min-w-0">
            <p className="text-[0.65rem] font-extrabold uppercase tracking-[0.24em] text-primary/80">
              Workspace Menu
            </p>
            <h2 className="mt-1 truncate font-display text-lg font-semibold text-foreground">
              {title}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {subtitle}
            </p>
          </div>

          <Button
            type="button"
            size="icon"
            variant="outline"
            className="shrink-0"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          {children}
        </div>
      </div>
    </div>
  )
}
