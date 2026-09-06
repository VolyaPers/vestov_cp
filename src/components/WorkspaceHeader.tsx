import { UserButton } from '@clerk/react'
import { HamburgerMenuIcon, SlashIcon } from '@radix-ui/react-icons'
import { GlobalSearchLauncher } from '@/components/GlobalSearchLauncher'
import { Button } from '@/components/ui/button'
import { WorkflowNotifications } from '@/components/WorkflowNotifications'

export function WorkspaceHeader({ workspace, title, onOpenMenu }: {
  workspace: string
  title: string
  onOpenMenu: () => void
}) {
  return (
    <header className="workspace-topbar sticky top-0 z-20">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Button variant="ghost" size="icon" className="h-10 w-10 lg:hidden" onClick={onOpenMenu} aria-label="Open workspace menu">
          <HamburgerMenuIcon className="h-5 w-5" />
        </Button>
        <div className="flex min-w-0 items-center gap-3 text-[13px]">
          <span className="hidden truncate text-muted-foreground sm:block">{workspace}</span>
          <SlashIcon className="hidden h-3 w-3 text-border sm:block" />
          <span className="truncate font-medium text-foreground">{title}</span>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-3">
          <GlobalSearchLauncher className="workspace-search" />
          <WorkflowNotifications />
          <UserButton />
        </div>
      </div>
    </header>
  )
}
