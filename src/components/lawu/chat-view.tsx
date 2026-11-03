'use client'

import * as React from 'react'
import ReactMarkdown from 'react-markdown'
import { ArrowUp, BookOpenText, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { ChatMessage } from '@/lib/lawu'

const SUGGESTIONS = [
  'Jelaskan arsitektur Tantivy untuk index 15.000 ebook di HDD 500GB',
  'Bagaimana tuning sysctl paling ampuh untuk server Debian 13 saya?',
  'Bandingkan Q3_K_M vs Q4_K_M untuk i5-10400 murni CPU',
  'Rancang watch_ebooks.sh dengan inotifywait + notifikasi Telegram',
]

function TypingDots() {
  return (
    <div className="flex items-center gap-1 py-2" aria-label="Model sedang mengetik">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-2 w-2 animate-bounce rounded-full bg-primary/70"
          style={{ animationDelay: `${i * 150}ms`, animationDuration: '900ms' }}
        />
      ))}
    </div>
  )
}

export function ChatView({
  conversationId,
  onConversationCreated,
  onConversationsChanged,
}: {
  conversationId: string | null
  onConversationCreated: (id: string) => void
  onConversationsChanged: () => void
}) {
  const [messages, setMessages] = React.useState<ChatMessage[]>([])
  const [input, setInput] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [backend, setBackend] = React.useState<'simulasi' | 'llamacpp'>('simulasi')
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)

  React.useEffect(() => {
    if (!conversationId) {
      setMessages([])
      return
    }
    let cancelled = false
    setError(null)
    fetch(`/api/conversations/${conversationId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('gagal muat'))))
      .then((data) => {
        if (!cancelled) setMessages(data.messages ?? [])
      })
      .catch(() => {
        if (!cancelled) setError('Gagal memuat riwayat obrolan.')
      })
    return () => {
      cancelled = true
    }
  }, [conversationId])

  React.useEffect(() => {
    const el = scrollRef.current
    if (el && (messages.length > 0 || loading)) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    }
  }, [messages, loading])

  const send = async (text?: string) => {
    const content = (text ?? input).trim()
    if (!content || loading) return
    setError(null)
    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    setLoading(true)

    const optimistic: ChatMessage = {
      id: `tmp-${Date.now()}`,
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, optimistic])

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId, message: content }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Gagal mengirim pesan')

      setBackend(data.backend ?? 'simulasi')
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== optimistic.id),
        data.userMessage,
        data.assistantMessage,
      ])
      if (!conversationId && data.conversationId) {
        onConversationCreated(data.conversationId)
      }
      onConversationsChanged()
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id))
      setInput(content)
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan.')
    } finally {
      setLoading(false)
      textareaRef.current?.focus()
    }
  }

  const empty = messages.length === 0 && !loading

  return (
    <div className="flex w-full flex-col">
      {/* Area pesan */}
      <div
        ref={scrollRef}
        className="scrollbar-thin h-[calc(100dvh-330px)] min-h-[300px] overflow-y-auto pb-2 sm:h-[calc(100dvh-350px)]"
      >
        {empty ? (
          <div className="mx-auto flex max-w-2xl flex-col items-center px-4 pt-10 text-center sm:pt-16">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
              <Sparkles className="h-7 w-7" />
            </div>
            <h2 className="text-2xl font-semibold tracking-tight">Lawu-2.5-Fine</h2>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              Custom fine-tune (codex + reasoning) — gaya mirip GLM. Saat ini berjalan dalam{' '}
              <Badge variant="secondary" className="mx-0.5 font-medium">
                Mode Simulasi
              </Badge>
              ; di server nyata nanti via llama.cpp GGUF (Q3_K_M) murni CPU di i5-10400.
            </p>
            <div className="mt-6 grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="rounded-xl border bg-card px-4 py-3 text-left text-[13px] leading-snug text-foreground/90 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto flex max-w-3xl flex-col gap-5 px-4">
            {messages.map((m) =>
              m.role === 'user' ? (
                <div key={m.id} className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm leading-relaxed text-primary-foreground shadow-sm">
                    <p className="whitespace-pre-wrap break-words">{m.content}</p>
                  </div>
                </div>
              ) : (
                <div key={m.id} className="flex gap-3">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-primary">
                    <BookOpenText className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="prose-lawu space-y-2 text-sm leading-relaxed [&_a]:text-primary [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_code]:rounded [&_code]:bg-secondary [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[12.5px] [&_h1]:text-lg [&_h1]:font-semibold [&_h2]:text-base [&_h2]:font-semibold [&_h3]:font-semibold [&_li]:ml-4 [&_li]:list-disc [&_ol_li]:list-decimal [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-[#202124] [&_pre]:p-3 [&_pre]:font-mono [&_pre]:text-[12.5px] [&_pre]:text-[#e8eaed] [&_strong]:font-semibold [&_ul_li]:list-disc">
                      <ReactMarkdown>{m.content}</ReactMarkdown>
                    </div>
                    {m.latencyMs ? (
                      <p className="mt-1.5 text-[11px] text-muted-foreground">
                        Lawu-2.5-Fine · {m.latencyMs} ms
                      </p>
                    ) : null}
                  </div>
                </div>
              )
            )}
            {loading && (
              <div className="flex gap-3">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-primary">
                  <BookOpenText className="h-4 w-4" />
                </div>
                <TypingDots />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="mx-auto w-full max-w-3xl px-4 pb-4">
        {error && (
          <p className="mb-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </p>
        )}
        <div className="flex items-end gap-2 rounded-2xl border bg-card p-2 shadow-sm focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/15">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value)
              e.target.style.height = 'auto'
              e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send()
              }
            }}
            placeholder="Tanya apa saja ke Lawu-2.5-Fine…"
            aria-label="Pesan untuk Lawu-2.5-Fine"
            className="min-h-[44px] max-h-40 resize-none border-0 bg-transparent px-2 py-2.5 shadow-none focus-visible:ring-0 dark:bg-transparent"
          />
          <Button
            size="icon"
            onClick={() => send()}
            disabled={loading || !input.trim()}
            aria-label="Kirim pesan"
            className={cn('mb-0.5 h-10 w-10 shrink-0 rounded-xl')}
          >
            <ArrowUp className="h-5 w-5" />
          </Button>
        </div>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          Enter untuk kirim · Shift+Enter baris baru · backend:{' '}
          <span className="font-medium">{backend === 'llamacpp' ? 'llama.cpp (terhubung)' : 'simulasi (SDK)'}</span>
        </p>
      </div>
    </div>
  )
}
