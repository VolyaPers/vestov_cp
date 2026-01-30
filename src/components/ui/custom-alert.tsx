import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { AlertTriangle, CheckCircle, Info, XCircle } from 'lucide-react'

type AlertType = 'info' | 'success' | 'warning' | 'error'

interface AlertOptions {
  title?: string
  message: string
  type?: AlertType
  confirmText?: string
  cancelText?: string
  onConfirm?: () => void | Promise<void>
  onCancel?: () => void
}

interface ConfirmOptions extends AlertOptions {
  destructive?: boolean
}

interface AlertContextType {
  showAlert: (options: AlertOptions) => Promise<void>
  showConfirm: (options: ConfirmOptions) => Promise<boolean>
}

const AlertContext = createContext<AlertContextType | null>(null)

export function useCustomAlert() {
  const context = useContext(AlertContext)
  if (!context) {
    throw new Error('useCustomAlert must be used within an AlertProvider')
  }
  return context
}

interface AlertProviderProps {
  children: ReactNode
}

export function AlertProvider({ children }: AlertProviderProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isConfirm, setIsConfirm] = useState(false)
  const [options, setOptions] = useState<ConfirmOptions>({
    message: '',
    type: 'info',
  })
  const [resolvePromise, setResolvePromise] = useState<{
    resolve: (value: boolean) => void
  } | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const showAlert = useCallback((alertOptions: AlertOptions): Promise<void> => {
    return new Promise((resolve) => {
      setOptions({
        title: alertOptions.title || getDefaultTitle(alertOptions.type || 'info'),
        message: alertOptions.message,
        type: alertOptions.type || 'info',
        confirmText: alertOptions.confirmText || 'OK',
        onConfirm: alertOptions.onConfirm,
      })
      setIsConfirm(false)
      setResolvePromise({ resolve: () => resolve() })
      setIsOpen(true)
    })
  }, [])

  const showConfirm = useCallback((confirmOptions: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setOptions({
        title: confirmOptions.title || 'Confirm',
        message: confirmOptions.message,
        type: confirmOptions.type || 'warning',
        confirmText: confirmOptions.confirmText || 'Confirm',
        cancelText: confirmOptions.cancelText || 'Cancel',
        destructive: confirmOptions.destructive,
        onConfirm: confirmOptions.onConfirm,
        onCancel: confirmOptions.onCancel,
      })
      setIsConfirm(true)
      setResolvePromise({ resolve })
      setIsOpen(true)
    })
  }, [])

  const handleConfirm = async () => {
    if (options.onConfirm) {
      setIsLoading(true)
      try {
        await options.onConfirm()
      } finally {
        setIsLoading(false)
      }
    }
    setIsOpen(false)
    resolvePromise?.resolve(true)
  }

  const handleCancel = () => {
    if (options.onCancel) {
      options.onCancel()
    }
    setIsOpen(false)
    resolvePromise?.resolve(false)
  }

  const getIcon = (type: AlertType) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="h-6 w-6 text-green-600" />
      case 'warning':
        return <AlertTriangle className="h-6 w-6 text-amber-600" />
      case 'error':
        return <XCircle className="h-6 w-6 text-red-600" />
      default:
        return <Info className="h-6 w-6 text-blue-600" />
    }
  }

  const getDefaultTitle = (type: AlertType) => {
    switch (type) {
      case 'success':
        return 'Success'
      case 'warning':
        return 'Warning'
      case 'error':
        return 'Error'
      default:
        return 'Information'
    }
  }

  const getIconBackground = (type: AlertType) => {
    switch (type) {
      case 'success':
        return 'bg-green-100'
      case 'warning':
        return 'bg-amber-100'
      case 'error':
        return 'bg-red-100'
      default:
        return 'bg-blue-100'
    }
  }

  return (
    <AlertContext.Provider value={{ showAlert, showConfirm }}>
      {children}
      <Dialog open={isOpen} onOpenChange={(open) => !open && handleCancel()}>
        <DialogContent className="w-full">
          <DialogHeader>
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-full ${getIconBackground(options.type || 'info')} flex items-center justify-center flex-shrink-0`}>
                {getIcon(options.type || 'info')}
              </div>
              <div>
                <DialogTitle className="text-lg font-semibold">
                  {options.title}
                </DialogTitle>
              </div>
            </div>
          </DialogHeader>
          <DialogDescription className="text-sm text-gray-600 mt-2 whitespace-pre-wrap">
            {options.message}
          </DialogDescription>
          <div className="flex justify-end gap-3 mt-6 w-full">
            {isConfirm && (
              <Button
                variant="outline"
                onClick={handleCancel}
                disabled={isLoading}
              >
                {options.cancelText}
              </Button>
            )}
            <Button
              onClick={handleConfirm}
              disabled={isLoading}
              className={options.destructive ? 'bg-red-600 hover:bg-red-700 text-white' : ''}
            >
              {isLoading ? 'Processing...' : options.confirmText}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AlertContext.Provider>
  )
}
