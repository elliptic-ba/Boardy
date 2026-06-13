import { useEffect, useMemo, useState } from 'react'
import {
  ArrowUpDown,
  Eye,
  Filter,
  Image,
  Kanban,
  List,
  Plus,
  Table2,
  Trash2,
  X
} from 'lucide-react'
import { randomId } from '../../lib/id'
import type {
  DbProperty,
  FilterRule,
  SelectOption,
  ViewConfig,
  ViewType
} from '@shared/types'
import { useStore } from '../../store'
import { useDatabase, type DatabaseData } from './useDatabase'
import { nextSelectColor } from './cells'
import { Popover, MenuItem, MenuLabel, MenuSeparator, anchorFromPointer, type Anchor } from '../ui/Menu'
import { Select } from '../ui/Select'
import TableView from './TableView'
import BoardView from './BoardView'
import ListView from './ListView'
import GalleryView from './GalleryView'

export const VIEW_ICONS: Record<ViewType, React.ComponentType<{ size?: number | string }>> = {
  table: Table2,
  board: Kanban,
  list: List,
  gallery: Image
}

export interface ViewContext {
  data: DatabaseData
  config: ViewConfig
  setConfig: (patch: Partial<ViewConfig>) => void
  visibleProps: DbProperty[]
  openRow: (pageId: string) => void
  createOption: (propId: string, name: string) => Promise<SelectOption>
}

export default function DatabaseView({
  databaseId,
  theme
}: {
  databaseId: string
  theme: 'light' | 'dark'
}): React.JSX.Element {
  void theme
  const data = useDatabase(databaseId)
  const openPage = useStore((s) => s.openPage)

  const [activeViewId, setActiveViewId] = useState<string | null>(
    () => localStorage.getItem(`boardy.view.${databaseId}`)
  )
  const [addViewAnchor, setAddViewAnchor] = useState<Anchor | null>(null)
  const [tabMenu, setTabMenu] = useState<{ anchor: Anchor; viewId: string } | null>(null)
  const [renameViewId, setRenameViewId] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  const [filterAnchor, setFilterAnchor] = useState<Anchor | null>(null)
  const [sortAnchor, setSortAnchor] = useState<Anchor | null>(null)
  const [propsAnchor, setPropsAnchor] = useState<Anchor | null>(null)

  const view = useMemo(() => {
    const found = data.views.find((v) => v.id === activeViewId)
    return found ?? data.views[0] ?? null
  }, [data.views, activeViewId])

  useEffect(() => {
    if (view) localStorage.setItem(`boardy.view.${databaseId}`, view.id)
  }, [view, databaseId])

  if (data.loading) return <div style={{ minHeight: 200 }} />

  const config = view?.config ?? {}

  const setConfig = (patch: Partial<ViewConfig>): void => {
    if (!view) return
    void data.updateView(view.id, { config: { ...config, ...patch } })
  }

  const visibleProps = data.props.filter((p) => !(config.hiddenProperties ?? []).includes(p.id))

  const createOption = async (propId: string, name: string): Promise<SelectOption> => {
    const prop = data.props.find((p) => p.id === propId)
    if (!prop) throw new Error('Property not found')
    const option: SelectOption = { id: randomId(), name, color: nextSelectColor(prop.options) }
    await data.updateProp(propId, { options: [...prop.options, option] })
    return option
  }

  const ctx: ViewContext = {
    data,
    config,
    setConfig,
    visibleProps,
    openRow: (pageId) => openPage(pageId),
    createOption
  }

  const addView = async (type: ViewType): Promise<void> => {
    setAddViewAnchor(null)
    const names: Record<ViewType, string> = {
      table: 'Table',
      board: 'Board',
      list: 'List',
      gallery: 'Gallery'
    }
    const v = await data.addView(type, names[type])
    setActiveViewId(v.id)
  }

  const filterCount = (config.filters ?? []).length
  const hasSort = (config.sorts ?? []).length > 0

  return (
    <div>
      <div className="view-tabs">
        {data.views.map((v) => {
          const Icon = VIEW_ICONS[v.type]
          return renameViewId === v.id ? (
            <input
              key={v.id}
              className="text-input"
              style={{ width: 130, padding: '2px 6px', margin: '2px 0' }}
              autoFocus
              value={renameDraft}
              onChange={(e) => setRenameDraft(e.target.value)}
              onBlur={() => {
                setRenameViewId(null)
                if (renameDraft.trim()) void data.updateView(v.id, { name: renameDraft.trim() })
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                if (e.key === 'Escape') setRenameViewId(null)
              }}
            />
          ) : (
            <button
              key={v.id}
              className={`view-tab${view?.id === v.id ? ' active' : ''}`}
              onClick={() => setActiveViewId(v.id)}
              onContextMenu={(e) => {
                e.preventDefault()
                setTabMenu({ anchor: anchorFromPointer(e), viewId: v.id })
              }}
              onDoubleClick={() => {
                setRenameDraft(v.name)
                setRenameViewId(v.id)
              }}
            >
              <Icon size={15} />
              {v.name}
            </button>
          )
        })}
        <button className="view-tab" onClick={(e) => setAddViewAnchor(anchorFromPointer(e))}>
          <Plus size={15} />
        </button>

        <div className="view-toolbar">
          <button
            className="btn"
            style={filterCount ? { color: 'var(--accent-text)' } : undefined}
            onClick={(e) => setFilterAnchor(anchorFromPointer(e))}
          >
            <Filter size={15} />
            {filterCount ? `Filter (${filterCount})` : 'Filter'}
          </button>
          <button
            className="btn"
            style={hasSort ? { color: 'var(--accent-text)' } : undefined}
            onClick={(e) => setSortAnchor(anchorFromPointer(e))}
          >
            <ArrowUpDown size={15} />
            Sort
          </button>
          <button className="btn" onClick={(e) => setPropsAnchor(anchorFromPointer(e))}>
            <Eye size={15} />
            Properties
          </button>
          <button className="btn primary" onClick={() => void data.addRow()}>
            New
          </button>
        </div>
      </div>

      {view?.type === 'table' && <TableView ctx={ctx} />}
      {view?.type === 'board' && <BoardView ctx={ctx} />}
      {view?.type === 'list' && <ListView ctx={ctx} />}
      {view?.type === 'gallery' && <GalleryView ctx={ctx} />}
      {!view && (
        <div className="empty-state">
          <div>No views — add one above.</div>
        </div>
      )}

      {addViewAnchor && (
        <Popover anchor={addViewAnchor} onClose={() => setAddViewAnchor(null)}>
          <MenuLabel>Add a view</MenuLabel>
          <MenuItem icon={<Table2 size={15} />} label="Table" onClick={() => void addView('table')} />
          <MenuItem icon={<Kanban size={15} />} label="Board" onClick={() => void addView('board')} />
          <MenuItem icon={<List size={15} />} label="List" onClick={() => void addView('list')} />
          <MenuItem icon={<Image size={15} />} label="Gallery" onClick={() => void addView('gallery')} />
        </Popover>
      )}

      {tabMenu && (
        <Popover anchor={tabMenu.anchor} onClose={() => setTabMenu(null)}>
          <MenuItem
            label="Rename"
            onClick={() => {
              const v = data.views.find((x) => x.id === tabMenu.viewId)
              setRenameDraft(v?.name ?? '')
              setRenameViewId(tabMenu.viewId)
              setTabMenu(null)
            }}
          />
          {data.views.length > 1 && (
            <MenuItem
              icon={<Trash2 size={15} />}
              label="Delete view"
              danger
              onClick={() => {
                void data.deleteView(tabMenu.viewId)
                setTabMenu(null)
              }}
            />
          )}
        </Popover>
      )}

      {filterAnchor && (
        <FilterMenu
          anchor={filterAnchor}
          onClose={() => setFilterAnchor(null)}
          props={data.props}
          filters={config.filters ?? []}
          onChange={(filters) => setConfig({ filters })}
        />
      )}

      {sortAnchor && (
        <SortMenu
          anchor={sortAnchor}
          onClose={() => setSortAnchor(null)}
          props={data.props}
          config={config}
          onChange={(sorts) => setConfig({ sorts })}
        />
      )}

      {propsAnchor && (
        <Popover anchor={propsAnchor} onClose={() => setPropsAnchor(null)}>
          <MenuLabel>Shown properties</MenuLabel>
          {data.props.map((p) => {
            const hidden = (config.hiddenProperties ?? []).includes(p.id)
            return (
              <button
                key={p.id}
                className="menu-item"
                onClick={() => {
                  const cur = config.hiddenProperties ?? []
                  setConfig({
                    hiddenProperties: hidden ? cur.filter((x) => x !== p.id) : [...cur, p.id]
                  })
                }}
              >
                <span style={{ flex: 1 }}>{p.name}</span>
                <input type="checkbox" checked={!hidden} readOnly />
              </button>
            )
          })}
          {data.props.length === 0 && <div className="search-empty">No properties yet</div>}
        </Popover>
      )}
    </div>
  )
}

function FilterMenu({
  anchor,
  onClose,
  props,
  filters,
  onChange
}: {
  anchor: Anchor
  onClose: () => void
  props: DbProperty[]
  filters: FilterRule[]
  onChange: (filters: FilterRule[]) => void
}): React.JSX.Element {
  const fields: { id: string | 'title'; name: string }[] = [
    { id: 'title', name: 'Name' },
    ...props.map((p) => ({ id: p.id, name: p.name }))
  ]

  const operatorsFor = (fieldId: string | 'title'): FilterRule['operator'][] => {
    const prop = props.find((p) => p.id === fieldId)
    if (prop?.type === 'checkbox') return ['checked', 'unchecked']
    return ['contains', 'eq', 'neq', 'empty', 'not-empty']
  }

  const OP_LABELS: Record<FilterRule['operator'], string> = {
    contains: 'contains',
    eq: 'is',
    neq: 'is not',
    empty: 'is empty',
    'not-empty': 'is not empty',
    checked: 'is checked',
    unchecked: 'is unchecked'
  }

  const update = (i: number, patch: Partial<FilterRule>): void => {
    onChange(filters.map((f, j) => (j === i ? { ...f, ...patch } : f)))
  }

  return (
    <Popover anchor={anchor} onClose={onClose} width={320}>
      <MenuLabel>Filters</MenuLabel>
      {filters.map((f, i) => (
        <div key={i} style={{ display: 'flex', gap: 4, padding: '2px 4px', alignItems: 'center' }}>
          <Select<string>
            value={f.propertyId}
            style={{ flex: 1, minWidth: 0 }}
            options={fields.map((fl) => ({ value: fl.id, label: fl.name }))}
            onChange={(v) => {
              const pid = v as FilterRule['propertyId']
              update(i, { propertyId: pid, operator: operatorsFor(pid)[0] })
            }}
          />
          <Select<FilterRule['operator']>
            value={f.operator}
            style={{ flex: 1, minWidth: 0 }}
            options={operatorsFor(f.propertyId).map((op) => ({ value: op, label: OP_LABELS[op] }))}
            onChange={(op) => update(i, { operator: op })}
          />
          {['contains', 'eq', 'neq'].includes(f.operator) && (
            <input
              className="text-input"
              style={{ flex: 1, minWidth: 0, padding: '3px 6px' }}
              value={String(f.value ?? '')}
              onChange={(e) => update(i, { value: e.target.value })}
            />
          )}
          <button className="icon-btn" onClick={() => onChange(filters.filter((_, j) => j !== i))}>
            <X size={14} />
          </button>
        </div>
      ))}
      <MenuSeparator />
      <MenuItem
        icon={<Plus size={15} />}
        label="Add filter"
        onClick={() => onChange([...filters, { propertyId: 'title', operator: 'contains', value: '' }])}
      />
      {filters.length > 0 && (
        <MenuItem icon={<X size={15} />} label="Clear all" onClick={() => onChange([])} />
      )}
    </Popover>
  )
}

function SortMenu({
  anchor,
  onClose,
  props,
  config,
  onChange
}: {
  anchor: Anchor
  onClose: () => void
  props: DbProperty[]
  config: ViewConfig
  onChange: (sorts: ViewConfig['sorts']) => void
}): React.JSX.Element {
  const sort = (config.sorts ?? [])[0]
  const fields: { id: string | 'title'; name: string }[] = [
    { id: 'title', name: 'Name' },
    ...props.map((p) => ({ id: p.id, name: p.name }))
  ]
  return (
    <Popover anchor={anchor} onClose={onClose} width={280}>
      <MenuLabel>Sort by</MenuLabel>
      <div style={{ display: 'flex', gap: 4, padding: '2px 4px' }}>
        <Select<string>
          value={sort?.propertyId ?? ''}
          style={{ flex: 1 }}
          options={[{ value: '', label: 'None' }, ...fields.map((f) => ({ value: f.id, label: f.name }))]}
          onChange={(v) =>
            onChange(v ? [{ propertyId: v, direction: sort?.direction ?? 'asc' }] : [])
          }
        />
        <Select<'asc' | 'desc'>
          value={sort?.direction ?? 'asc'}
          disabled={!sort}
          options={[
            { value: 'asc', label: 'Ascending' },
            { value: 'desc', label: 'Descending' }
          ]}
          onChange={(d) => sort && onChange([{ ...sort, direction: d }])}
        />
      </div>
    </Popover>
  )
}
