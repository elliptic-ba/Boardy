import { randomUUID } from 'crypto'
import { getDb } from './db'
import type {
  BreadcrumbItem,
  DbProperty,
  DbRow,
  DbView,
  Page,
  PageKind,
  PageWithContent,
  PropertyType,
  RowValues,
  SearchResult,
  SelectOption,
  ViewConfig,
  ViewType
} from '../shared/types'

const now = (): number => Date.now()
const id = (): string => randomUUID()

// ---------- row mapping ----------

interface PageRow {
  id: string
  parent_id: string | null
  kind: PageKind
  title: string
  icon: string | null
  position: number
  trashed_at: number | null
  created_at: number
  updated_at: number
  content?: string | null
}

function toPage(r: PageRow): Page {
  return {
    id: r.id,
    parentId: r.parent_id,
    kind: r.kind,
    title: r.title,
    icon: r.icon,
    position: r.position,
    trashedAt: r.trashed_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  }
}

// ---------- full-text indexing ----------

/** Pull every human-readable string out of a BlockNote document JSON. */
function extractText(content: string | null): string {
  if (!content) return ''
  const out: string[] = []
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) {
      node.forEach(walk)
    } else if (node && typeof node === 'object') {
      const obj = node as Record<string, unknown>
      if (typeof obj.text === 'string') out.push(obj.text)
      for (const key of ['content', 'children', 'rows', 'cells']) {
        if (obj[key]) walk(obj[key])
      }
    }
  }
  try {
    walk(JSON.parse(content))
  } catch {
    /* unparseable content is simply not indexed */
  }
  return out.join(' ')
}

function reindexPage(pageId: string): void {
  const db = getDb()
  const row = db
    .prepare('SELECT title, content FROM pages WHERE id = ? AND trashed_at IS NULL')
    .get(pageId) as { title: string; content: string | null } | undefined
  db.prepare('DELETE FROM search_fts WHERE page_id = ?').run(pageId)
  if (row) {
    db.prepare('INSERT INTO search_fts (page_id, title, body) VALUES (?, ?, ?)').run(
      pageId,
      row.title,
      extractText(row.content)
    )
  }
}

// ---------- pages ----------

export function listPages(): Page[] {
  const rows = getDb()
    .prepare(
      `SELECT id, parent_id, kind, title, icon, position, trashed_at, created_at, updated_at
       FROM pages WHERE trashed_at IS NULL ORDER BY position, created_at`
    )
    .all() as PageRow[]
  return rows.map(toPage)
}

export function listTrashed(): Page[] {
  const rows = getDb()
    .prepare(
      `SELECT id, parent_id, kind, title, icon, position, trashed_at, created_at, updated_at
       FROM pages WHERE trashed_at IS NOT NULL ORDER BY trashed_at DESC`
    )
    .all() as PageRow[]
  return rows.map(toPage)
}

export function getPage(pageId: string): PageWithContent | null {
  const r = getDb().prepare('SELECT * FROM pages WHERE id = ?').get(pageId) as PageRow | undefined
  return r ? { ...toPage(r), content: r.content ?? null } : null
}

export function getBreadcrumbs(pageId: string): BreadcrumbItem[] {
  const db = getDb()
  const trail: BreadcrumbItem[] = []
  let cur: string | null = pageId
  const stmt = db.prepare('SELECT id, parent_id, title, icon FROM pages WHERE id = ?')
  while (cur) {
    const r = stmt.get(cur) as
      | { id: string; parent_id: string | null; title: string; icon: string | null }
      | undefined
    if (!r) break
    trail.unshift({ id: r.id, title: r.title, icon: r.icon })
    cur = r.parent_id
    if (trail.length > 50) break
  }
  return trail
}

function nextPosition(table: 'pages' | 'db_rows' | 'views' | 'db_props', where: string, param: string | null): number {
  const db = getDb()
  const r = db
    .prepare(`SELECT COALESCE(MAX(position), 0) AS m FROM ${table} WHERE ${where}`)
    .get(param) as { m: number }
  return r.m + 1
}

export function createPage(opts: {
  parentId: string | null
  kind: PageKind
  title?: string
  icon?: string | null
}): Page {
  const db = getDb()
  const pageId = id()
  const t = now()
  const position = opts.parentId
    ? nextPosition('pages', 'parent_id = ?', opts.parentId)
    : (db.prepare('SELECT COALESCE(MAX(position),0) AS m FROM pages WHERE parent_id IS NULL').get() as { m: number }).m + 1
  db.prepare(
    `INSERT INTO pages (id, parent_id, kind, title, icon, position, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(pageId, opts.parentId, opts.kind, opts.title ?? '', opts.icon ?? null, position, t, t)

  if (opts.kind === 'database') {
    seedDatabase(pageId)
  }
  reindexPage(pageId)
  return getPage(pageId)! as Page
}

/** New databases get a Status select property, a default Table view and three empty rows. */
function seedDatabase(databaseId: string): void {
  const status: SelectOption[] = [
    { id: id(), name: 'Not started', color: 'gray' },
    { id: id(), name: 'In progress', color: 'blue' },
    { id: id(), name: 'Done', color: 'green' }
  ]
  const propId = addProperty(databaseId, 'Status', 'select').id
  updateProperty(propId, { options: status })
  addView(databaseId, 'table', 'Table')
  for (let i = 0; i < 3; i++) addRow(databaseId, {})
}

export function updatePage(opts: {
  id: string
  title?: string
  icon?: string | null
  content?: string
}): void {
  const db = getDb()
  const sets: string[] = ['updated_at = ?']
  const params: unknown[] = [now()]
  if (opts.title !== undefined) {
    sets.push('title = ?')
    params.push(opts.title)
  }
  if (opts.icon !== undefined) {
    sets.push('icon = ?')
    params.push(opts.icon)
  }
  if (opts.content !== undefined) {
    sets.push('content = ?')
    params.push(opts.content)
  }
  params.push(opts.id)
  db.prepare(`UPDATE pages SET ${sets.join(', ')} WHERE id = ?`).run(...params)
  if (opts.title !== undefined || opts.content !== undefined) reindexPage(opts.id)
}

export function movePage(pageId: string, parentId: string | null, position: number): void {
  // refuse to create a cycle: walk up from the new parent
  let cur = parentId
  const stmt = getDb().prepare('SELECT parent_id FROM pages WHERE id = ?')
  while (cur) {
    if (cur === pageId) return
    const r = stmt.get(cur) as { parent_id: string | null } | undefined
    cur = r?.parent_id ?? null
  }
  getDb()
    .prepare('UPDATE pages SET parent_id = ?, position = ?, updated_at = ? WHERE id = ?')
    .run(parentId, position, now(), pageId)
}

function descendantIds(pageId: string): string[] {
  const rows = getDb()
    .prepare(
      `WITH RECURSIVE sub(id) AS (
         SELECT id FROM pages WHERE id = ?
         UNION ALL
         SELECT p.id FROM pages p JOIN sub s ON p.parent_id = s.id
       ) SELECT id FROM sub`
    )
    .all(pageId) as { id: string }[]
  return rows.map((r) => r.id)
}

export function trashPage(pageId: string): void {
  const db = getDb()
  const t = now()
  const ids = descendantIds(pageId)
  const mark = db.prepare('UPDATE pages SET trashed_at = ? WHERE id = ?')
  const unindex = db.prepare('DELETE FROM search_fts WHERE page_id = ?')
  const tx = db.transaction(() => {
    for (const pid of ids) {
      mark.run(t, pid)
      unindex.run(pid)
    }
  })
  tx()
}

export function restorePage(pageId: string): void {
  const db = getDb()
  const page = db.prepare('SELECT trashed_at, parent_id FROM pages WHERE id = ?').get(pageId) as
    | { trashed_at: number | null; parent_id: string | null }
    | undefined
  if (!page?.trashed_at) return
  const stamp = page.trashed_at
  const ids = descendantIds(pageId)
  const clear = db.prepare('UPDATE pages SET trashed_at = NULL WHERE id = ? AND trashed_at = ?')
  const tx = db.transaction(() => {
    for (const pid of ids) clear.run(pid, stamp)
    // if the original parent is itself trashed, restore to top level
    if (page.parent_id) {
      const parent = db.prepare('SELECT trashed_at FROM pages WHERE id = ?').get(page.parent_id) as
        | { trashed_at: number | null }
        | undefined
      if (!parent || parent.trashed_at) {
        db.prepare('UPDATE pages SET parent_id = NULL WHERE id = ?').run(pageId)
      }
    }
  })
  tx()
  for (const pid of ids) reindexPage(pid)
}

export function deletePagePermanently(pageId: string): void {
  const db = getDb()
  const ids = descendantIds(pageId)
  const tx = db.transaction(() => {
    const unindex = db.prepare('DELETE FROM search_fts WHERE page_id = ?')
    for (const pid of ids) unindex.run(pid)
    db.prepare('DELETE FROM pages WHERE id = ?').run(pageId)
  })
  tx()
}

export function duplicatePage(pageId: string): Page | null {
  const db = getDb()
  const src = getPage(pageId)
  if (!src) return null

  const copyTree = (srcId: string, parentId: string | null, retitle: boolean): string => {
    const s = db.prepare('SELECT * FROM pages WHERE id = ?').get(srcId) as PageRow
    const newId = id()
    const t = now()
    const title = retitle ? (s.title ? `${s.title} (copy)` : 'Untitled (copy)') : s.title
    db.prepare(
      `INSERT INTO pages (id, parent_id, kind, title, icon, position, content, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(newId, parentId, s.kind, title, s.icon, s.position + 0.5, s.content ?? null, t, t)

    if (s.kind === 'database') {
      const propMap = new Map<string, string>()
      const props = db
        .prepare('SELECT * FROM db_props WHERE database_id = ? ORDER BY position')
        .all(srcId) as { id: string; name: string; type: string; options: string; position: number }[]
      for (const p of props) {
        const npid = id()
        propMap.set(p.id, npid)
        db.prepare(
          'INSERT INTO db_props (id, database_id, name, type, options, position) VALUES (?, ?, ?, ?, ?, ?)'
        ).run(npid, newId, p.name, p.type, p.options, p.position)
      }
      const views = db
        .prepare('SELECT * FROM views WHERE database_id = ? ORDER BY position')
        .all(srcId) as { type: string; name: string; config: string; position: number }[]
      for (const v of views) {
        let config = v.config
        for (const [oldP, newP] of propMap) config = config.split(oldP).join(newP)
        db.prepare(
          'INSERT INTO views (id, database_id, type, name, config, position) VALUES (?, ?, ?, ?, ?, ?)'
        ).run(id(), newId, v.type, v.name, config, v.position)
      }
      const rows = db
        .prepare(
          `SELECT r.* FROM db_rows r JOIN pages p ON p.id = r.page_id
           WHERE r.database_id = ? AND p.trashed_at IS NULL ORDER BY r.position`
        )
        .all(srcId) as { id: string; page_id: string; vals: string; position: number }[]
      for (const r of rows) {
        const newPageId = copyTree(r.page_id, newId, false)
        let vals = r.vals
        for (const [oldP, newP] of propMap) vals = vals.split(`"${oldP}"`).join(`"${newP}"`)
        db.prepare(
          'INSERT INTO db_rows (id, database_id, page_id, vals, position) VALUES (?, ?, ?, ?, ?)'
        ).run(id(), newId, newPageId, vals, r.position)
      }
    } else {
      const children = db
        .prepare(
          `SELECT p.id FROM pages p
           LEFT JOIN db_rows r ON r.page_id = p.id
           WHERE p.parent_id = ? AND p.trashed_at IS NULL AND r.id IS NULL
           ORDER BY p.position`
        )
        .all(srcId) as { id: string }[]
      for (const c of children) copyTree(c.id, newId, false)
    }
    reindexPage(newId)
    return newId
  }

  const tx = db.transaction(() => copyTree(pageId, src.parentId, true))
  const newId = tx()
  return getPage(newId)
}

// ---------- database properties ----------

interface PropRow {
  id: string
  database_id: string
  name: string
  type: PropertyType
  options: string
  position: number
}

function toProp(r: PropRow): DbProperty {
  return {
    id: r.id,
    databaseId: r.database_id,
    name: r.name,
    type: r.type,
    options: JSON.parse(r.options) as SelectOption[],
    position: r.position
  }
}

export function listProperties(databaseId: string): DbProperty[] {
  const rows = getDb()
    .prepare('SELECT * FROM db_props WHERE database_id = ? ORDER BY position')
    .all(databaseId) as PropRow[]
  return rows.map(toProp)
}

export function addProperty(databaseId: string, name: string, type: PropertyType): DbProperty {
  const db = getDb()
  const pid = id()
  db.prepare(
    'INSERT INTO db_props (id, database_id, name, type, options, position) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(pid, databaseId, name, type, '[]', nextPosition('db_props', 'database_id = ?', databaseId))
  return toProp(db.prepare('SELECT * FROM db_props WHERE id = ?').get(pid) as PropRow)
}

export function updateProperty(
  propId: string,
  patch: { name?: string; type?: PropertyType; options?: SelectOption[]; position?: number }
): void {
  const db = getDb()
  const sets: string[] = []
  const params: unknown[] = []
  if (patch.name !== undefined) {
    sets.push('name = ?')
    params.push(patch.name)
  }
  if (patch.type !== undefined) {
    sets.push('type = ?')
    params.push(patch.type)
  }
  if (patch.options !== undefined) {
    sets.push('options = ?')
    params.push(JSON.stringify(patch.options))
  }
  if (patch.position !== undefined) {
    sets.push('position = ?')
    params.push(patch.position)
  }
  if (!sets.length) return
  params.push(propId)
  db.prepare(`UPDATE db_props SET ${sets.join(', ')} WHERE id = ?`).run(...params)
}

export function deleteProperty(propId: string): void {
  getDb().prepare('DELETE FROM db_props WHERE id = ?').run(propId)
}

// ---------- database rows ----------

interface RawRow {
  id: string
  database_id: string
  page_id: string
  vals: string
  position: number
  title: string
  icon: string | null
}

function toRow(r: RawRow): DbRow {
  return {
    id: r.id,
    databaseId: r.database_id,
    pageId: r.page_id,
    values: JSON.parse(r.vals) as RowValues,
    position: r.position,
    title: r.title,
    icon: r.icon
  }
}

export function listRows(databaseId: string): DbRow[] {
  const rows = getDb()
    .prepare(
      `SELECT r.*, p.title, p.icon FROM db_rows r
       JOIN pages p ON p.id = r.page_id
       WHERE r.database_id = ? AND p.trashed_at IS NULL
       ORDER BY r.position`
    )
    .all(databaseId) as RawRow[]
  return rows.map(toRow)
}

export function addRow(databaseId: string, values: RowValues, title = ''): DbRow {
  const db = getDb()
  const page = createPage({ parentId: databaseId, kind: 'page', title })
  const rid = id()
  db.prepare(
    'INSERT INTO db_rows (id, database_id, page_id, vals, position) VALUES (?, ?, ?, ?, ?)'
  ).run(rid, databaseId, page.id, JSON.stringify(values), nextPosition('db_rows', 'database_id = ?', databaseId))
  const raw = db
    .prepare(
      `SELECT r.*, p.title, p.icon FROM db_rows r JOIN pages p ON p.id = r.page_id WHERE r.id = ?`
    )
    .get(rid) as RawRow
  return toRow(raw)
}

export function updateRowValues(rowId: string, patch: RowValues): void {
  const db = getDb()
  const r = db.prepare('SELECT vals FROM db_rows WHERE id = ?').get(rowId) as
    | { vals: string }
    | undefined
  if (!r) return
  const merged = { ...(JSON.parse(r.vals) as RowValues), ...patch }
  db.prepare('UPDATE db_rows SET vals = ? WHERE id = ?').run(JSON.stringify(merged), rowId)
}

export function moveRow(rowId: string, position: number): void {
  getDb().prepare('UPDATE db_rows SET position = ? WHERE id = ?').run(position, rowId)
}

export function deleteRow(rowId: string): void {
  const r = getDb().prepare('SELECT page_id FROM db_rows WHERE id = ?').get(rowId) as
    | { page_id: string }
    | undefined
  if (r) trashPage(r.page_id)
}

// ---------- views ----------

interface ViewRow {
  id: string
  database_id: string
  type: ViewType
  name: string
  config: string
  position: number
}

function toView(r: ViewRow): DbView {
  return {
    id: r.id,
    databaseId: r.database_id,
    type: r.type,
    name: r.name,
    config: JSON.parse(r.config) as ViewConfig,
    position: r.position
  }
}

export function listViews(databaseId: string): DbView[] {
  const rows = getDb()
    .prepare('SELECT * FROM views WHERE database_id = ? ORDER BY position')
    .all(databaseId) as ViewRow[]
  return rows.map(toView)
}

export function addView(databaseId: string, type: ViewType, name: string): DbView {
  const db = getDb()
  const vid = id()
  db.prepare(
    'INSERT INTO views (id, database_id, type, name, config, position) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(vid, databaseId, type, name, '{}', nextPosition('views', 'database_id = ?', databaseId))
  return toView(db.prepare('SELECT * FROM views WHERE id = ?').get(vid) as ViewRow)
}

export function updateView(
  viewId: string,
  patch: { name?: string; config?: ViewConfig }
): void {
  const db = getDb()
  const sets: string[] = []
  const params: unknown[] = []
  if (patch.name !== undefined) {
    sets.push('name = ?')
    params.push(patch.name)
  }
  if (patch.config !== undefined) {
    sets.push('config = ?')
    params.push(JSON.stringify(patch.config))
  }
  if (!sets.length) return
  params.push(viewId)
  db.prepare(`UPDATE views SET ${sets.join(', ')} WHERE id = ?`).run(...params)
}

export function deleteView(viewId: string): void {
  getDb().prepare('DELETE FROM views WHERE id = ?').run(viewId)
}

// ---------- search ----------

export function search(query: string): SearchResult[] {
  const q = query.trim()
  if (!q) return []
  // Build a prefix-match FTS query. ftsQuery is passed as a bound parameter (no
  // SQL injection possible); quoting each term additionally disarms FTS5's own
  // query operators (OR, NEAR, column:) so input is matched literally.
  const ftsQuery = q
    .split(/\s+/)
    .map((t) => `"${t.replace(/"/g, '""')}"*`)
    .join(' ')
  try {
    const rows = getDb()
      .prepare(
        `SELECT f.page_id, p.title, p.icon, p.kind,
                snippet(search_fts, 2, '[', ']', '…', 12) AS snip
         FROM search_fts f
         JOIN pages p ON p.id = f.page_id
         WHERE search_fts MATCH ? AND p.trashed_at IS NULL
         ORDER BY rank
         LIMIT 30`
      )
      .all(ftsQuery) as {
      page_id: string
      title: string
      icon: string | null
      kind: PageKind
      snip: string
    }[]
    return rows.map((r) => ({
      pageId: r.page_id,
      title: r.title,
      icon: r.icon,
      kind: r.kind,
      snippet: r.snip
    }))
  } catch {
    return []
  }
}
