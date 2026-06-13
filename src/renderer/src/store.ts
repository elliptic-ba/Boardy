import { create } from 'zustand'
import type { AppSettings, AuthState, Page, PageKind } from '@shared/types'

type LoadableAuthState = AuthState | 'loading'

interface BoardyStore {
  authState: LoadableAuthState
  settings: AppSettings
  pages: Page[]
  currentPageId: string | null
  expanded: Record<string, boolean>
  searchOpen: boolean
  settingsOpen: boolean
  trashOpen: boolean

  init: () => Promise<void>
  setAuthState: (s: AuthState) => void
  refreshPages: () => Promise<void>
  openPage: (id: string | null) => void
  toggleExpanded: (id: string) => void
  setExpanded: (id: string, value: boolean) => void
  createPage: (parentId: string | null, kind: PageKind) => Promise<Page>
  patchPageLocal: (id: string, patch: Partial<Page>) => void
  trashPage: (id: string) => Promise<void>
  duplicatePage: (id: string) => Promise<void>
  movePage: (id: string, parentId: string | null, position: number) => Promise<void>
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>
  lock: () => Promise<void>
  setSearchOpen: (open: boolean) => void
  setSettingsOpen: (open: boolean) => void
  setTrashOpen: (open: boolean) => void
}

function loadExpanded(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem('boardy.expanded') ?? '{}') as Record<string, boolean>
  } catch {
    return {}
  }
}

function saveExpanded(expanded: Record<string, boolean>): void {
  localStorage.setItem('boardy.expanded', JSON.stringify(expanded))
}

export const useStore = create<BoardyStore>((set, get) => ({
  authState: 'loading',
  settings: { theme: 'system', autoLockMinutes: 0 },
  pages: [],
  currentPageId: localStorage.getItem('boardy.currentPage'),
  expanded: loadExpanded(),
  searchOpen: false,
  settingsOpen: false,
  trashOpen: false,

  init: async () => {
    const [state, settings] = await Promise.all([
      window.boardy.auth.state(),
      window.boardy.settings.get()
    ])
    set({ authState: state, settings })
    if (state === 'unlocked') await get().refreshPages()
  },

  setAuthState: (s) => {
    set({ authState: s })
    if (s === 'unlocked') void get().refreshPages()
  },

  refreshPages: async () => {
    const pages = await window.boardy.pages.list()
    set({ pages })
    const { currentPageId } = get()
    if (currentPageId && !pages.some((p) => p.id === currentPageId)) {
      set({ currentPageId: null })
    }
  },

  openPage: (id) => {
    set({ currentPageId: id, searchOpen: false, trashOpen: false })
    if (id) localStorage.setItem('boardy.currentPage', id)
    else localStorage.removeItem('boardy.currentPage')
  },

  toggleExpanded: (id) => {
    const expanded = { ...get().expanded, [id]: !get().expanded[id] }
    saveExpanded(expanded)
    set({ expanded })
  },

  setExpanded: (id, value) => {
    const expanded = { ...get().expanded, [id]: value }
    saveExpanded(expanded)
    set({ expanded })
  },

  createPage: async (parentId, kind) => {
    const page = await window.boardy.pages.create({ parentId, kind })
    await get().refreshPages()
    if (parentId) get().setExpanded(parentId, true)
    get().openPage(page.id)
    return page
  },

  patchPageLocal: (id, patch) => {
    set({ pages: get().pages.map((p) => (p.id === id ? { ...p, ...patch } : p)) })
  },

  trashPage: async (id) => {
    await window.boardy.pages.trash(id)
    if (get().currentPageId === id) get().openPage(null)
    await get().refreshPages()
  },

  duplicatePage: async (id) => {
    const copy = await window.boardy.pages.duplicate(id)
    await get().refreshPages()
    if (copy) get().openPage(copy.id)
  },

  movePage: async (id, parentId, position) => {
    await window.boardy.pages.move(id, parentId, position)
    await get().refreshPages()
  },

  updateSettings: async (patch) => {
    const settings = await window.boardy.settings.set(patch)
    set({ settings })
  },

  lock: async () => {
    await window.boardy.auth.lock()
    set({ authState: 'locked', pages: [], searchOpen: false, settingsOpen: false, trashOpen: false })
  },

  setSearchOpen: (open) => set({ searchOpen: open }),
  setSettingsOpen: (open) => set({ settingsOpen: open }),
  setTrashOpen: (open) => set({ trashOpen: open })
}))
