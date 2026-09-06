import * as React from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

interface SelectContextType {
  value: string
  onValueChange: (value: string) => void
  open: boolean
  setOpen: (open: boolean) => void
  labels: Map<string, string>
  registerLabel: (value: string, label: string) => void
  labelVersion: number
}

const SelectContext = React.createContext<SelectContextType | null>(null)

const Select = ({
  value,
  onValueChange,
  children
}: {
  value: string
  onValueChange: (value: string) => void
  children: React.ReactNode
}) => {
  const [open, setOpen] = React.useState(false)
  const [labelVersion, setLabelVersion] = React.useState(0)
  const labelsRef = React.useRef(new Map<string, string>())

  const registerLabel = React.useCallback((itemValue: string, label: string) => {
    const currentLabel = labelsRef.current.get(itemValue)
    if (currentLabel !== label) {
      labelsRef.current.set(itemValue, label)
      // Trigger re-render to update SelectValue display
      setLabelVersion(v => v + 1)
    }
  }, [])

  return (
    <SelectContext.Provider value={{ value, onValueChange, open, setOpen, labels: labelsRef.current, registerLabel, labelVersion }}>
      <div className="relative">
        {children}
      </div>
    </SelectContext.Provider>
  )
}

const SelectTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, children, ...props }, ref) => {
  const context = React.useContext(SelectContext)
  if (!context) throw new Error('SelectTrigger must be used within a Select')

  return (
    <button
      ref={ref}
      type="button"
      className={cn(
        "flex h-10 w-full items-center justify-between rounded-lg border border-input/75 bg-white px-4 py-2 text-sm shadow-none ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      onClick={() => context.setOpen(!context.open)}
      {...props}
    >
      {children}
      <ChevronDown className="h-4 w-4 opacity-50" />
    </button>
  )
})
SelectTrigger.displayName = "SelectTrigger"

const SelectValue = ({ placeholder }: { placeholder?: string }) => {
  const context = React.useContext(SelectContext)
  if (!context) throw new Error('SelectValue must be used within a Select')

  // Get the display label for the current value, or fall back to the value itself
  // labelVersion dependency ensures re-render when labels are registered
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _version = context.labelVersion
  const displayText = context.value ? (context.labels.get(context.value) || context.value) : placeholder

  return <span>{displayText}</span>
}

const SelectContent = ({ children }: { children: React.ReactNode }) => {
  const context = React.useContext(SelectContext)
  if (!context) throw new Error('SelectContent must be used within a Select')

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!(event.target as Element).closest('.select-content')) {
        context.setOpen(false)
      }
    }

    if (context.open) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [context.open])

  // Always render to allow SelectItems to register their labels,
  // but visually hide when closed
  return (
    <div
      className={cn(
        "select-content absolute z-50 top-full left-0 mt-2 w-full min-w-[8rem] overflow-hidden rounded-[1.1rem] border border-white/80 bg-popover/95 p-1.5 text-popover-foreground shadow-[0_24px_48px_-28px_rgba(15,23,42,0.38)] backdrop-blur-2xl",
        !context.open && "invisible pointer-events-none h-0 overflow-hidden opacity-0"
      )}
      aria-hidden={!context.open}
    >
      {children}
    </div>
  )
}

// Helper function to extract text content from React children
const extractTextFromChildren = (children: React.ReactNode): string => {
  if (typeof children === 'string') return children
  if (typeof children === 'number') return String(children)
  if (Array.isArray(children)) {
    return children.map(extractTextFromChildren).join('')
  }
  if (React.isValidElement(children)) {
    return extractTextFromChildren(children.props.children)
  }
  return ''
}

const SelectItem = ({
  value,
  children,
  className,
  label,
  ...props
}: {
  value: string
  children: React.ReactNode
  className?: string
  label?: string // Optional explicit label for display
} & React.HTMLAttributes<HTMLDivElement>) => {
  const context = React.useContext(SelectContext)
  if (!context) throw new Error('SelectItem must be used within a Select')

  // Register this item's label when mounted or when children change
  React.useEffect(() => {
    const displayLabel = label || extractTextFromChildren(children)
    context.registerLabel(value, displayLabel)
  }, [value, children, label, context.registerLabel])

  return (
    <div
      className={cn(
        "relative flex w-full cursor-default select-none items-center rounded-[0.9rem] py-2 pl-4 pr-3 text-sm outline-none transition-colors hover:bg-accent/75 hover:text-accent-foreground focus:bg-accent/75 focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className
      )}
      onClick={() => {
        context.onValueChange(value)
        context.setOpen(false)
      }}
      {...props}
    >
      {children}
    </div>
  )
}

export {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
}
