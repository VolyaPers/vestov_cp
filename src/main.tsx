import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ClerkProvider } from '@clerk/react'
import { AlertProvider } from './components/ui/custom-alert'
import App from './App'
import './index.css'

const ReactQueryDevtools = import.meta.env.DEV
  ? React.lazy(async () => {
      const module = await import('@tanstack/react-query-devtools')
      return { default: module.ReactQueryDevtools }
    })
  : null

const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

if (!clerkPublishableKey) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env.local or .env')
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: (failureCount, error: any) => {
        if (error?.status === 401) return false
        return failureCount < 3
      },
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ClerkProvider publishableKey={clerkPublishableKey}>
      <QueryClientProvider client={queryClient}>
        <AlertProvider>
          <App />
        </AlertProvider>
        {ReactQueryDevtools ? (
          <React.Suspense fallback={null}>
            <ReactQueryDevtools initialIsOpen={false} />
          </React.Suspense>
        ) : null}
      </QueryClientProvider>
    </ClerkProvider>
  </React.StrictMode>,
)
