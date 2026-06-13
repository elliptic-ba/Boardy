import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Copy,
  Database,
  Download,
  FileText,
  MoreHorizontal,
  Trash2,
  Upload
} from 'lucide-react'
import type { BlockNoteEditor } from '@blocknote/core'
import type { BreadcrumbItem, PageWithContent } from '@shared/types'
import { useStore } from '../store'
import Editor from './Editor'
import EmojiPicker from './EmojiPicker'
import DatabaseView from './database/DatabaseView'
import RowPropsPanel from './database/RowPropsPanel'
import { Popover, MenuItem, MenuSeparator, anchorFromPointer, type Anchor } from './ui/Menu'

export default function PageView({
  pageId,
  theme
}: {
  pageId: string
  theme: 'light' | 'dark'
}): React.JSX.Element {
  const [page, setPage] = useState<PageWithContent | null>(null)
  const [title, setTitle] = useState('')
  const [iconAnchor, setIconAnchor] = useState<Anchor | null>(null)
  const [menuAnchor, setMenuAnchor] = useState<Anchor | null>(null)
  const [toast, setToast] = useState('')
  const editorRef = useRef<BlockNoteEditor | null>(null)
  const titleRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const openPage = useStore((s) => s.openPage)
  const patchPageLocal = useStore((s) => s.patchPageLocal)
  const trashPage = useStore((s) => s.trashPage)
  const duplicatePage = useStore((s) => s.duplicatePage)
  const pages = useStore((s) => s.pages)

  const parent = page ? pages.find((p) => p.id === page.parentId) : undefined
  const isRowPage = parent?.kind === 'database'

  // breadcrumbs derive from the live pages store so renames show immediately
  const crumbs = useMemo<BreadcrumbItem[]>(() => {
    const out: BreadcrumbItem[] = []
    let cur: string | null = pageId
    let guard = 0
    while (cur && guard++ < 50) {
      const p = pages.find((x) => x.id === cur)
      if (!p) break
      out.unshift({ id: p.id, title: p.title, icon: p.icon })
      cur = p.parentId
    }
    return out
  }, [pages, pageId])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const p = await window.boardy.pages.get(pageId)
      if (cancelled) return
      setPage(p)
      setTitle(p?.title ?? '')
    })()
    return () => {
      cancelled = true
    }
  }, [pageId])

  useEffect(() => {
    const el = titleRef.current
    if (el) {
      el.style.height = 'auto'
      el.style.height = `${el.scrollHeight}px`
    }
  }, [title, page])

  const saveTitleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingTitle = useRef<string | null>(null)
  const onTitleChange = (value: string): void => {
    setTitle(value)
    patchPageLocal(pageId, { title: value })
    pendingTitle.current = value
    if (saveTitleTimer.current) clearTimeout(saveTitleTimer.current)
    saveTitleTimer.current = setTimeout(() => {
      pendingTitle.current = null
      void window.boardy.pages.update({ id: pageId, title: value })
    }, 300)
  }

  useEffect(() => {
    return () => {
      // flush a pending title save when navigating away
      if (saveTitleTimer.current) clearTimeout(saveTitleTimer.current)
      if (pendingTitle.current !== null) {
        void window.boardy.pages.update({ id: pageId, title: pendingTitle.current })
      }
    }
  }, [pageId])

  const setIcon = (icon: string | null): void => {
    setPage((p) => (p ? { ...p, icon } : p))
    patchPageLocal(pageId, { icon })
    void window.boardy.pages.update({ id: pageId, icon })
  }

  const showToast = (msg: string): void => {
    setToast(msg)
    setTimeout(() => setToast(''), 2000)
  }

  const exportMarkdown = useCallback(async (): Promise<void> => {
    const editor = editorRef.current
    if (!editor || !page) return
    const md = await editor.blocksToMarkdownLossy(editor.document)
    const blob = new Blob([`# ${title || 'Untitled'}\n\n${md}`], { type: 'text/markdown' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${(title || 'untitled').replace(/[^\w\- ]+/g, '')}.md`
    a.click()
    URL.revokeObjectURL(a.href)
    showToast('Exported as Markdown')
  }, [page, title])

  const importMarkdown = (file: File): void => {
    const reader = new FileReader()
    reader.onload = async () => {
      const editor = editorRef.current
      if (!editor) return
      const blocks = await editor.tryParseMarkdownToBlocks(String(reader.result))
      editor.replaceBlocks(editor.document, blocks)
      void window.boardy.pages.update({ id: pageId, content: JSON.stringify(editor.document) })
      showToast('Markdown imported')
    }
    reader.readAsText(file)
  }

  if (!page) return <div className="page-scroll" />

  const isDatabase = page.kind === 'database'

  return (
    <>
      <div className="topbar">
        <div className="breadcrumbs" style={{ marginLeft: 24 }}>
          {crumbs.map((c, i) => (
            <span key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              {i > 0 && <span className="breadcrumb-sep">/</span>}
              <button className="breadcrumb" onClick={() => openPage(c.id)}>
                {c.icon && <span>{c.icon}</span>}
                <span>{c.title || 'Untitled'}</span>
              </button>
            </span>
          ))}
        </div>
        <button className="icon-btn" onClick={(e) => setMenuAnchor(anchorFromPointer(e))}>
          <MoreHorizontal size={18} />
        </button>
      </div>

      <div className="page-scroll">
        <div className={`page-body${isDatabase ? ' full-width' : ''}`}>
          <div className="page-header-area">
            {page.icon ? (
              <div className="page-icon-row">
                <button className="page-icon" onClick={(e) => setIconAnchor(anchorFromPointer(e))}>
                  {page.icon}
                </button>
              </div>
            ) : (
              <div style={{ height: 24 }}>
                <button
                  className="page-add-icon"
                  onClick={(e) => setIconAnchor(anchorFromPointer(e))}
                >
                  {page.kind === 'database' ? <Database size={13} /> : <FileText size={13} />}{' '}
                  Add icon
                </button>
              </div>
            )}
            <textarea
              ref={titleRef}
              className="page-title-input"
              value={title}
              rows={1}
              placeholder={isDatabase ? 'Untitled database' : 'Untitled'}
              onChange={(e) => onTitleChange(e.target.value.replace(/\n/g, ''))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  editorRef.current?.focus()
                }
              }}
            />
          </div>

          {isRowPage && page.parentId && (
            <RowPropsPanel databaseId={page.parentId} pageId={pageId} />
          )}

          {isDatabase ? (
            <DatabaseView databaseId={pageId} theme={theme} />
          ) : (
            <Editor
              pageId={pageId}
              initialContent={page.content}
              theme={theme}
              onEditorReady={(e) => {
                editorRef.current = e
              }}
            />
          )}
        </div>
      </div>

      {iconAnchor && (
        <EmojiPicker
          anchor={iconAnchor}
          onClose={() => setIconAnchor(null)}
          onPick={(e) => setIcon(e)}
          onRemove={page.icon ? () => setIcon(null) : undefined}
        />
      )}

      {menuAnchor && (
        <Popover anchor={menuAnchor} onClose={() => setMenuAnchor(null)}>
          <MenuItem
            icon={<Copy size={15} />}
            label="Duplicate"
            onClick={() => {
              setMenuAnchor(null)
              void duplicatePage(pageId)
            }}
          />
          {!isDatabase && (
            <>
              <MenuSeparator />
              <MenuItem
                icon={<Download size={15} />}
                label="Export as Markdown"
                onClick={() => {
                  setMenuAnchor(null)
                  void exportMarkdown()
                }}
              />
              <MenuItem
                icon={<Upload size={15} />}
                label="Import Markdown into page"
                onClick={() => {
                  setMenuAnchor(null)
                  fileInputRef.current?.click()
                }}
              />
            </>
          )}
          <MenuSeparator />
          <MenuItem
            icon={<Trash2 size={15} />}
            label="Move to trash"
            danger
            onClick={() => {
              setMenuAnchor(null)
              void trashPage(pageId)
            }}
          />
        </Popover>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".md,.markdown,.txt"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) importMarkdown(f)
          e.target.value = ''
        }}
      />

      {toast && <div className="toast">{toast}</div>}
    </>
  )
}
