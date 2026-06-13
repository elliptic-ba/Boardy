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
  type DragOverEvent,
  type DragStartEvent
} from '@dnd-kit/core'
import { Plus } from 'lucide-react'
import type { DbProperty, DbRow, SelectOption } from '@shared/types'
import { applyView } from './filters'
import { Tag, ValueDisplay, nextSelectColor } from './cells'
import { randomId } from '../../lib/id'
import type { ViewContext } from './DatabaseView'
import { Select } from '../ui/Select'

const NONE = '__none__'

export default function BoardView({ ctx }: { ctx: ViewContext }): React.JSX.Element {
  const { data, config, setConfig, visibleProps } = ctx

  // pick the group-by property: configured one, else first select property
  const groupProp: DbProperty | undefined = useMemo(() => {
    const byId = data.props.find((p) => p.id === config.groupBy && p.type === 'select')
    return byId ?? data.props.find((p) => p.type === 'select')
  }, [data.props, config.groupBy])

  const rows = applyView(data.rows, data.props, config)
  const [draggingRow, setDraggingRow] = useState<DbRow | null>(null)
  const [overCol, setOverCol] = useState<string | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  if (!groupProp) {
    return (
      <div className="empty-state">
        <div className="big">📋</div>
        <div>Boards group cards by a Select property.</div>
        <button
          className="btn primary"
          style={{ marginTop: 8 }}
          onClick={() => {
            void data
              .addProp('Status', 'select')
              .then(() => data.reload())
          }}
        >
          Add a Status property
        </button>
      </div>
    )
  }

  const columns: { id: string; option: SelectOption | null; rows: DbRow[] }[] = [
    {
      id: NONE,
      option: null,
      rows: rows.filter((r) => {
        const v = r.values[groupProp.id]
        return !v || !groupProp.options.some((o) => o.id === v)
      })
    },
    ...groupProp.options.map((o) => ({
      id: o.id,
      option: o,
      rows: rows.filter((r) => r.values[groupProp.id] === o.id)
    }))
  ]

  const onDragStart = (e: DragStartEvent): void => {
    setDraggingRow(rows.find((r) => r.id === e.active.id) ?? null)
  }

  const onDragOver = (e: DragOverEvent): void => {
    setOverCol(e.over ? String(e.over.id).replace(/^col:/, '').replace(/^card:/, '') : null)
  }

  const onDragEnd = (e: DragEndEvent): void => {
    setDraggingRow(null)
    setOverCol(null)
    if (!e.over) return
    const rowId = String(e.active.id)
    const overId = String(e.over.id)

    if (overId.startsWith('col:')) {
      const colId = overId.slice(4)
      const value = colId === NONE ? null : colId
      void data.updateRowValues(rowId, { [groupProp.id]: value })
      const colRows = columns.find((c) => c.id === colId)?.rows ?? []
      const maxPos = colRows.reduce((m, r) => Math.max(m, r.position), 0)
      void data.moveRow(rowId, maxPos + 1)
    } else if (overId.startsWith('card:')) {
      const targetId = overId.slice(5)
      if (targetId === rowId) return
      const target = rows.find((r) => r.id === targetId)
      if (!target) return
      const targetCol = target.values[groupProp.id]
      const colValue =
        typeof targetCol === 'string' && groupProp.options.some((o) => o.id === targetCol)
          ? targetCol
          : null
      void data.updateRowValues(rowId, { [groupProp.id]: colValue })
      void data.moveRow(rowId, target.position - 0.5)
    }
  }

  const addColumn = async (): Promise<void> => {
    const name = `Option ${groupProp.options.length + 1}`
    const option: SelectOption = {
      id: randomId(),
      name,
      color: nextSelectColor(groupProp.options)
    }
    await data.updateProp(groupProp.id, { options: [...groupProp.options, option] })
  }

  const cardProps = visibleProps.filter((p) => p.id !== groupProp.id)

  return (
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
    >
      <div className="board">
        {columns.map((col) => (
          <BoardColumn
            key={col.id}
            col={col}
            groupProp={groupProp}
            cardProps={cardProps}
            ctx={ctx}
            isOver={overCol === col.id || col.rows.some((r) => r.id === overCol)}
          />
        ))}
        <div className="board-col" style={{ width: 180, minWidth: 180 }}>
          <button className="board-add-card" onClick={() => void addColumn()}>
            <Plus size={15} />
            Add group
          </button>
        </div>
      </div>
      <DragOverlay>
        {draggingRow && (
          <div className="board-card card-drag-overlay">
            <div className="card-title">
              {draggingRow.icon && <span>{draggingRow.icon}</span>}
              {draggingRow.title || 'Untitled'}
            </div>
          </div>
        )}
      </DragOverlay>
      {/* group-by selector */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', paddingBottom: 16 }}>
        <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Grouped by</span>
        <Select<string>
          value={groupProp.id}
          style={{ fontSize: 13, padding: '2px 6px' }}
          options={data.props
            .filter((p) => p.type === 'select')
            .map((p) => ({ value: p.id, label: p.name }))}
          onChange={(v) => setConfig({ groupBy: v })}
        />
      </div>
    </DndContext>
  )
}

function BoardColumn({
  col,
  groupProp,
  cardProps,
  ctx,
  isOver
}: {
  col: { id: string; option: SelectOption | null; rows: DbRow[] }
  groupProp: DbProperty
  cardProps: DbProperty[]
  ctx: ViewContext
  isOver: boolean
}): React.JSX.Element {
  const { setNodeRef } = useDroppable({ id: `col:${col.id}` })
  const { data } = ctx

  const addCard = (): void => {
    const values = col.id === NONE ? {} : { [groupProp.id]: col.id }
    void data.addRow(values)
  }

  return (
    <div className="board-col">
      <div className="board-col-header">
        {col.option ? (
          <Tag option={col.option} />
        ) : (
          <span className="tag gray">No {groupProp.name.toLowerCase()}</span>
        )}
        <span className="count">{col.rows.length}</span>
        <button className="icon-btn" title="Add a card" onClick={addCard}>
          <Plus size={14} />
        </button>
      </div>
      <div ref={setNodeRef} className={`board-col-cards${isOver ? ' drag-over' : ''}`}>
        {col.rows.map((row) => (
          <BoardCard key={row.id} row={row} cardProps={cardProps} ctx={ctx} />
        ))}
      </div>
      <button className="board-add-card" onClick={addCard}>
        <Plus size={15} />
        New
      </button>
    </div>
  )
}

function BoardCard({
  row,
  cardProps,
  ctx
}: {
  row: DbRow
  cardProps: DbProperty[]
  ctx: ViewContext
}): React.JSX.Element {
  const drag = useDraggable({ id: row.id })
  const drop = useDroppable({ id: `card:${row.id}` })

  return (
    <div
      ref={(el) => {
        drag.setNodeRef(el)
        drop.setNodeRef(el)
      }}
      {...drag.attributes}
      {...drag.listeners}
      className={`board-card${drag.isDragging ? ' dragging' : ''}`}
      onClick={() => ctx.openRow(row.pageId)}
    >
      <div className="card-title">
        {row.icon && <span>{row.icon}</span>}
        <span>{row.title || <span style={{ color: 'var(--text-tertiary)' }}>Untitled</span>}</span>
      </div>
      {cardProps.some((p) => {
        const v = row.values[p.id]
        return v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && !v.length)
      }) && (
        <div className="card-props">
          {cardProps.map((p) => (
            <ValueDisplay key={p.id} prop={p} values={row.values} />
          ))}
        </div>
      )}
    </div>
  )
}
