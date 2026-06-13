import { useEffect, useMemo, useRef } from 'react'
import { useCreateBlockNote } from '@blocknote/react'
import { BlockNoteView } from '@blocknote/mantine'
import type { BlockNoteEditor, PartialBlock } from '@blocknote/core'
import '@blocknote/core/fonts/inter.css'
import '@blocknote/mantine/style.css'

export default function Editor({
  pageId,
  initialContent,
  theme,
  onEditorReady
}: {
  pageId: string
  initialContent: string | null
  theme: 'light' | 'dark'
  onEditorReady?: (editor: BlockNoteEditor) => void
}): React.JSX.Element {
  const parsed = useMemo<PartialBlock[] | undefined>(() => {
    if (!initialContent) return undefined
    try {
      const blocks = JSON.parse(initialContent) as PartialBlock[]
      return Array.isArray(blocks) && blocks.length > 0 ? blocks : undefined
    } catch {
      return undefined
    }
  }, [initialContent])

  const editor = useCreateBlockNote({ initialContent: parsed })

  useEffect(() => {
    onEditorReady?.(editor as BlockNoteEditor)
  }, [editor, onEditorReady])

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const scheduleSave = (): void => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      void window.boardy.pages.update({ id: pageId, content: JSON.stringify(editor.document) })
    }, 400)
  }

  useEffect(() => {
    return () => {
      // flush pending save when navigating away
      if (saveTimer.current) {
        clearTimeout(saveTimer.current)
        void window.boardy.pages.update({ id: pageId, content: JSON.stringify(editor.document) })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="editor-wrap">
      <BlockNoteView editor={editor} theme={theme} onChange={scheduleSave} />
    </div>
  )
}
