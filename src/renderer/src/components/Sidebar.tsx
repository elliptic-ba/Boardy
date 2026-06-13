import { useMemo, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent
} from '@dnd-kit/core'
import {
  ChevronDown,
  ChevronRight,
  Copy,
  Database,
  FileText,
  Lock,
  MoreHorizontal,
  PanelLeft,
  Plus,
  Search,
  Settings,
  Trash2
} from 'lucide-react'
import { useStore } from '../store'
import boardyIcon from '../assets/boardy-icon-color.svg'
import type { Page } from '@shared/types'
import { Popover, MenuItem, MenuSeparator, anchorFromPointer, type Anchor } from './ui/Menu'
import TrashPopover from './TrashPopover'

export default function Sidebar({
  collapsed,
  onToggle
}: {
  collapsed: boolean
  onToggle: () => void
}): React.JSX.Element {
  const pages = useStore((s) => s.pages)
  const createPage = useStore((s) => s.createPage)
  const setSearchOpen = useStore((s) => s.setSearchOpen)
  const setSettingsOpen = useStore((s) => s.setSettingsOpen)
  const trashOpen = useStore((s) => s.trashOpen)
  const setTrashOpen = useStore((s) => s.setTrashOpen)
  const lock = useStore((s) => s.lock)
  const movePage = useStore((s) => s.movePage)

  const roots = useMemo(
    () => pages.filter((p) => p.parentId === null || !pages.some((q) => q.id === p.parentId)),
    [pages]
  )

  const [dragging, setDragging] = useState<Page | null>(null)
  const [addMenuAnchor, setAddMenuAnchor] = useState<Anchor | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const onDragStart = (e: DragStartEvent): void => {
    const page = pages.find((p) => p.id === e.active.id)
    setDragging(page ?? null)
  }

  const onDragEnd = (e: DragEndEvent): void => {
    setDragging(null)
    const over = e.over
    if (!over) return
    const activeId = String(e.active.id)
    const [zone, targetId] = String(over.id).split(':')
    if (!targetId || targetId === activeId) return
    const target = pages.find((p) => p.id === targetId)
    if (!target) return
    if (zone === 'into') {
      const children = pages.filter((p) => p.parentId === targetId)
      const maxPos = children.reduce((m, c) => Math.max(m, c.position), 0)
      void movePage(activeId, targetId, maxPos + 1)
    } else if (zone === 'before') {
      void movePage(activeId, target.parentId, target.position - 0.5)
    } else if (zone === 'after') {
      void movePage(activeId, target.parentId, target.position + 0.5)
    }
  }

  return (
    <div className={`sidebar${collapsed ? ' collapsed' : ''}`}>
      <div className="sidebar-header">
        <div className="workspace-name">
          <img className="workspace-logo" src={boardyIcon} alt="" width={22} height={22} />
          <span>Boardy</span>
        </div>
        <button className="icon-btn" onClick={onToggle} title="Close sidebar (Ctrl+\)">
          <PanelLeft size={16} />
        </button>
      </div>

      <div className="sidebar-actions">
        <button className="sidebar-action" onClick={() => setSearchOpen(true)}>
          <Search size={16} />
          Search
          <span className="kbd">Ctrl K</span>
        </button>
        <button className="sidebar-action" onClick={() => setSettingsOpen(true)}>
          <Settings size={16} />
          Settings
        </button>
        <button className="sidebar-action" onClick={() => void createPage(null, 'page')}>
          <Plus size={16} />
          New page
          <span className="kbd">Ctrl N</span>
        </button>
      </div>

      <div className="sidebar-section">
        <div className="sidebar-section-label">
          Private
          <button
            className="icon-btn"
            title="Add a page or database"
            onClick={(e) => {
              e.stopPropagation()
              setAddMenuAnchor(anchorFromPointer(e))
            }}
          >
            <Plus size={14} />
          </button>
        </div>
        {addMenuAnchor && (
          <Popover anchor={addMenuAnchor} onClose={() => setAddMenuAnchor(null)}>
            <MenuItem
              icon={<FileText size={15} />}
              label="New page"
              onClick={() => {
                setAddMenuAnchor(null)
                void createPage(null, 'page')
              }}
            />
            <MenuItem
              icon={<Database size={15} />}
              label="New database"
              onClick={() => {
                setAddMenuAnchor(null)
                void createPage(null, 'database')
              }}
            />
          </Popover>
        )}
        <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
          {roots.length === 0 && <div className="tree-empty">No pages yet</div>}
          {roots.map((p) => (
            <TreeNode key={p.id} page={p} depth={0} />
          ))}
          <DragOverlay>
            {dragging && (
              <div
                className="tree-item active"
                style={{ width: 220, background: 'var(--bg)', boxShadow: 'var(--shadow-popover)' }}
              >
                <span className="tree-icon">
                  {dragging.icon ?? (dragging.kind === 'database' ? <Database size={15} /> : <FileText size={15} />)}
                </span>
                <span className="tree-title">{dragging.title || 'Untitled'}</span>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </div>

      <div className="sidebar-footer">
        <button className="sidebar-action" onClick={() => setTrashOpen(!trashOpen)}>
          <Trash2 size={16} />
          Trash
        </button>
        <button className="sidebar-action" onClick={() => void lock()}>
          <Lock size={16} />
          Lock
          <span className="kbd">Ctrl L</span>
        </button>
      </div>
      {trashOpen && <TrashPopover onClose={() => setTrashOpen(false)} />}
    </div>
  )
}

function TreeNode({ page, depth }: { page: Page; depth: number }): React.JSX.Element {
  const pages = useStore((s) => s.pages)
  const expanded = useStore((s) => s.expanded)
  const currentPageId = useStore((s) => s.currentPageId)
  const openPage = useStore((s) => s.openPage)
  const toggleExpanded = useStore((s) => s.toggleExpanded)
  const createPage = useStore((s) => s.createPage)
  const trashPage = useStore((s) => s.trashPage)
  const duplicatePage = useStore((s) => s.duplicatePage)

  const [menuAnchor, setMenuAnchor] = useState<Anchor | null>(null)

  const children = useMemo(
    () => pages.filter((p) => p.parentId === page.id),
    [pages, page.id]
  )
  const isExpanded = !!expanded[page.id]
  const isActive = currentPageId === page.id

  const { attributes, listeners, setNodeRef: setDragRef } = useDraggable({ id: page.id })
  const before = useDroppable({ id: `before:${page.id}` })
  const into = useDroppable({ id: `into:${page.id}` })
  const after = useDroppable({ id: `after:${page.id}` })

  return (
    <div>
      {before.isOver && <div className="drop-indicator" />}
      <div
        ref={(el) => {
          setDragRef(el)
          into.setNodeRef(el)
        }}
        {...attributes}
        {...listeners}
        className={`tree-item${isActive ? ' active' : ''}${into.isOver ? ' drop-into' : ''}`}
        style={{ paddingLeft: 4 + depth * 14 }}
        onClick={() => openPage(page.id)}
        onContextMenu={(e) => {
          e.preventDefault()
          setMenuAnchor(anchorFromPointer(e))
        }}
      >
        {/* invisible strips that register before/after drops */}
        <div
          ref={before.setNodeRef}
          style={{ position: 'absolute', top: -2, left: 0, right: 0, height: 7, zIndex: 4 }}
        />
        <div
          ref={after.setNodeRef}
          style={{ position: 'absolute', bottom: -2, left: 0, right: 0, height: 7, zIndex: 4 }}
        />
        <button
          className="expand-btn"
          onClick={(e) => {
            e.stopPropagation()
            toggleExpanded(page.id)
          }}
        >
          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        <span className="tree-icon">
          {page.icon ?? (page.kind === 'database' ? <Database size={15} /> : <FileText size={15} />)}
        </span>
        <span className="tree-title">{page.title || 'Untitled'}</span>
        <span className="tree-hover-actions">
          <button
            className="icon-btn"
            title="More options"
            onClick={(e) => {
              e.stopPropagation()
              setMenuAnchor(anchorFromPointer(e))
            }}
          >
            <MoreHorizontal size={14} />
          </button>
          <button
            className="icon-btn"
            title="Add a page inside"
            onClick={(e) => {
              e.stopPropagation()
              void createPage(page.id, 'page')
            }}
          >
            <Plus size={14} />
          </button>
        </span>
      </div>
      {after.isOver && <div className="drop-indicator" />}

      {isExpanded && (
        <div>
          {children.length === 0 && (
            <div className="tree-empty" style={{ paddingLeft: 24 + depth * 14 }}>
              No pages inside
            </div>
          )}
          {children.map((c) => (
            <TreeNode key={c.id} page={c} depth={depth + 1} />
          ))}
        </div>
      )}

      {menuAnchor && (
        <Popover anchor={menuAnchor} onClose={() => setMenuAnchor(null)}>
          <MenuItem
            icon={<Plus size={15} />}
            label="Add page inside"
            onClick={() => {
              setMenuAnchor(null)
              void createPage(page.id, 'page')
            }}
          />
          <MenuItem
            icon={<Database size={15} />}
            label="Add database inside"
            onClick={() => {
              setMenuAnchor(null)
              void createPage(page.id, 'database')
            }}
          />
          <MenuSeparator />
          <MenuItem
            icon={<Copy size={15} />}
            label="Duplicate"
            onClick={() => {
              setMenuAnchor(null)
              void duplicatePage(page.id)
            }}
          />
          <MenuItem
            icon={<Trash2 size={15} />}
            label="Move to trash"
            danger
            onClick={() => {
              setMenuAnchor(null)
              void trashPage(page.id)
            }}
          />
        </Popover>
      )}
    </div>
  )
}
