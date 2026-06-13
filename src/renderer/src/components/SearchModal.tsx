import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Search } from 'lucide-react'
import type { SearchResult } from '@shared/types'
import { useStore } from '../store'

export default function SearchModal(): React.JSX.Element {
  const setSearchOpen = useStore((s) => s.setSearchOpen)
  const openPage = useStore((s) => s.openPage)
  const pages = useStore((s) => s.pages)

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [selected, setSelected] = useState(0)
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  // empty query: show recently updated pages
  useEffect(() => {
    if (!query.trim()) {
      const recent = [...pages]
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, 8)
        .map((p) => ({ pageId: p.id, title: p.title, icon: p.icon, kind: p.kind, snippet: '' }))
      setResults(recent)
      setSelected(0)
      return
    }
    if (debounce.current) clearTimeout(debounce.current)
    debounce.current = setTimeout(async () => {
      // deepcode ignore Sqli: query is sent as a bound parameter to a prepared statement (repo.search), never concatenated into SQL
      const r = await window.boardy.search.query(query)
      setResults(r)
      setSelected(0)
    }, 120)
  }, [query, pages])

  const pick = (i: number): void => {
    const r = results[i]
    if (r) {
      openPage(r.pageId)
      setSearchOpen(false)
    }
  }

  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelected((s) => Math.min(s + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelected((s) => Math.max(s - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      pick(selected)
    } else if (e.key === 'Escape') {
      setSearchOpen(false)
    }
  }

  /** snippet comes back with [ ] around matches — render the matches bold */
  const renderSnippet = (snippet: string): React.ReactNode =>
    snippet.split(/[[\]]/).map((part, i) => (i % 2 === 1 ? <b key={i}>{part}</b> : part))

  return createPortal(
    <div className="modal-backdrop" onMouseDown={() => setSearchOpen(false)}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="search-input-row">
          <Search size={18} />
          <input
            autoFocus
            placeholder="Search pages and content…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
          />
          <span className="kbd">esc</span>
        </div>
        <div className="search-results">
          {!query.trim() && results.length > 0 && (
            <div className="menu-label">Recently updated</div>
          )}
          {results.map((r, i) => (
            <div
              key={r.pageId}
              className={`search-result${i === selected ? ' selected' : ''}`}
              onMouseEnter={() => setSelected(i)}
              onClick={() => pick(i)}
            >
              <span className="sr-icon">{r.icon ?? (r.kind === 'database' ? '🗃️' : '📄')}</span>
              <div className="sr-text">
                <div className="sr-title">{r.title || 'Untitled'}</div>
                {r.snippet && <div className="sr-snippet">{renderSnippet(r.snippet)}</div>}
              </div>
            </div>
          ))}
          {query.trim() && results.length === 0 && (
            <div className="search-empty">No results for “{query}”</div>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
