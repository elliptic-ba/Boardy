import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useDatabase } from './useDatabase'
import { ValueCell, nextSelectColor } from './cells'
import { AddPropertyMenu, PROP_TYPE_ICONS } from './TableView'
import { randomId } from '../../lib/id'
import type { SelectOption } from '@shared/types'
import { anchorFromPointer, type Anchor } from '../ui/Menu'

/** Property editors shown at the top of a page that is a database row. */
export default function RowPropsPanel({
  databaseId,
  pageId
}: {
  databaseId: string
  pageId: string
}): React.JSX.Element | null {
  const data = useDatabase(databaseId)
  const [addAnchor, setAddAnchor] = useState<Anchor | null>(null)
  const row = data.rows.find((r) => r.pageId === pageId)

  if (data.loading || !row) return null

  const createOption = async (propId: string, name: string): Promise<SelectOption> => {
    const prop = data.props.find((p) => p.id === propId)
    if (!prop) throw new Error('Property not found')
    const option: SelectOption = { id: randomId(), name, color: nextSelectColor(prop.options) }
    await data.updateProp(propId, { options: [...prop.options, option] })
    return option
  }

  return (
    <div className="props-panel">
      {data.props.map((p) => {
        const Icon = PROP_TYPE_ICONS[p.type]
        return (
          <div key={p.id} className="prop-row">
            <div className="prop-name">
              <Icon size={15} />
              {p.name}
            </div>
            <div className="prop-value">
              <ValueCell
                prop={p}
                row={row}
                onChange={(patch) => void data.updateRowValues(row.id, patch)}
                onCreateOption={createOption}
              />
            </div>
          </div>
        )
      })}
      <button
        className="btn"
        style={{ alignSelf: 'flex-start', color: 'var(--text-tertiary)' }}
        onClick={(e) => setAddAnchor(anchorFromPointer(e))}
      >
        <Plus size={14} />
        Add a property
      </button>
      {addAnchor && (
        <AddPropertyMenu
          anchor={addAnchor}
          onClose={() => setAddAnchor(null)}
          onAdd={(name, type) => void data.addProp(name, type)}
        />
      )}
    </div>
  )
}
