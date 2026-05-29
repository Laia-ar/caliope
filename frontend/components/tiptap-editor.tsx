"use client"

import React from "react"

import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit"
import { Button } from "@/components/ui/button"
import { Bold, Italic, List, ListOrdered, Quote, Undo, Redo, LinkIcon, Crosshair, X } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useState, useEffect, useCallback, useMemo } from "react"
import { FocusPassage } from "./tiptap-focus-mark"

interface TipTapEditorProps {
  onContentChange?: (content: string) => void
  initialContent?: string
  onFocusPassageChange?: (passage: string | null) => void
}

export const TipTapEditor = React.memo(function TipTapEditor({ onContentChange, initialContent, onFocusPassageChange }: TipTapEditorProps) {
  const [showLinkDialog, setShowLinkDialog] = useState(false)
  const [linkUrl, setLinkUrl] = useState("")
  const [focusPassage, setFocusPassage] = useState<string | null>(null)

  const debouncedOnContentChange = useCallback(
    debounce((content: string) => {
      onContentChange?.(content)
    }, 150), // 150ms debounce for better performance
    [onContentChange],
  )

  const editorConfig = useMemo(
    () => ({
      extensions: [
        StarterKit.configure({
          link: {
            openOnClick: false,
            HTMLAttributes: {
              class: "text-blue-600 underline cursor-pointer",
            },
          },
        }),
        FocusPassage,
      ],
      content: initialContent || "<p></p>",
      editorProps: {
        attributes: {
          class: "tiptap focus:outline-none min-h-[500px] px-6 py-4",
        },
      },
      immediatelyRender: false,
      onUpdate: ({ editor }: { editor: Editor }) => {
        const html = editor.getHTML();
        debouncedOnContentChange(html);

        // Check if focus passage mark still exists in the document
        let hasFocusMark = false;
        editor.state.doc.descendants((node) => {
          if (node.marks.some((mark) => mark.type.name === "focusPassage")) {
            hasFocusMark = true;
            return false;
          }
        });
        if (!hasFocusMark && focusPassage !== null) {
          setFocusPassage(null);
          onFocusPassageChange?.(null);
        }
      },
    }),
    [initialContent, debouncedOnContentChange, focusPassage, onFocusPassageChange]
  );

  const editor = useEditor(editorConfig)

  useEffect(() => {
    if (editor && initialContent && initialContent !== editor.getHTML()) {
      editor.commands.setContent(initialContent)
    }
  }, [editor, initialContent])

  const handleTextStyleChange = useCallback(
    (value: string) => {
      if (!editor) return

      switch (value) {
        case "normal":
          editor.chain().focus().setParagraph().run()
          break
        case "heading1":
          editor.chain().focus().setHeading({ level: 1 }).run()
          break
        case "heading2":
          editor.chain().focus().setHeading({ level: 2 }).run()
          break
        case "heading3":
          editor.chain().focus().setHeading({ level: 3 }).run()
          break
      }
    },
    [editor],
  )

  const getCurrentTextStyle = useCallback(() => {
    if (!editor) return "normal"
    if (editor.isActive("heading", { level: 1 })) return "heading1"
    if (editor.isActive("heading", { level: 2 })) return "heading2"
    if (editor.isActive("heading", { level: 3 })) return "heading3"
    return "normal"
  }, [editor])

  const handleAddLink = useCallback(() => {
    if (linkUrl && editor) {
      editor.chain().focus().setLink({ href: linkUrl }).run()
      setLinkUrl("")
      setShowLinkDialog(false)
    }
  }, [linkUrl, editor])

  const handleBulletList = useCallback(() => {
    if (!editor) return
    editor.chain().focus().toggleBulletList().run()
  }, [editor])

  const handleOrderedList = useCallback(() => {
    if (!editor) return
    editor.chain().focus().toggleOrderedList().run()
  }, [editor])

  const handleBold = useCallback(() => {
    editor?.chain().focus().toggleBold().run()
  }, [editor])

  const handleItalic = useCallback(() => {
    editor?.chain().focus().toggleItalic().run()
  }, [editor])

  const handleBlockquote = useCallback(() => {
    editor?.chain().focus().toggleBlockquote().run()
  }, [editor])

  const handleUndo = useCallback(() => {
    editor?.chain().focus().undo().run()
  }, [editor])

  const handleRedo = useCallback(() => {
    editor?.chain().focus().redo().run()
  }, [editor])

  const handleSetFocus = useCallback(() => {
    if (!editor) return
    const { from, to, empty } = editor.state.selection
    if (empty) return

    // Apply the focus mark to the selection
    editor.chain().focus().setMark("focusPassage").run()

    // Extract plain text from the selection
    const selectedText = editor.state.doc.textBetween(from, to, " ")
    setFocusPassage(selectedText)
    onFocusPassageChange?.(selectedText)
  }, [editor, onFocusPassageChange])

  const handleClearFocus = useCallback(() => {
    if (!editor) return
    editor.chain().focus().unsetMark("focusPassage").run()
    // Also remove mark from entire document to be safe
    editor.commands.selectAll()
    editor.chain().unsetMark("focusPassage").run()
    editor.commands.focus("end")
    setFocusPassage(null)
    onFocusPassageChange?.(null)
  }, [editor, onFocusPassageChange])

  if (!editor) {
    return null
  }

  return (
    <div className="w-full">
      {/* Toolbar */}
      <div className="border-b border-border px-6 py-3 flex items-center gap-2 bg-muted/30">
        {/* Text Style Dropdown */}
        <Select value={getCurrentTextStyle()} onValueChange={handleTextStyleChange}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="normal">Normal</SelectItem>
            <SelectItem value="heading1">Título 1</SelectItem>
            <SelectItem value="heading2">Título 2</SelectItem>
            <SelectItem value="heading3">Título 3</SelectItem>
          </SelectContent>
        </Select>

        <div className="w-px h-6 bg-border mx-2" />

        {/* Formatting Buttons */}
        <Button variant="ghost" size="sm" onClick={handleBold} className={editor.isActive("bold") ? "bg-muted" : ""}>
          <Bold className="w-4 h-4" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleItalic}
          className={editor.isActive("italic") ? "bg-muted" : ""}
        >
          <Italic className="w-4 h-4" />
        </Button>

        <div className="w-px h-6 bg-border mx-2" />

        {/* List Buttons */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleBulletList}
          className={editor.isActive("bulletList") ? "bg-muted" : ""}
        >
          <List className="w-4 h-4" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleOrderedList}
          className={editor.isActive("orderedList") ? "bg-muted" : ""}
        >
          <ListOrdered className="w-4 h-4" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleBlockquote}
          className={editor.isActive("blockquote") ? "bg-muted" : ""}
        >
          <Quote className="w-4 h-4" />
        </Button>

        <div className="w-px h-6 bg-border mx-2" />

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowLinkDialog(true)}
          className={editor.isActive("link") ? "bg-muted" : ""}
        >
          <LinkIcon className="w-4 h-4" />
        </Button>

        <div className="w-px h-6 bg-border mx-2" />

        {/* Focus Buttons */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSetFocus}
          disabled={editor.state.selection.empty}
          className={focusPassage ? "bg-amber-100 text-amber-700" : ""}
          title="Seleccionar pasaje enfocado"
        >
          <Crosshair className="w-4 h-4" />
        </Button>

        {focusPassage && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearFocus}
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
            title="Quitar foco"
          >
            <X className="w-4 h-4" />
          </Button>
        )}

        <div className="w-px h-6 bg-border mx-2" />

        {/* Undo/Redo */}
        <Button variant="ghost" size="sm" onClick={handleUndo}>
          <Undo className="w-4 h-4" />
        </Button>

        <Button variant="ghost" size="sm" onClick={handleRedo}>
          <Redo className="w-4 h-4" />
        </Button>
      </div>

      {showLinkDialog && (
        <div className="border-b border-border px-6 py-3 bg-muted/50 flex items-center gap-2">
          <input
            type="url"
            placeholder="Ingresa la URL del enlace"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            className="flex-1 px-3 py-1 border border-border rounded text-sm"
            autoFocus
          />
          <Button size="sm" onClick={handleAddLink} className="btn-radius">
            Agregar
          </Button>
          <Button size="sm" variant="outline" onClick={() => setShowLinkDialog(false)} className="btn-radius">
            Cancelar
          </Button>
        </div>
      )}

      {/* Editor */}
      <div>
        <EditorContent editor={editor} />
      </div>
    </div>
  )
})

function debounce<T extends (...args: any[]) => any>(func: T, wait: number): T {
  let timeout: NodeJS.Timeout | null = null
  return ((...args: any[]) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }) as T
}
