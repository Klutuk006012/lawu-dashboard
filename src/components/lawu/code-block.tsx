'use client'

import * as React from 'react'
import { Check, Copy } from 'lucide-react'

export function CodeBlock({
  code,
  filename,
  language,
}: {
  code: string
  filename?: string
  language?: string
}) {
  const [copied, setCopied] = React.useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      // clipboard tidak tersedia (mis. non-secure context) — abaikan
    }
  }

  return (
    <div className="group relative overflow-hidden rounded-lg border bg-[#202124] text-[#e8eaed] dark:border-border">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-1.5">
        <span className="truncate font-mono text-[11px] text-[#9aa0a6]">
          {filename ?? language ?? 'code'}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          aria-label="Salin kode"
          className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[11px] text-[#9aa0a6] transition-colors hover:bg-white/10 hover:text-[#e8eaed] focus-visible:outline focus-visible:outline-[#8ab4f8]"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-[#81c995]" />
              Tersalin
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              Salin
            </>
          )}
        </button>
      </div>
      <pre className="scrollbar-thin max-h-[420px] overflow-auto p-3 text-[12.5px] leading-relaxed">
        <code className="font-mono">{code}</code>
      </pre>
    </div>
  )
}
