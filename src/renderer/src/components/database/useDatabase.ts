import { useCallback, useEffect, useState } from 'react'
import { useStore } from '../../store'
import type {
  DbProperty,
  DbRow,
  DbView,
  PropertyType,
  RowValues,
  SelectOption,
  ViewConfig,
  ViewType
} from '@shared/types'

export interface DatabaseData {
  props: DbProperty[]
  rows: DbRow[]
  views: DbView[]
  loading: boolean

  reload: () => Promise<void>
  addProp: (name: string, type: PropertyType) => Promise<void>
  updateProp: (
    propId: string,
    patch: { name?: string; type?: PropertyType; options?: SelectOption[]; position?: number }
  ) => Promise<void>
  deleteProp: (propId: string) => Promise<void>
  addRow: (values?: RowValues, title?: string) => Promise<DbRow>
  updateRowValues: (rowId: string, patch: RowValues) => Promise<void>
  updateRowTitle: (rowId: string, pageId: string, title: string) => Promise<void>
  moveRow: (rowId: string, position: number) => Promise<void>
  deleteRow: (rowId: string) => Promise<void>
  addView: (type: ViewType, name: string) => Promise<DbView>
  updateView: (viewId: string, patch: { name?: string; config?: ViewConfig }) => Promise<void>
  deleteView: (viewId: string) => Promise<void>
}

export function useDatabase(databaseId: string): DatabaseData {
  const [props, setProps] = useState<DbProperty[]>([])
  const [rows, setRows] = useState<DbRow[]>([])
  const [views, setViews] = useState<DbView[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async (): Promise<void> => {
    const data = await window.boardy.db.get(databaseId)
    setProps(data.props)
    setRows(data.rows)
    setViews(data.views)
    setLoading(false)
  }, [databaseId])

  useEffect(() => {
    void reload()
  }, [reload])

  const addProp = useCallback(
    async (name: string, type: PropertyType): Promise<void> => {
      const prop = await window.boardy.db.addProp(databaseId, name, type)
      setProps((p) => [...p, prop])
    },
    [databaseId]
  )

  const updateProp = useCallback(
    async (
      propId: string,
      patch: { name?: string; type?: PropertyType; options?: SelectOption[]; position?: number }
    ): Promise<void> => {
      setProps((p) => p.map((x) => (x.id === propId ? { ...x, ...patch } : x)))
      await window.boardy.db.updateProp(propId, patch)
    },
    []
  )

  const deleteProp = useCallback(async (propId: string): Promise<void> => {
    setProps((p) => p.filter((x) => x.id !== propId))
    await window.boardy.db.deleteProp(propId)
  }, [])

  const addRow = useCallback(
    async (values: RowValues = {}, title = ''): Promise<DbRow> => {
      const row = await window.boardy.db.addRow(databaseId, values, title)
      setRows((r) => [...r, row])
      void useStore.getState().refreshPages()
      return row
    },
    [databaseId]
  )

  const updateRowValues = useCallback(async (rowId: string, patch: RowValues): Promise<void> => {
    setRows((r) =>
      r.map((x) => (x.id === rowId ? { ...x, values: { ...x.values, ...patch } } : x))
    )
    await window.boardy.db.updateRow(rowId, patch)
  }, [])

  const updateRowTitle = useCallback(
    async (rowId: string, pageId: string, title: string): Promise<void> => {
      setRows((r) => r.map((x) => (x.id === rowId ? { ...x, title } : x)))
      useStore.getState().patchPageLocal(pageId, { title })
      await window.boardy.pages.update({ id: pageId, title })
    },
    []
  )

  const moveRow = useCallback(async (rowId: string, position: number): Promise<void> => {
    setRows((r) =>
      [...r.map((x) => (x.id === rowId ? { ...x, position } : x))].sort(
        (a, b) => a.position - b.position
      )
    )
    await window.boardy.db.moveRow(rowId, position)
  }, [])

  const deleteRow = useCallback(async (rowId: string): Promise<void> => {
    setRows((r) => r.filter((x) => x.id !== rowId))
    await window.boardy.db.deleteRow(rowId)
    void useStore.getState().refreshPages()
  }, [])

  const addView = useCallback(
    async (type: ViewType, name: string): Promise<DbView> => {
      const view = await window.boardy.db.addView(databaseId, type, name)
      setViews((v) => [...v, view])
      return view
    },
    [databaseId]
  )

  const updateView = useCallback(
    async (viewId: string, patch: { name?: string; config?: ViewConfig }): Promise<void> => {
      setViews((v) =>
        v.map((x) =>
          x.id === viewId
            ? { ...x, ...(patch.name !== undefined ? { name: patch.name } : {}), ...(patch.config !== undefined ? { config: patch.config } : {}) }
            : x
        )
      )
      await window.boardy.db.updateView(viewId, patch)
    },
    []
  )

  const deleteView = useCallback(async (viewId: string): Promise<void> => {
    setViews((v) => v.filter((x) => x.id !== viewId))
    await window.boardy.db.deleteView(viewId)
  }, [])

  return {
    props,
    rows,
    views,
    loading,
    reload,
    addProp,
    updateProp,
    deleteProp,
    addRow,
    updateRowValues,
    updateRowTitle,
    moveRow,
    deleteRow,
    addView,
    updateView,
    deleteView
  }
}
