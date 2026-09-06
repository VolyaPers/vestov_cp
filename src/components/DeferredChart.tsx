import { Suspense, useEffect, useRef, useState, type ReactNode } from 'react'
import { Skeleton } from '@/components/ui/skeleton'

/** Reserve chart space, but only load its library when the chart approaches the viewport. */
export function DeferredChart({ children, className = 'h-72' }: { children: ReactNode; className?: string }) {
  const element = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    if (!element.current) return
    if (!('IntersectionObserver' in window)) { setVisible(true); return }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); observer.disconnect() }
    }, { rootMargin: '160px' })
    observer.observe(element.current)
    return () => observer.disconnect()
  }, [])
  const placeholder = <Skeleton className="h-full w-full rounded-lg" />
  return <div ref={element} className={className}>{visible ? <Suspense fallback={placeholder}>{children}</Suspense> : placeholder}</div>
}
