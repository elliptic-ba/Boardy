import { Plus } from 'lucide-react'
import { applyView } from './filters'
import { ValueDisplay } from './cells'
import type { ViewContext } from './DatabaseView'

export default function ListView({ ctx }: { ctx: ViewContext }): React.JSX.Element {
  const { data, config, visibleProps, openRow } = ctx
  const rows = applyView(data.rows, data.props, config)

  return (
    <div className="list-view">
      {rows.map((row) => (
        <div key={row.id} className="list-item" onClick={() => openRow(row.pageId)}>
          <span className="list-title">
            {row.icon && <span>{row.icon}</span>}
            <span>
              {row.title || <span style={{ color: 'var(--text-tertiary)' }}>Untitled</span>}
            </span>
          </span>
          <span className="list-props">
            {visibleProps.map((p) => (
              <ValueDisplay key={p.id} prop={p} values={row.values} />
            ))}
          </span>
        </div>
      ))}
      <button className="add-row-btn" style={{ borderBottom: 'none' }} onClick={() => void data.addRow()}>
        <Plus size={15} />
        New
      </button>
    </div>
  )
}
