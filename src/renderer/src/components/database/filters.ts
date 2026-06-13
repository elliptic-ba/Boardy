import type { DbProperty, DbRow, FilterRule, SortRule, ViewConfig } from '@shared/types'

function valueForCompare(row: DbRow, propertyId: string | 'title', props: DbProperty[]): unknown {
  if (propertyId === 'title') return row.title
  const prop = props.find((p) => p.id === propertyId)
  const raw = row.values[propertyId]
  if (!prop) return raw
  if (prop.type === 'select' && typeof raw === 'string') {
    return prop.options.find((o) => o.id === raw)?.name ?? ''
  }
  if (prop.type === 'multi-select' && Array.isArray(raw)) {
    return raw
      .map((id) => prop.options.find((o) => o.id === id)?.name ?? '')
      .filter(Boolean)
      .join(', ')
  }
  return raw
}

function isEmptyValue(v: unknown): boolean {
  return (
    v === null ||
    v === undefined ||
    v === '' ||
    (Array.isArray(v) && v.length === 0) ||
    v === false
  )
}

function matches(row: DbRow, rule: FilterRule, props: DbProperty[]): boolean {
  const v = valueForCompare(row, rule.propertyId, props)
  switch (rule.operator) {
    case 'contains':
      return String(v ?? '').toLowerCase().includes(String(rule.value ?? '').toLowerCase())
    case 'eq':
      return String(v ?? '').toLowerCase() === String(rule.value ?? '').toLowerCase()
    case 'neq':
      return String(v ?? '').toLowerCase() !== String(rule.value ?? '').toLowerCase()
    case 'empty':
      return isEmptyValue(v)
    case 'not-empty':
      return !isEmptyValue(v)
    case 'checked':
      return v === true
    case 'unchecked':
      return v !== true
    default:
      return true
  }
}

function compare(a: unknown, b: unknown): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b
  if (typeof a === 'boolean' || typeof b === 'boolean') {
    return Number(a === true) - Number(b === true)
  }
  const ea = isEmptyValue(a)
  const eb = isEmptyValue(b)
  if (ea && eb) return 0
  if (ea) return 1
  if (eb) return -1
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' })
}

export function applyView(rows: DbRow[], props: DbProperty[], config: ViewConfig): DbRow[] {
  let out = rows
  for (const rule of config.filters ?? []) {
    out = out.filter((r) => matches(r, rule, props))
  }
  const sorts: SortRule[] = config.sorts ?? []
  if (sorts.length > 0) {
    out = [...out].sort((a, b) => {
      for (const s of sorts) {
        const c = compare(
          valueForCompare(a, s.propertyId, props),
          valueForCompare(b, s.propertyId, props)
        )
        if (c !== 0) return s.direction === 'asc' ? c : -c
      }
      return a.position - b.position
    })
  }
  return out
}
