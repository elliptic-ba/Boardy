import { useEffect, useRef, useState } from 'react'
import { Check, Plus, X } from 'lucide-react'
import type { DbProperty, DbRow, RowValues, SelectOption } from '@shared/types'
import { SELECT_COLORS } from '@shared/types'
import { Popover, MenuLabel, type Anchor } from '../ui/Menu'

export function Tag({ option }: { option: SelectOption }): React.JSX.Element {
  return <span className={`tag ${option.color}`}>{option.name}</span>
}

export function formatDate(iso: string): string {
  const d = new Date(iso + (iso.length === 10 ? 'T00:00:00' : ''))
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

/** Read-only rendering of a property value (cards, lists, galleries). */
export function ValueDisplay({
  prop,
  values
}: {
  prop: DbProperty
  values: RowValues
}): React.JSX.Element | null {
  const v = values[prop.id]
  if (v === null || v === undefined || v === '') return null
  switch (prop.type) {
    case 'select': {
      const opt = prop.options.find((o) => o.id === v)
      return opt ? <Tag option={opt} /> : null
    }
    case 'multi-select': {
      const ids = Array.isArray(v) ? v : []
      const opts = ids
        .map((id) => prop.options.find((o) => o.id === id))
        .filter((o): o is SelectOption => !!o)
      if (!opts.length) return null
      return (
        <span style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap' }}>
          {opts.map((o) => (
            <Tag key={o.id} option={o} />
          ))}
        </span>
      )
    }
    case 'checkbox':
      return (
        <input type="checkbox" checked={v === true} readOnly style={{ pointerEvents: 'none' }} />
      )
    case 'date':
      return <span style={{ fontSize: 13 }}>{formatDate(String(v))}</span>
    case 'url':
      return (
        <span style={{ fontSize: 13, textDecoration: 'underline', color: 'var(--accent-text)' }}>
          {String(v)}
        </span>
      )
    default:
      return <span style={{ fontSize: 13 }}>{String(v)}</span>
  }
}

/** Editable cell used by the table view and the row property panel. */
export function ValueCell({
  prop,
  row,
  onChange,
  onCreateOption
}: {
  prop: DbProperty
  row: DbRow
  onChange: (patch: RowValues) => void
  onCreateOption: (propId: string, name: string) => Promise<SelectOption>
}): React.JSX.Element {
  const v = row.values[prop.id]
  const [editing, setEditing] = useState(false)
  const [anchor, setAnchor] = useState<Anchor | null>(null)
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  const commitText = (): void => {
    setEditing(false)
    if (prop.type === 'number') {
      const n = draft.trim() === '' ? null : Number(draft)
      onChange({ [prop.id]: n === null || Number.isNaN(n) ? null : n })
    } else {
      onChange({ [prop.id]: draft })
    }
  }

  if (prop.type === 'checkbox') {
    return (
      <div className="cell" onClick={() => onChange({ [prop.id]: v !== true })}>
        <input type="checkbox" checked={v === true} readOnly style={{ pointerEvents: 'none' }} />
      </div>
    )
  }

  if (prop.type === 'date') {
    if (editing) {
      return (
        <input
          ref={inputRef}
          className="cell-input"
          type="date"
          defaultValue={typeof v === 'string' ? v.slice(0, 10) : ''}
          onBlur={(e) => {
            setEditing(false)
            onChange({ [prop.id]: e.target.value || null })
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
            if (e.key === 'Escape') setEditing(false)
          }}
        />
      )
    }
    return (
      <div className="cell" onClick={() => setEditing(true)}>
        {typeof v === 'string' && v ? formatDate(v) : ''}
      </div>
    )
  }

  if (prop.type === 'select' || prop.type === 'multi-select') {
    return (
      <>
        <div
          className="cell"
          onClick={(e) => setAnchor({ x: e.clientX - 8, y: e.clientY + 12 })}
        >
          <ValueDisplay prop={prop} values={row.values} />
        </div>
        {anchor && (
          <SelectEditor
            prop={prop}
            value={v}
            anchor={anchor}
            onClose={() => setAnchor(null)}
            onChange={(nv) => onChange({ [prop.id]: nv })}
            onCreateOption={onCreateOption}
          />
        )}
      </>
    )
  }

  // text / number / url
  if (editing) {
    return (
      <input
        ref={inputRef}
        className="cell-input"
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commitText}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commitText()
          if (e.key === 'Escape') setEditing(false)
        }}
      />
    )
  }
  return (
    <div
      className="cell"
      onClick={() => {
        setDraft(v === null || v === undefined ? '' : String(v))
        setEditing(true)
      }}
    >
      <ValueDisplay prop={prop} values={row.values} />
    </div>
  )
}

/** Dropdown for select / multi-select values with option creation. */
export function SelectEditor({
  prop,
  value,
  anchor,
  onClose,
  onChange,
  onCreateOption
}: {
  prop: DbProperty
  value: RowValues[string]
  anchor: Anchor
  onClose: () => void
  onChange: (v: string | string[] | null) => void
  onCreateOption: (propId: string, name: string) => Promise<SelectOption>
}): React.JSX.Element {
  const [query, setQuery] = useState('')
  const multi = prop.type === 'multi-select'
  const selectedIds: string[] = multi
    ? Array.isArray(value)
      ? value
      : []
    : typeof value === 'string' && value
      ? [value]
      : []

  const filtered = prop.options.filter((o) =>
    o.name.toLowerCase().includes(query.trim().toLowerCase())
  )
  const exact = prop.options.some((o) => o.name.toLowerCase() === query.trim().toLowerCase())

  const toggle = (optionId: string): void => {
    if (multi) {
      const next = selectedIds.includes(optionId)
        ? selectedIds.filter((x) => x !== optionId)
        : [...selectedIds, optionId]
      onChange(next)
    } else {
      onChange(selectedIds.includes(optionId) ? null : optionId)
      onClose()
    }
  }

  const create = async (): Promise<void> => {
    const name = query.trim()
    if (!name) return
    const opt = await onCreateOption(prop.id, name)
    setQuery('')
    if (multi) onChange([...selectedIds, opt.id])
    else {
      onChange(opt.id)
      onClose()
    }
  }

  return (
    <Popover anchor={anchor} onClose={onClose} width={260}>
      <div style={{ padding: '2px 4px 6px' }}>
        <input
          className="text-input"
          autoFocus
          placeholder="Search or create…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && query.trim() && !exact) void create()
          }}
        />
      </div>
      <MenuLabel>Select an option{multi ? 's' : ''}</MenuLabel>
      {filtered.map((o) => (
        <button key={o.id} className="menu-item" onClick={() => toggle(o.id)}>
          <Tag option={o} />
          <span style={{ flex: 1 }} />
          {selectedIds.includes(o.id) && <Check size={14} />}
        </button>
      ))}
      {query.trim() && !exact && (
        <button className="menu-item" onClick={() => void create()}>
          <span className="menu-icon">
            <Plus size={14} />
          </span>
          Create “{query.trim()}”
        </button>
      )}
      {selectedIds.length > 0 && (
        <button
          className="menu-item"
          onClick={() => {
            onChange(multi ? [] : null)
            if (!multi) onClose()
          }}
        >
          <span className="menu-icon">
            <X size={14} />
          </span>
          Clear
        </button>
      )}
    </Popover>
  )
}

export function nextSelectColor(options: SelectOption[]): string {
  return SELECT_COLORS[options.length % SELECT_COLORS.length]
}
