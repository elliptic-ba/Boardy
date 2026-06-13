// Shared types between main, preload and renderer.

export type PageKind = 'page' | 'database'

export interface Page {
  id: string
  parentId: string | null
  kind: PageKind
  title: string
  icon: string | null
  position: number
  trashedAt: number | null
  createdAt: number
  updatedAt: number
}

export interface PageWithContent extends Page {
  /** BlockNote document JSON (stringified) — null for never-edited pages */
  content: string | null
}

export type PropertyType =
  | 'text'
  | 'number'
  | 'select'
  | 'multi-select'
  | 'date'
  | 'checkbox'
  | 'url'

export interface SelectOption {
  id: string
  name: string
  color: string
}

export interface DbProperty {
  id: string
  databaseId: string
  name: string
  type: PropertyType
  /** select / multi-select options */
  options: SelectOption[]
  position: number
}

/** Row property values keyed by property id.
 *  text/url: string — number: number — select: option id — multi-select: option ids —
 *  date: ISO string — checkbox: boolean */
export type RowValues = Record<string, string | number | boolean | string[] | null>

export interface DbRow {
  id: string
  databaseId: string
  pageId: string
  values: RowValues
  position: number
  /** joined from the row's page */
  title: string
  icon: string | null
}

export type ViewType = 'table' | 'board' | 'list' | 'gallery'

export interface SortRule {
  propertyId: string | 'title'
  direction: 'asc' | 'desc'
}

export interface FilterRule {
  propertyId: string | 'title'
  operator: 'contains' | 'eq' | 'neq' | 'empty' | 'not-empty' | 'checked' | 'unchecked'
  value?: string | number
}

export interface ViewConfig {
  groupBy?: string
  sorts?: SortRule[]
  filters?: FilterRule[]
  hiddenProperties?: string[]
  /** board column order: option ids (and 'none') */
  columnOrder?: string[]
}

export interface DbView {
  id: string
  databaseId: string
  type: ViewType
  name: string
  config: ViewConfig
  position: number
}

export interface SearchResult {
  pageId: string
  title: string
  icon: string | null
  kind: PageKind
  snippet: string
}

export type AuthState = 'uninitialized' | 'locked' | 'unlocked'

export type ThemePref = 'light' | 'dark' | 'system'

export interface AppSettings {
  theme: ThemePref
  /** minutes; 0 = never */
  autoLockMinutes: number
}

export interface BreadcrumbItem {
  id: string
  title: string
  icon: string | null
}

export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  text: 'Text',
  number: 'Number',
  select: 'Select',
  'multi-select': 'Multi-select',
  date: 'Date',
  checkbox: 'Checkbox',
  url: 'URL'
}

export const SELECT_COLORS = [
  'gray',
  'brown',
  'orange',
  'yellow',
  'green',
  'blue',
  'purple',
  'pink',
  'red'
] as const
