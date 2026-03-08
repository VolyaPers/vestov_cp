import { useDeferredValue, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useLocation } from 'wouter'
import {
  ArrowRight,
  Building2,
  Command,
  CornerDownLeft,
  Loader2,
  Search,
  UserCog,
  Users,
  Wallet,
} from 'lucide-react'
import { api } from '@/lib/api'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { GLOBAL_SEARCH_OPEN_EVENT } from '@/lib/globalSearch'
import { getSearchShortcuts } from '@/lib/navigation'
import { cn } from '@/lib/utils'
import type { AdminGlobalSearchResponse, GlobalSearchResult, User } from '@/types/common'

type SearchGroup = {
  id: string
  label: string
  items: GlobalSearchResult[]
}

interface GlobalSearchProps {
  user: User
}

function inferCurrentClientId(pathname: string): number | null {
  const match = pathname.match(/^\/client\/(?:portal|documents|invoices)\/(\d+)/)
  if (!match) return null

  const parsed = Number.parseInt(match[1], 10)
  return Number.isFinite(parsed) ? parsed : null
}

function matchesShortcut(result: GlobalSearchResult & { keywords?: string[] }, rawQuery: string) {
  const query = rawQuery.trim().toLowerCase()
  if (!query) return true

  return [result.title, result.subtitle, result.badge, result.meta, ...(result.keywords ?? [])]
    .filter(Boolean)
    .some((value) => value!.toLowerCase().includes(query))
}

function getResultIcon(result: GlobalSearchResult) {
  switch (result.type) {
    case 'user':
      return UserCog
    case 'team_member':
      return Users
    case 'client':
      return Building2
    case 'transaction':
      return Wallet
    case 'page':
    default:
      return Search
  }
}

function getInitials(title: string) {
  return title
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function ResultMedia({ result }: { result: GlobalSearchResult }) {
  const Icon = getResultIcon(result)

  if (result.type === 'client' && result.imageUrl) {
    return (
      <span className="global-search-result-logo">
        <img src={result.imageUrl} alt={result.title} className="h-6 w-6 object-contain" />
      </span>
    )
  }

  if ((result.type === 'user' || result.type === 'team_member') && result.imageUrl) {
    return (
      <Avatar className="global-search-result-avatar">
        <AvatarImage src={result.imageUrl} alt={result.title} />
        <AvatarFallback className="bg-[rgba(99,91,255,0.12)] text-[var(--stripe-primary)] text-xs font-semibold">
          {getInitials(result.title)}
        </AvatarFallback>
      </Avatar>
    )
  }

  return (
    <span className="global-search-result-icon">
      <Icon className="h-4 w-4" />
    </span>
  )
}

function getGroupLabel(groupId: keyof AdminGlobalSearchResponse) {
  switch (groupId) {
    case 'users':
      return 'Users'
    case 'teamMembers':
      return 'Team Members'
    case 'clients':
      return 'Clients'
    case 'transactions':
      return 'Transactions'
  }
}

export function GlobalSearch({ user }: GlobalSearchProps) {
  const [location, setLocation] = useLocation()
  const inputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const deferredQuery = useDeferredValue(query)
  const [debouncedQuery, setDebouncedQuery] = useState('')

  const currentClientId = useMemo(() => inferCurrentClientId(window.location.pathname), [location])

  useEffect(() => {
    if (!open) {
      setDebouncedQuery('')
      return
    }

    const timeoutId = window.setTimeout(() => {
      setDebouncedQuery(deferredQuery.trim())
    }, 120)

    return () => window.clearTimeout(timeoutId)
  }, [deferredQuery, open])

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setOpen((current) => !current)
      }
    }

    const handleOpen = () => setOpen(true)

    window.addEventListener('keydown', handleShortcut)
    window.addEventListener(GLOBAL_SEARCH_OPEN_EVENT, handleOpen)

    return () => {
      window.removeEventListener('keydown', handleShortcut)
      window.removeEventListener(GLOBAL_SEARCH_OPEN_EVENT, handleOpen)
    }
  }, [])

  useEffect(() => {
    if (!open) return

    document.body.style.overflow = 'hidden'

    const focusId = window.setTimeout(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    }, 10)

    return () => {
      document.body.style.overflow = ''
      window.clearTimeout(focusId)
    }
  }, [open])

  const adminSearch = useQuery({
    queryKey: ['admin-global-search', debouncedQuery],
    queryFn: () => api.searchAdminGlobal(debouncedQuery, 5),
    enabled: open && user.role === 'admin' && debouncedQuery.length >= 2,
    staleTime: 60_000,
  })

  const pageShortcuts = useMemo(() => {
    return getSearchShortcuts(user.role, currentClientId)
      .filter((result) => matchesShortcut(result, query))
      .slice(0, query.trim() ? 8 : 10)
  }, [currentClientId, query, user.role])

  const groups = useMemo<SearchGroup[]>(() => {
    const nextGroups: SearchGroup[] = []

    if (pageShortcuts.length > 0) {
      nextGroups.push({
        id: 'pages',
        label: query.trim() ? 'Page Shortcuts' : 'Quick Actions',
        items: pageShortcuts,
      })
    }

    if (user.role === 'admin' && debouncedQuery.length >= 2 && adminSearch.data) {
      ;(['users', 'teamMembers', 'clients', 'transactions'] as const).forEach((groupId) => {
        const items = adminSearch.data[groupId]
        if (items.length > 0) {
          nextGroups.push({
            id: groupId,
            label: getGroupLabel(groupId),
            items,
          })
        }
      })
    }

    return nextGroups
  }, [adminSearch.data, debouncedQuery.length, pageShortcuts, query, user.role])

  const flatResults = useMemo(() => groups.flatMap((group) => group.items), [groups])

  useEffect(() => {
    setSelectedIndex(0)
  }, [query, groups.length, flatResults.length])

  const close = () => {
    setOpen(false)
    setQuery('')
    setSelectedIndex(0)
  }

  const selectResult = (result: GlobalSearchResult) => {
    close()

    if (result.external) {
      window.open(result.href, '_blank', 'noopener,noreferrer')
      return
    }

    setLocation(result.href)
  }

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      close()
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (flatResults.length === 0) return
      setSelectedIndex((current) => (current + 1) % flatResults.length)
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (flatResults.length === 0) return
      setSelectedIndex((current) => (current - 1 + flatResults.length) % flatResults.length)
      return
    }

    if (event.key === 'Home') {
      event.preventDefault()
      setSelectedIndex(0)
      return
    }

    if (event.key === 'End') {
      event.preventDefault()
      setSelectedIndex(Math.max(flatResults.length - 1, 0))
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      const selected = flatResults[selectedIndex]
      if (selected) {
        selectResult(selected)
      }
    }
  }

  if (!open) return null

  const showRecordHint = user.role === 'admin' && query.trim().length > 0 && query.trim().length < 2
  const showEmptyState = !adminSearch.isLoading && groups.length === 0 && query.trim().length >= 2

  return (
    <div className="global-search-overlay" role="dialog" aria-modal="true" aria-labelledby="global-search-title">
      <button type="button" className="global-search-backdrop" aria-label="Close universal search" onClick={close} />

      <div className="global-search-shell" onClick={(event) => event.stopPropagation()}>
        <div className="global-search-header">
          <div className="global-search-input-wrap">
            <Search className="global-search-input-icon" aria-hidden="true" />
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={handleKeyDown}
              className="global-search-input"
              placeholder={user.role === 'admin'
                ? 'Search users, team members, clients, transactions, or jump to a page...'
                : 'Jump to a page...'}
              role="combobox"
              aria-expanded="true"
              aria-controls="global-search-results"
              aria-activedescendant={flatResults[selectedIndex] ? `global-search-option-${flatResults[selectedIndex].id}` : undefined}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
            />
          </div>

          <div className="global-search-meta">
            <span className="global-search-kbd">
              <Command className="h-3.5 w-3.5" />
              <span>K</span>
            </span>
          </div>
        </div>

        <div className="global-search-subheader">
          <h2 id="global-search-title" className="text-sm font-semibold stripe-text-primary">
            Universal Search
          </h2>
          <p className="text-xs stripe-text-muted">
            {user.role === 'admin'
              ? 'Instant page shortcuts plus live search across people, clients, and finance records.'
              : 'Fast page navigation from anywhere in the app.'}
          </p>
        </div>

        <div id="global-search-results" className="global-search-results" role="listbox" aria-label="Search results">
          {showRecordHint && (
            <div className="global-search-message">
              <p className="text-sm stripe-text-primary">Type at least 2 characters to search records.</p>
              <p className="text-xs stripe-text-muted">Page shortcuts are available immediately.</p>
            </div>
          )}

          {adminSearch.isLoading && (
            <div className="global-search-message">
              <Loader2 className="h-4 w-4 animate-spin text-[var(--stripe-primary)]" />
              <span className="text-sm stripe-text-secondary">Searching records...</span>
            </div>
          )}

          {adminSearch.isError && (
            <div className="global-search-message">
              <p className="text-sm text-red-600">Search is unavailable right now.</p>
            </div>
          )}

          {groups.map((group) => (
            <section key={group.id} className="global-search-group" aria-label={group.label}>
              <div className="global-search-group-header">
                <span>{group.label}</span>
                <span>{group.items.length}</span>
              </div>

              <div className="space-y-1">
                {group.items.map((result) => {
                  const flatIndex = flatResults.findIndex((item) => item.id === result.id)
                  const selected = flatIndex === selectedIndex
                  return (
                    <button
                      key={result.id}
                      id={`global-search-option-${result.id}`}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      className={cn('global-search-result', selected && 'global-search-result-active')}
                      onMouseEnter={() => setSelectedIndex(flatIndex)}
                      onClick={() => selectResult(result)}
                    >
                      <ResultMedia result={result} />

                      <span className="min-w-0 flex-1 text-left">
                        <span className="global-search-result-title-row">
                          <span className="global-search-result-title">{result.title}</span>
                          <span className="global-search-result-badge">{result.badge}</span>
                          {result.meta && <span className="global-search-result-meta">{result.meta}</span>}
                        </span>
                        <span className="global-search-result-subtitle">{result.subtitle}</span>
                      </span>

                      <span className="global-search-result-action">
                        {result.external ? <ArrowRight className="h-4 w-4" /> : <CornerDownLeft className="h-4 w-4" />}
                      </span>
                    </button>
                  )
                })}
              </div>
            </section>
          ))}

          {showEmptyState && (
            <div className="global-search-empty">
              <p className="text-sm font-semibold stripe-text-primary">No matches found</p>
              <p className="text-xs stripe-text-muted">Try a name, email, client, category, or transaction ID.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
