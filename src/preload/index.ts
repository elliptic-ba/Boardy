import { contextBridge, ipcRenderer } from 'electron'
import type { BoardyApi } from '../shared/api'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const invoke = (channel: string, ...args: unknown[]): Promise<any> =>
  ipcRenderer.invoke(channel, ...args)

const api: BoardyApi = {
  auth: {
    state: () => invoke('auth:state'),
    setup: (password) => invoke('auth:setup', password),
    unlock: (password) => invoke('auth:unlock', password),
    recover: (recoveryKey, newPassword) => invoke('auth:recover', recoveryKey, newPassword),
    changePassword: (current, next) => invoke('auth:changePassword', current, next),
    lock: () => invoke('auth:lock')
  },
  pages: {
    list: () => invoke('pages:list'),
    trashed: () => invoke('pages:trashed'),
    get: (id) => invoke('pages:get', id),
    breadcrumbs: (id) => invoke('pages:breadcrumbs', id),
    create: (opts) => invoke('pages:create', opts),
    update: (opts) => invoke('pages:update', opts),
    move: (id, parentId, position) => invoke('pages:move', id, parentId, position),
    trash: (id) => invoke('pages:trash', id),
    restore: (id) => invoke('pages:restore', id),
    deleteForever: (id) => invoke('pages:deleteForever', id),
    duplicate: (id) => invoke('pages:duplicate', id)
  },
  db: {
    get: (databaseId) => invoke('db:get', databaseId),
    addProp: (databaseId, name, type) => invoke('db:addProp', databaseId, name, type),
    updateProp: (propId, patch) => invoke('db:updateProp', propId, patch),
    deleteProp: (propId) => invoke('db:deleteProp', propId),
    addRow: (databaseId, values, title) => invoke('db:addRow', databaseId, values, title),
    updateRow: (rowId, patch) => invoke('db:updateRow', rowId, patch),
    moveRow: (rowId, position) => invoke('db:moveRow', rowId, position),
    deleteRow: (rowId) => invoke('db:deleteRow', rowId),
    addView: (databaseId, type, name) => invoke('db:addView', databaseId, type, name),
    updateView: (viewId, patch) => invoke('db:updateView', viewId, patch),
    deleteView: (viewId) => invoke('db:deleteView', viewId)
  },
  search: {
    query: (q) => invoke('search:query', q)
  },
  settings: {
    get: () => invoke('settings:get'),
    set: (patch) => invoke('settings:set', patch)
  }
}

contextBridge.exposeInMainWorld('boardy', api)
