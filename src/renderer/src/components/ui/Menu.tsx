import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export interface Anchor {
  x: number
  y: number
}

export function anchorFromEvent(e: React.MouseEvent): Anchor {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  return { x: rect.left, y: rect.bottom + 4 }
}

export function anchorFromPointer(e: React.MouseEvent): Anchor {
  return { x: e.clientX, y: e.clientY }
}

/** Positioned popover used for every dropdown / context menu in the app. */
export function Popover({
  anchor,
  onClose,
  children,
  width,
  minWidth
}: {
  anchor: Anchor
  onClose: () => void
  children: React.ReactNode
  width?: number
  /** overrides the .menu CSS min-width (220px) — used by Select to match its trigger */
  minWidth?: number
}): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState(anchor)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    let { x, y } = anchor
    if (x + r.width > window.innerWidth - 8) x = Math.max(8, window.innerWidth - r.width - 8)
    if (y + r.height > window.innerHeight - 8) y = Math.max(8, anchor.y - r.height - 8)
    setPos({ x, y })
  }, [anchor])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  return createPortal(
    <>
      <div
        className="popover-backdrop"
        onMouseDown={(e) => {
          e.stopPropagation()
          onClose()
        }}
        onContextMenu={(e) => {
          e.preventDefault()
          onClose()
        }}
      />
      <div
        ref={ref}
        className="menu"
        style={{ left: pos.x, top: pos.y, width, minWidth }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </>,
    document.body
  )
}

export function MenuItem({
  icon,
  label,
  danger,
  trailing,
  onClick
}: {
  icon?: React.ReactNode
  label: string
  danger?: boolean
  trailing?: React.ReactNode
  onClick?: () => void
}): React.JSX.Element {
  return (
    <button className={`menu-item${danger ? ' danger' : ''}`} onClick={onClick}>
      {icon && <span className="menu-icon">{icon}</span>}
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
      {trailing}
    </button>
  )
}

export function MenuSeparator(): React.JSX.Element {
  return <div className="menu-separator" />
}

export function MenuLabel({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <div className="menu-label">{children}</div>
}
