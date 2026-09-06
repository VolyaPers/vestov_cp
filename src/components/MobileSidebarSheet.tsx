import { useEffect, useRef } from 'react'
import { useLocation } from 'wouter'
import * as Dialog from '@radix-ui/react-dialog'
import { Cross2Icon } from '@radix-ui/react-icons'
import { Button } from '@/components/ui/button'

interface MobileSidebarSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  subtitle: string
  children: React.ReactNode
}

export function MobileSidebarSheet({ open, onOpenChange, title, children }: MobileSidebarSheetProps) {
  const [location] = useLocation()
  const openedLocation = useRef(location)
  useEffect(() => {
    if (openedLocation.current !== location) onOpenChange(false)
  }, [location, onOpenChange])
  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 1024px)')
    const closeOnDesktop = () => { if (desktop.matches) onOpenChange(false) }
    desktop.addEventListener('change', closeOnDesktop)
    return () => desktop.removeEventListener('change', closeOnDesktop)
  }, [onOpenChange])

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/25 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content aria-describedby={undefined} className="fixed inset-y-0 left-0 z-50 flex w-[min(320px,88vw)] flex-col bg-[#f8f9fa] outline-none data-[state=open]:animate-in data-[state=open]:slide-in-from-left-4 duration-150">
          <Dialog.Title className="sr-only">{title}</Dialog.Title>
          <Dialog.Close asChild><Button variant="ghost" size="icon" aria-label="Close workspace menu" className="absolute right-2 top-3 z-10"><Cross2Icon className="h-4 w-4" /></Button></Dialog.Close>
          <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
