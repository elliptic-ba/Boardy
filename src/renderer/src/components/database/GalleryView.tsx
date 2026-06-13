import { Plus } from 'lucide-react'
import { applyView } from './filters'
import { ValueDisplay } from './cells'
import type { ViewContext } from './DatabaseView'

export default function GalleryView({ ctx }: { ctx: ViewContext }): React.JSX.Element {
  const { data, config, visibleProps, openRow } = ctx
  const rows = applyView(data.rows, data.props, config)

  return (
    <div className="gallery">
      {rows.map((row) => (
        <div key={row.id} className="gallery-card" onClick={() => openRow(row.pageId)}>
          <div className="gallery-cover">{row.icon ?? '📄'}</div>
          <div className="gallery-card-body">
            <div className="card-title">
              {row.title || <span style={{ color: 'var(--text-tertiary)' }}>Untitled</span>}
            </div>
            <div className="card-props">
              {visibleProps.map((p) => (
                <ValueDisplay key={p.id} prop={p} values={row.values} />
              ))}
            </div>
          </div>
        </div>
      ))}
      <button
        className="gallery-card"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          minHeight: 160,
          color: 'var(--text-tertiary)',
          fontSize: 14
        }}
        onClick={() => void data.addRow()}
      >
        <Plus size={15} />
        New
      </button>
    </div>
  )
}
