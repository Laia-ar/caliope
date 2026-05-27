"use client"

import type { HTMLAttributes, ReactNode } from "react"

import ReactMarkdown from "react-markdown"
import type { Components } from "react-markdown"
import remarkGfm from "remark-gfm"

import { cn } from "@/lib/utils"

const markdownComponents: Components = {
  h1: ({ node, ...props }) => <h1 className="text-2xl font-semibold text-gray-900" {...props} />,
  h2: ({ node, ...props }) => <h2 className="text-xl font-semibold text-gray-900" {...props} />,
  h3: ({ node, ...props }) => <h3 className="text-lg font-semibold text-gray-900" {...props} />,
  h4: ({ node, ...props }) => <h4 className="text-base font-semibold text-gray-900" {...props} />,
  p: ({ node, ...props }) => <p className="text-gray-900 leading-relaxed" {...props} />,
  ul: ({ node, ...props }) => <ul className="list-disc pl-5 text-gray-900 space-y-1" {...props} />,
  ol: ({ node, ...props }) => <ol className="list-decimal pl-5 text-gray-900 space-y-1" {...props} />,
  li: ({ node, ...props }) => <li className="leading-relaxed" {...props} />,
  a: ({ node, ...props }) => (
    <a className="text-blue-600 underline" target="_blank" rel="noreferrer" {...props} />
  ),
  strong: ({ node, ...props }) => <strong className="font-semibold text-gray-900" {...props} />,
  em: ({ node, ...props }) => <em className="italic" {...props} />,
  blockquote: ({ node, ...props }) => (
    <blockquote className="border-l-4 border-gray-300 pl-4 italic text-gray-700" {...props} />
  ),
  code: ({
    node,
    inline,
    className,
    children,
    ...props
  }: {
    node?: unknown
    inline?: boolean
    className?: string
    children?: ReactNode
  } & HTMLAttributes<HTMLElement>) => {
    if (inline) {
      return (
        <code
          className={cn("rounded bg-gray-200 px-1 py-0.5 text-sm text-gray-800", className)}
          {...props}
        >
          {children}
        </code>
      )
    }

    return (
      <pre className="overflow-x-auto rounded-md bg-gray-900 p-4 text-gray-200">
        <code className={className} {...props}>
          {children}
        </code>
      </pre>
    )
  },
}

interface MarkdownRenderedViewProps {
  content?: string | null
  className?: string
  emptyPlaceholder?: ReactNode
  components?: Components
}

export function MarkdownRenderedView({
  content,
  className,
  emptyPlaceholder,
  components,
}: MarkdownRenderedViewProps) {
  if (!content?.trim()) {
    return (
      <div className={cn(className)}>
        {emptyPlaceholder ?? <p className="text-gray-500">Sin contenido</p>}
      </div>
    )
  }

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={components ?? markdownComponents}
      className={cn("space-y-3", className)}
    >
      {content}
    </ReactMarkdown>
  )
}
