import { ipcMain, app } from 'electron'
import {
  createKeystore,
  keystoreExists,
  rewrapPassword,
  unlockWithPassword,
  unlockWithRecoveryKey,
  verifyPassword
} from './keystore'
import { closeDatabase, isOpen, openDatabase } from './db'
import * as repo from './repo'
import { getSettings, setSettings } from './settings'
import type { AuthState } from '../shared/types'

let mek: Buffer | null = null

function dataDir(): string {
  return app.getPath('userData')
}

function lock(): void {
  closeDatabase()
  if (mek) {
    mek.fill(0)
    mek = null
  }
}

export function registerIpc(): void {
  // ---- auth ----
  ipcMain.handle('auth:state', (): AuthState => {
    if (!keystoreExists(dataDir())) return 'uninitialized'
    return isOpen() ? 'unlocked' : 'locked'
  })

  ipcMain.handle('auth:setup', (_e, password: string) => {
    if (keystoreExists(dataDir())) throw new Error('Already initialized')
    if (typeof password !== 'string' || password.length < 10) throw new Error('Password too short')
    const created = createKeystore(dataDir(), password)
    mek = created.mek
    openDatabase(dataDir(), mek)
    seedWelcomePage()
    return { recoveryKey: created.recoveryKey }
  })

  ipcMain.handle('auth:unlock', (_e, password: string) => {
    const key = unlockWithPassword(dataDir(), String(password))
    if (!key) return { ok: false, error: 'Incorrect password.' }
    try {
      mek = key
      openDatabase(dataDir(), key)
      return { ok: true }
    } catch {
      lock()
      return { ok: false, error: 'Could not open the database.' }
    }
  })

  ipcMain.handle('auth:recover', (_e, recoveryKey: string, newPassword: string) => {
    if (typeof newPassword !== 'string' || newPassword.length < 10) {
      return { ok: false, error: 'New password must be at least 10 characters.' }
    }
    const key = unlockWithRecoveryKey(dataDir(), String(recoveryKey))
    if (!key) return { ok: false, error: 'Invalid recovery key.' }
    try {
      mek = key
      rewrapPassword(dataDir(), key, newPassword)
      openDatabase(dataDir(), key)
      return { ok: true }
    } catch {
      lock()
      return { ok: false, error: 'Could not open the database.' }
    }
  })

  ipcMain.handle('auth:changePassword', (_e, current: string, next: string) => {
    if (!mek) return { ok: false, error: 'Locked.' }
    if (typeof next !== 'string' || next.length < 10) {
      return { ok: false, error: 'New password must be at least 10 characters.' }
    }
    if (!verifyPassword(dataDir(), mek, String(current))) {
      return { ok: false, error: 'Current password is incorrect.' }
    }
    rewrapPassword(dataDir(), mek, next)
    return { ok: true }
  })

  ipcMain.handle('auth:lock', () => lock())

  // ---- pages ----
  ipcMain.handle('pages:list', () => repo.listPages())
  ipcMain.handle('pages:trashed', () => repo.listTrashed())
  ipcMain.handle('pages:get', (_e, id: string) => repo.getPage(id))
  ipcMain.handle('pages:breadcrumbs', (_e, id: string) => repo.getBreadcrumbs(id))
  ipcMain.handle('pages:create', (_e, opts) => repo.createPage(opts))
  ipcMain.handle('pages:update', (_e, opts) => repo.updatePage(opts))
  ipcMain.handle('pages:move', (_e, id: string, parentId: string | null, position: number) =>
    repo.movePage(id, parentId, position)
  )
  ipcMain.handle('pages:trash', (_e, id: string) => repo.trashPage(id))
  ipcMain.handle('pages:restore', (_e, id: string) => repo.restorePage(id))
  ipcMain.handle('pages:deleteForever', (_e, id: string) => repo.deletePagePermanently(id))
  ipcMain.handle('pages:duplicate', (_e, id: string) => repo.duplicatePage(id))

  // ---- database ----
  ipcMain.handle('db:get', (_e, databaseId: string) => ({
    props: repo.listProperties(databaseId),
    rows: repo.listRows(databaseId),
    views: repo.listViews(databaseId)
  }))
  ipcMain.handle('db:addProp', (_e, databaseId, name, type) =>
    repo.addProperty(databaseId, name, type)
  )
  ipcMain.handle('db:updateProp', (_e, propId, patch) => repo.updateProperty(propId, patch))
  ipcMain.handle('db:deleteProp', (_e, propId) => repo.deleteProperty(propId))
  ipcMain.handle('db:addRow', (_e, databaseId, values, title) =>
    repo.addRow(databaseId, values, title)
  )
  ipcMain.handle('db:updateRow', (_e, rowId, patch) => repo.updateRowValues(rowId, patch))
  ipcMain.handle('db:moveRow', (_e, rowId, position) => repo.moveRow(rowId, position))
  ipcMain.handle('db:deleteRow', (_e, rowId) => repo.deleteRow(rowId))
  ipcMain.handle('db:addView', (_e, databaseId, type, name) =>
    repo.addView(databaseId, type, name)
  )
  ipcMain.handle('db:updateView', (_e, viewId, patch) => repo.updateView(viewId, patch))
  ipcMain.handle('db:deleteView', (_e, viewId) => repo.deleteView(viewId))

  // ---- search ----
  ipcMain.handle('search:query', (_e, q: string) => repo.search(q))

  // ---- settings ----
  ipcMain.handle('settings:get', () => getSettings(dataDir()))
  ipcMain.handle('settings:set', (_e, patch) => setSettings(dataDir(), patch))
}

function seedWelcomePage(): void {
  const welcome = repo.createPage({ parentId: null, kind: 'page', title: 'Getting started', icon: '👋' })
  const content = [
    { type: 'heading', props: { level: 2 }, content: 'Welcome to Boardy' },
    { type: 'paragraph', content: 'Your private, encrypted workspace. Everything is stored locally on this machine.' },
    { type: 'paragraph', content: '' },
    { type: 'bulletListItem', content: 'Type "/" anywhere for blocks — headings, to-dos, toggles, code and more' },
    { type: 'bulletListItem', content: 'Use markdown shortcuts: "# " for headings, "- " for lists, "[] " for to-dos' },
    { type: 'bulletListItem', content: 'Create a database from the sidebar to get tables, boards, lists and galleries' },
    { type: 'bulletListItem', content: 'Press Ctrl+K to search, Ctrl+L to lock your workspace' }
  ]
  repo.updatePage({ id: welcome.id, content: JSON.stringify(content) })
}
