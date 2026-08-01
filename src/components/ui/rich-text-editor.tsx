import { IconBold, IconItalic, IconUnderline } from '@/components/icons'
import { useEffect, useRef } from 'react'

import { cn } from '@/lib/utils'

const FONT_SIZES = ['1', '2', '3', '4', '5', '6', '7']
const DEFAULT_SIZE_INDEX = 2 // '3' = browser default

function ToolbarButton({
  onRun,
  active,
  children,
  label,
}: {
  onRun: () => void
  active?: boolean
  children: React.ReactNode
  label: string
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      // mousedown (not click) + preventDefault keeps the text selection alive
      onMouseDown={(e) => {
        e.preventDefault()
        onRun()
      }}
      className={cn(
        'hover:bg-muted flex size-7 items-center justify-center rounded text-sm font-semibold',
        active && 'bg-muted',
      )}
    >
      {children}
    </button>
  )
}

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const sizeIndex = useRef(DEFAULT_SIZE_INDEX)
  const savedRange = useRef<Range | null>(null)

  // Uncontrolled after mount: contenteditable owns the DOM. Re-applying
  // innerHTML from the `value` prop on every keystroke would reset the
  // caret, so we only hydrate once here.
  useEffect(() => {
    if (ref.current) ref.current.innerHTML = value
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function emitChange() {
    if (ref.current) onChange(ref.current.innerHTML)
  }

  function run(command: string, arg?: string) {
    document.execCommand(command, false, arg)
    emitChange()
  }

  function saveSelection() {
    const sel = window.getSelection()
    if (sel && sel.rangeCount > 0) savedRange.current = sel.getRangeAt(0).cloneRange()
  }

  function restoreSelectionAnd(fn: () => void) {
    // The color input steals focus to open its native picker, so execCommand
    // would otherwise run against no active editable region. Refocus the
    // contenteditable div first, then reapply the saved range.
    ref.current?.focus()
    const sel = window.getSelection()
    if (sel && savedRange.current) {
      sel.removeAllRanges()
      sel.addRange(savedRange.current)
    }
    fn()
  }

  return (
    <div className={cn('border-input bg-background rounded-lg border', className)}>
      <div className="border-input flex flex-wrap items-center gap-1 border-b px-2 py-1.5">
        <ToolbarButton label="Bold" onRun={() => run('bold')}>
          <IconBold className="size-4" />
        </ToolbarButton>
        <ToolbarButton label="Italic" onRun={() => run('italic')}>
          <IconItalic className="size-4" />
        </ToolbarButton>
        <ToolbarButton label="Underline" onRun={() => run('underline')}>
          <IconUnderline className="size-4" />
        </ToolbarButton>
        <div className="bg-border mx-1 h-5 w-px" />
        <ToolbarButton
          label="Smaller text"
          onRun={() => {
            sizeIndex.current = Math.max(0, sizeIndex.current - 1)
            run('fontSize', FONT_SIZES[sizeIndex.current])
          }}
        >
          <span className="text-xs">A</span>
        </ToolbarButton>
        <ToolbarButton
          label="Larger text"
          onRun={() => {
            sizeIndex.current = Math.min(FONT_SIZES.length - 1, sizeIndex.current + 1)
            run('fontSize', FONT_SIZES[sizeIndex.current])
          }}
        >
          <span className="text-base">A</span>
        </ToolbarButton>
        <div className="bg-border mx-1 h-5 w-px" />
        <input
          type="color"
          title="Text color"
          aria-label="Text color"
          className="size-7 cursor-pointer overflow-hidden rounded-full border-0 bg-transparent p-0 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-0"
          onMouseDown={saveSelection}
          onInput={(e) => {
            const color = e.currentTarget.value
            restoreSelectionAnd(() => run('foreColor', color))
          }}
        />
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onFocus={() => document.execCommand('defaultParagraphSeparator', false, 'br')}
        onInput={emitChange}
        onBlur={emitChange}
        className="rich-text-editable min-h-[10rem] w-full resize-y overflow-auto px-3 py-2 text-sm outline-none"
      />
    </div>
  )
}
