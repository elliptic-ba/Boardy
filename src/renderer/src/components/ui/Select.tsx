import { useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { Popover, MenuItem, type Anchor } from './Menu'

export interface SelectOption<T extends string | number> {
  value: T
  label: string
}

/**
 * Themed replacement for a native <select>. The closed control is a styled
 * button; the open list reuses the app's rounded, theme-aware Popover/Menu so
 * dropdowns match the rest of the UI (native option lists can't be styled and
 * render with the OS's square-cornered popup).
 */
export function Select<T extends string | number>({
  value,
  options,
  onChange,
  disabled,
  style,
  placeholder
}: {
  value: T
  options: SelectOption<T>[]
  onChange: (value: T) => void
  disabled?: boolean
  style?: React.CSSProperties
  placeholder?: string
}): React.JSX.Element {
  const btnRef = useRef<HTMLButtonElement>(null)
  const [menu, setMenu] = useState<{ anchor: Anchor; width: number } | null>(null)
  const current = options.find((o) => o.value === value)

  const open = (): void => {
    const el = btnRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setMenu({ anchor: { x: r.left, y: r.bottom + 4 }, width: r.width })
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className="select"
        disabled={disabled}
        style={style}
        onClick={open}
      >
        <span className="select-value">{current?.label ?? placeholder ?? ''}</span>
        <ChevronDown size={14} className="select-caret" />
      </button>
      {menu && (
        <Popover anchor={menu.anchor} minWidth={menu.width} onClose={() => setMenu(null)}>
          {options.map((o) => (
            <MenuItem
              key={String(o.value)}
              label={o.label}
              trailing={o.value === value ? <Check size={14} className="select-caret" /> : undefined}
              onClick={() => {
                setMenu(null)
                onChange(o.value)
              }}
            />
          ))}
        </Popover>
      )}
    </>
  )
}
