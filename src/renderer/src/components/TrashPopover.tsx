import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { RotateCcw, Trash2, X } from 'lucide-react'
import { useStore } from '../store'
import type { Page } from '@shared/types'

export default function TrashPopover({ onClose }: { onClose: () => void }): React.JSX.Element {
  const [items, setItems] = useState<Page[]>([])
  const refreshPages = useStore((s) => s.refreshPages)

  const load = async (): Promise<void> => {
    setItems(await window.boardy.pages.trashed())
  }

  useEffect(() => {
    void load()
  }, [])

  const restore = async (id: string): Promise<void> => {
    await window.boardy.pages.restore(id)
    await Promise.all([load(), refreshPages()])
  }

  const remove = async (id: string): Promise<void> => {
    await window.boardy.pages.deleteForever(id)
    await load()
  }

  // only show trash roots (pages whose parent is not itself trashed)
  const roots = items.filter((p) => !items.some((q) => q.id === p.parentId))

  return createPortal(
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" style={{ width: 480 }} onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Trash</h2>
          <button className="icon-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div className="search-results" style={{ paddingBottom: 12 }}>
          {roots.length === 0 && <div className="search-empty">Trash is empty</div>}
          {roots.map((p) => (
            <div key={p.id} className="search-result" style={{ cursor: 'default' }}>
              <span className="sr-icon">{p.icon ?? '📄'}</span>
              <div className="sr-text" style={{ flex: 1 }}>
                <div className="sr-title">{p.title || 'Untitled'}</div>
              </div>
              <button className="icon-btn" title="Restore" onClick={() => void restore(p.id)}>
                <RotateCcw size={15} />
              </button>
              <button
                className="icon-btn"
                title="Delete permanently"
                style={{ color: 'var(--danger)' }}
                onClick={() => void remove(p.id)}
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body
  )
}
