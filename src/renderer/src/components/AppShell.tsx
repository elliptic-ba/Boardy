import { useCallback, useEffect, useState } from 'react'
import { useStore } from '../store'
import Sidebar from './Sidebar'
import PageView from './PageView'
import SearchModal from './SearchModal'
import SettingsModal from './SettingsModal'
import { PanelLeft } from 'lucide-react'
import boardyIcon from '../assets/boardy-icon-color.svg'

export default function AppShell({ theme }: { theme: 'light' | 'dark' }): React.JSX.Element {
  const currentPageId = useStore((s) => s.currentPageId)
  const searchOpen = useStore((s) => s.searchOpen)
  const settingsOpen = useStore((s) => s.settingsOpen)
  const setSearchOpen = useStore((s) => s.setSearchOpen)
  const lock = useStore((s) => s.lock)
  const createPage = useStore((s) => s.createPage)
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const onKeyDown = useCallback(
    (e: KeyboardEvent): void => {
      const mod = e.ctrlKey || e.metaKey
      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen(!useStore.getState().searchOpen)
      } else if (mod && e.key.toLowerCase() === 'l') {
        e.preventDefault()
        void lock()
      } else if (mod && e.key.toLowerCase() === 'n' && !e.shiftKey) {
        e.preventDefault()
        void createPage(null, 'page')
      } else if (mod && e.key === '\\') {
        e.preventDefault()
        setSidebarOpen((v) => !v)
      }
    },
    [setSearchOpen, lock, createPage]
  )

  useEffect(() => {
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onKeyDown])

  return (
    <div className="app">
      <Sidebar collapsed={!sidebarOpen} onToggle={() => setSidebarOpen((v) => !v)} />
      <div className="content">
        {!sidebarOpen && (
          <button
            className="icon-btn"
            style={{ position: 'absolute', top: 10, left: 10, zIndex: 20 }}
            onClick={() => setSidebarOpen(true)}
            title="Open sidebar (Ctrl+\)"
          >
            <PanelLeft size={18} />
          </button>
        )}
        {currentPageId ? (
          <PageView key={currentPageId} pageId={currentPageId} theme={theme} />
        ) : (
          <EmptyWorkspace />
        )}
      </div>
      {searchOpen && <SearchModal />}
      {settingsOpen && <SettingsModal />}
    </div>
  )
}

function EmptyWorkspace(): React.JSX.Element {
  const createPage = useStore((s) => s.createPage)
  return (
    <div className="empty-state" style={{ flex: 1 }}>
      <img className="empty-logo" src={boardyIcon} alt="" width={56} height={56} />
      <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-secondary)' }}>
        No page selected
      </div>
      <div>Pick a page from the sidebar, or create a new one.</div>
      <button
        className="btn primary"
        style={{ marginTop: 8 }}
        onClick={() => void createPage(null, 'page')}
      >
        New page
      </button>
    </div>
  )
}
