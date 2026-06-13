import { useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  CheckSquare,
  Calendar,
  ChevronDown,
  Hash,
  Link2,
  List,
  Plus,
  Tag as TagIcon,
  Text,
  Trash2,
  ArrowUpRight
} from 'lucide-react'
import type { DbProperty, DbRow, PropertyType } from '@shared/types'
import { PROPERTY_TYPE_LABELS } from '@shared/types'
import { applyView } from './filters'
import { ValueCell } from './cells'
import { Popover, MenuItem, MenuLabel, MenuSeparator, anchorFromPointer, type Anchor } from '../ui/Menu'
import type { ViewContext } from './DatabaseView'

export const PROP_TYPE_ICONS: Record<PropertyType, React.ComponentType<{ size?: number | string }>> = {
  text: Text,
  number: Hash,
  select: ChevronDown,
  'multi-select': List,
  date: Calendar,
  checkbox: CheckSquare,
  url: Link2
}

export default function TableView({ ctx }: { ctx: ViewContext }): React.JSX.Element {
  const { data, config, setConfig, visibleProps, openRow, createOption } = ctx
  const rows = applyView(data.rows, data.props, config)
  const [headerMenu, setHeaderMenu] = useState<{ anchor: Anchor; propId: string } | null>(null)
  const [addPropAnchor, setAddPropAnchor] = useState<Anchor | null>(null)
  const [rowMenu, setRowMenu] = useState<{ anchor: Anchor; rowId: string } | null>(null)

  return (
    <div className="table-wrap">
      <table className="db-table">
        <thead>
          <tr>
            <th>
              <div className="th-inner">
                <Text size={14} />
                Name
              </div>
            </th>
            {visibleProps.map((p) => {
              const Icon = PROP_TYPE_ICONS[p.type]
              return (
                <th key={p.id}>
                  <button
                    className="th-inner"
                    onClick={(e) => setHeaderMenu({ anchor: anchorFromPointer(e), propId: p.id })}
                  >
                    <Icon size={14} />
                    {p.name}
                  </button>
                </th>
              )
            })}
            <th style={{ minWidth: 40 }}>
              <button
                className="th-inner"
                title="Add a property"
                onClick={(e) => setAddPropAnchor(anchorFromPointer(e))}
              >
                <Plus size={14} />
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <TableRow
              key={row.id}
              row={row}
              props={visibleProps}
              ctx={ctx}
              onOpen={() => openRow(row.pageId)}
              onMenu={(anchor) => setRowMenu({ anchor, rowId: row.id })}
              createOption={createOption}
            />
          ))}
        </tbody>
      </table>
      <button className="add-row-btn" onClick={() => void data.addRow()}>
        <Plus size={15} />
        New
      </button>

      {headerMenu && (
        <PropertyMenu
          anchor={headerMenu.anchor}
          prop={data.props.find((p) => p.id === headerMenu.propId)!}
          ctx={ctx}
          onClose={() => setHeaderMenu(null)}
        />
      )}

      {addPropAnchor && (
        <AddPropertyMenu
          anchor={addPropAnchor}
          onClose={() => setAddPropAnchor(null)}
          onAdd={(name, type) => void data.addProp(name, type)}
        />
      )}

      {rowMenu && (
        <Popover anchor={rowMenu.anchor} onClose={() => setRowMenu(null)}>
          <MenuItem
            icon={<ArrowUpRight size={15} />}
            label="Open"
            onClick={() => {
              const r = data.rows.find((x) => x.id === rowMenu.rowId)
              setRowMenu(null)
              if (r) openRow(r.pageId)
            }}
          />
          <MenuItem
            icon={<Trash2 size={15} />}
            label="Delete"
            danger
            onClick={() => {
              void data.deleteRow(rowMenu.rowId)
              setRowMenu(null)
            }}
          />
        </Popover>
      )}
    </div>
  )
}

function TableRow({
  row,
  props,
  ctx,
  onOpen,
  onMenu,
  createOption
}: {
  row: DbRow
  props: DbProperty[]
  ctx: ViewContext
  onOpen: () => void
  onMenu: (anchor: Anchor) => void
  createOption: ViewContext['createOption']
}): React.JSX.Element {
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState(row.title)

  return (
    <tr
      onContextMenu={(e) => {
        e.preventDefault()
        onMenu(anchorFromPointer(e))
      }}
    >
      <td>
        {editingTitle ? (
          <input
            className="cell-input"
            autoFocus
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={() => {
              setEditingTitle(false)
              void ctx.data.updateRowTitle(row.id, row.pageId, titleDraft)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
              if (e.key === 'Escape') setEditingTitle(false)
            }}
          />
        ) : (
          <div
            className="cell title-cell"
            onClick={() => {
              setTitleDraft(row.title)
              setEditingTitle(true)
            }}
          >
            {row.icon && <span>{row.icon}</span>}
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {row.title || <span style={{ color: 'var(--text-tertiary)' }}>Untitled</span>}
            </span>
            <button
              className="open-btn"
              onClick={(e) => {
                e.stopPropagation()
                onOpen()
              }}
            >
              <ArrowUpRight size={12} />
              Open
            </button>
          </div>
        )}
      </td>
      {props.map((p) => (
        <td key={p.id}>
          <ValueCell
            prop={p}
            row={row}
            onChange={(patch) => void ctx.data.updateRowValues(row.id, patch)}
            onCreateOption={createOption}
          />
        </td>
      ))}
      <td />
    </tr>
  )
}

export function AddPropertyMenu({
  anchor,
  onClose,
  onAdd
}: {
  anchor: Anchor
  onClose: () => void
  onAdd: (name: string, type: PropertyType) => void
}): React.JSX.Element {
  const [name, setName] = useState('')
  return (
    <Popover anchor={anchor} onClose={onClose} width={240}>
      <div style={{ padding: '2px 4px 6px' }}>
        <input
          className="text-input"
          autoFocus
          placeholder="Property name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <MenuLabel>Type</MenuLabel>
      {(Object.keys(PROPERTY_TYPE_LABELS) as PropertyType[]).map((t) => {
        const Icon = PROP_TYPE_ICONS[t]
        return (
          <MenuItem
            key={t}
            icon={<Icon size={15} />}
            label={PROPERTY_TYPE_LABELS[t]}
            onClick={() => {
              onAdd(name.trim() || PROPERTY_TYPE_LABELS[t], t)
              onClose()
            }}
          />
        )
      })}
    </Popover>
  )
}

export function PropertyMenu({
  anchor,
  prop,
  ctx,
  onClose
}: {
  anchor: Anchor
  prop: DbProperty
  ctx: ViewContext
  onClose: () => void
}): React.JSX.Element {
  const { data, config, setConfig } = ctx
  const [name, setName] = useState(prop.name)
  const [typeOpen, setTypeOpen] = useState(false)

  const commitName = (): void => {
    if (name.trim() && name !== prop.name) void data.updateProp(prop.id, { name: name.trim() })
  }

  const TypeIcon = PROP_TYPE_ICONS[prop.type]

  return (
    <Popover anchor={anchor} onClose={onClose} width={260}>
      <div style={{ padding: '2px 4px 6px' }}>
        <input
          className="text-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              commitName()
              onClose()
            }
          }}
        />
      </div>
      <MenuItem
        icon={<TypeIcon size={15} />}
        label={`Type: ${PROPERTY_TYPE_LABELS[prop.type]}`}
        trailing={<ChevronDown size={14} />}
        onClick={() => setTypeOpen((v) => !v)}
      />
      {typeOpen &&
        (Object.keys(PROPERTY_TYPE_LABELS) as PropertyType[]).map((t) => {
          const Icon = PROP_TYPE_ICONS[t]
          return (
            <button
              key={t}
              className="menu-item"
              style={{ paddingLeft: 24 }}
              onClick={() => {
                void data.updateProp(prop.id, { type: t })
                setTypeOpen(false)
              }}
            >
              <span className="menu-icon">
                <Icon size={15} />
              </span>
              {PROPERTY_TYPE_LABELS[t]}
            </button>
          )
        })}
      <MenuSeparator />
      <MenuItem
        icon={<ArrowUp size={15} />}
        label="Sort ascending"
        onClick={() => {
          setConfig({ sorts: [{ propertyId: prop.id, direction: 'asc' }] })
          onClose()
        }}
      />
      <MenuItem
        icon={<ArrowDown size={15} />}
        label="Sort descending"
        onClick={() => {
          setConfig({ sorts: [{ propertyId: prop.id, direction: 'desc' }] })
          onClose()
        }}
      />
      {(config.sorts ?? []).some((s) => s.propertyId === prop.id) && (
        <MenuItem
          icon={<TagIcon size={15} />}
          label="Clear sort"
          onClick={() => {
            setConfig({ sorts: [] })
            onClose()
          }}
        />
      )}
      <MenuSeparator />
      <MenuItem
        icon={<Trash2 size={15} />}
        label="Delete property"
        danger
        onClick={() => {
          void data.deleteProp(prop.id)
          onClose()
        }}
      />
    </Popover>
  )
}
