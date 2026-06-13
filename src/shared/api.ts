import type {
  AppSettings,
  AuthState,
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
} from './types'

/** The full API the preload script exposes on `window.boardy`. */
export interface BoardyApi {
  auth: {
    state: () => Promise<AuthState>
    setup: (password: string) => Promise<{ recoveryKey: string }>
    unlock: (password: string) => Promise<{ ok: boolean; error?: string }>
    recover: (recoveryKey: string, newPassword: string) => Promise<{ ok: boolean; error?: string }>
    changePassword: (current: string, next: string) => Promise<{ ok: boolean; error?: string }>
    lock: () => Promise<void>
  }
  pages: {
    list: () => Promise<Page[]>
    trashed: () => Promise<Page[]>
    get: (id: string) => Promise<PageWithContent | null>
    breadcrumbs: (id: string) => Promise<BreadcrumbItem[]>
    create: (opts: {
      parentId: string | null
      kind: PageKind
      title?: string
      icon?: string | null
    }) => Promise<Page>
    update: (opts: { id: string; title?: string; icon?: string | null; content?: string }) => Promise<void>
    move: (id: string, parentId: string | null, position: number) => Promise<void>
    trash: (id: string) => Promise<void>
    restore: (id: string) => Promise<void>
    deleteForever: (id: string) => Promise<void>
    duplicate: (id: string) => Promise<Page | null>
  }
  db: {
    get: (databaseId: string) => Promise<{ props: DbProperty[]; rows: DbRow[]; views: DbView[] }>
    addProp: (databaseId: string, name: string, type: PropertyType) => Promise<DbProperty>
    updateProp: (
      propId: string,
      patch: { name?: string; type?: PropertyType; options?: SelectOption[]; position?: number }
    ) => Promise<void>
    deleteProp: (propId: string) => Promise<void>
    addRow: (databaseId: string, values: RowValues, title?: string) => Promise<DbRow>
    updateRow: (rowId: string, patch: RowValues) => Promise<void>
    moveRow: (rowId: string, position: number) => Promise<void>
    deleteRow: (rowId: string) => Promise<void>
    addView: (databaseId: string, type: ViewType, name: string) => Promise<DbView>
    updateView: (viewId: string, patch: { name?: string; config?: ViewConfig }) => Promise<void>
    deleteView: (viewId: string) => Promise<void>
  }
  search: {
    query: (q: string) => Promise<SearchResult[]>
  }
  settings: {
    get: () => Promise<AppSettings>
    set: (patch: Partial<AppSettings>) => Promise<AppSettings>
  }
}
