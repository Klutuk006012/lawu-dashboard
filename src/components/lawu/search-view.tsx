'use client'

import * as React from 'react'
import { FileText, FileType2, FolderOpen, Globe, Loader2, Search, Wifi, WifiOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { FORMAT_BADGE, type Ebook, type SearchResponse, type StatsResponse, type WikiResult } from '@/lib/lawu'

function TypeIcon({ type }: { type: string }) {
  if (type === 'PDF') return <FileText className="h-4 w-4" />
  if (type === 'EPUB') return <FileType2 className="h-4 w-4" />
  return <FolderOpen className="h-4 w-4" />
}

function MiniStat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border bg-card px-4 py-3 shadow-sm">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 text-lg font-semibold tabular-nums ${accent ? 'text-primary' : ''}`}>{value}</p>
    </div>
  )
}

export function SearchView() {
  const [query, setQuery] = React.useState('')
  const [fileType, setFileType] = React.useState('all')
  const [category, setCategory] = React.useState('all')
  const [data, setData] = React.useState<SearchResponse | null>(null)
  const [stats, setStats] = React.useState<StatsResponse | null>(null)
  const [loading, setLoading] = React.useState(true)

  const runSearch = React.useCallback(
    async (opts?: { query?: string; fileType?: string; category?: string }) => {
      setLoading(true)
      try {
        const res = await fetch('/api/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: opts?.query ?? query,
            fileType: opts?.fileType ?? fileType,
            category: opts?.category ?? category,
          }),
        })
        const payload = (await res.json()) as SearchResponse
        setData(payload)
      } catch {
        setData({ results: [], total: 0, categories: [] })
      } finally {
        setLoading(false)
      }
    },
    [query, fileType, category]
  )

  React.useEffect(() => {
    runSearch()
  }, [runSearch])

  React.useEffect(() => {
    fetch('/api/stats')
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {})
  }, [])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    runSearch()
  }

  const lastIndexed = stats?.docs.lastIndexedAt
    ? new Date(stats.docs.lastIndexedAt).toLocaleString('id-ID', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—'

  const wiki = data?.wiki
  const wikiStats = stats?.docs.wiki
  const backendOnline = wiki?.backendOnline ?? false
  const wikiResults: WikiResult[] = wiki?.results ?? []

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6">
      {/* Ringkasan index */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniStat
          label="Korpus Wikipedia-ID"
          value={wikiStats ? wikiStats.totalDocs.toLocaleString('id-ID') : '—'}
          accent={backendOnline}
        />
        <MiniStat
          label="Ebook Terindeks"
          value={String(stats?.docs.total ?? '—')}
        />
        <MiniStat label="Ukuran Sumber" value={`${stats?.docs.sourceSizeMb ?? '—'} MB`} />
        <MiniStat label="Terakhir Diindeks" value={lastIndexed} />
      </div>

      {/* Status backend Rust */}
      <div className="mt-3 flex items-center justify-between rounded-xl border bg-card px-4 py-3 shadow-sm">
        <div className="flex items-center gap-2">
          {backendOnline ? (
            <Wifi className="h-4 w-4 text-[#34a853]" />
          ) : (
            <WifiOff className="h-4 w-4 text-muted-foreground" />
          )}
          <div>
            <p className="text-sm font-medium">
              Backend Rust {backendOnline ? 'terhubung' : 'offline'}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {backendOnline
                ? `Server Axum port 3001 aktif · ${wikiStats?.segments ?? 0} segment Tantivy`
                : 'Pencarian Wikipedia-ID tidak tersedia. Menampilkan ebook lokal saja.'}
            </p>
          </div>
        </div>
        {wiki && wiki.latencyMs > 0 && (
          <Badge variant="secondary" className="font-mono text-[10px]">
            {wiki.latencyMs} ms
          </Badge>
        )}
      </div>

      {/* Bar pencarian */}
      <form onSubmit={submit} className="mt-5 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari di Wikipedia Indonesia & koleksi ebook…"
            aria-label="Kata kunci pencarian"
            className="h-11 bg-card pl-9 shadow-sm"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:w-[290px]">
          <Select
            value={fileType}
            onValueChange={(v) => {
              setFileType(v)
              runSearch({ fileType: v })
            }}
          >
            <SelectTrigger aria-label="Filter format file" className="h-11 bg-card shadow-sm sm:w-[130px]">
              <SelectValue placeholder="Format" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Format</SelectItem>
              <SelectItem value="PDF">PDF</SelectItem>
              <SelectItem value="EPUB">EPUB</SelectItem>
              <SelectItem value="DOCX">DOCX</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={category}
            onValueChange={(v) => {
              setCategory(v)
              runSearch({ category: v })
            }}
          >
            <SelectTrigger aria-label="Filter kategori" className="h-11 bg-card shadow-sm sm:w-[150px]">
              <SelectValue placeholder="Kategori" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Kategori</SelectItem>
              {(data?.categories ?? []).map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" className="h-11 px-5" disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Cari'}
        </Button>
      </form>

      <p className="mt-3 text-xs text-muted-foreground">
        {data
          ? `${wikiResults.length + (data.total ?? 0)} dokumen cocok · Wikipedia: ${wikiResults.length} · Ebook: ${data.total}`
          : 'Memuat…'}
      </p>

      {/* Hasil Wikipedia-ID (Rust backend) */}
      {wikiResults.length > 0 && (
        <section className="mt-4">
          <div className="mb-2 flex items-center gap-2">
            <Globe className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">Wikipedia Indonesia</h2>
            <Badge variant="secondary" className="text-[10px]">
              {wikiResults.length} hasil · {wiki?.latencyMs ?? 0} ms
            </Badge>
          </div>
          <div className="flex flex-col gap-3">
            {wikiResults.map((r: WikiResult) => (
              <article
                key={r.docid}
                className="rounded-xl border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="gap-1 border-transparent bg-[#e8f0fe] font-medium text-[#1a73e8] dark:bg-[#1d2a3f] dark:text-[#8ab4f8]">
                    <Globe className="h-3 w-3" />
                    Wikipedia ID
                  </Badge>
                  <Badge variant="secondary" className="font-mono text-[10px]">
                    score {r.score.toFixed(2)}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    docid: {r.docid}
                  </span>
                </div>
                <h3 className="mt-2 text-[15px] font-semibold leading-snug">{r.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-foreground/85">{r.preview}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* Hasil Ebook (Prisma SQLite) */}
      {data && data.results.length > 0 && (
        <section className="mt-6">
          <div className="mb-2 flex items-center gap-2">
            <FolderOpen className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">Koleksi Ebook</h2>
            <Badge variant="secondary" className="text-[10px]">
              {data.total} hasil
            </Badge>
          </div>
          <div className="flex flex-col gap-3">
            {data.results.map((book: Ebook) => (
              <article
                key={book.id}
                className="rounded-xl border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={`gap-1 border-transparent font-medium ${FORMAT_BADGE[book.fileType] ?? ''}`}>
                    <TypeIcon type={book.fileType} />
                    {book.fileType}
                  </Badge>
                  <Badge variant="secondary">{book.category}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {book.sizeMb} MB{book.pages ? ` · ${book.pages} hlm.` : ''}
                  </span>
                </div>
                <h3 className="mt-2 text-[15px] font-semibold leading-snug">{book.title}</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">{book.author}</p>
                <p className="mt-2 text-sm leading-relaxed text-foreground/85">{book.summary}</p>
                <p className="mt-2 truncate font-mono text-[11px] text-muted-foreground" title={book.path}>
                  {book.path}
                </p>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* Empty state */}
      {!loading && data && wikiResults.length === 0 && data.results.length === 0 && (
        <div className="mt-4 rounded-xl border border-dashed bg-card p-10 text-center">
          <Search className="mx-auto h-8 w-8 text-muted-foreground" />
          <h3 className="mt-3 font-semibold">Tidak ada hasil</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Coba kata kunci lain, atau longgarkan filter format/kategori.
          </p>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && data === null && (
        <div className="mt-4 flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border bg-card p-4">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="mt-2 h-4 w-1/3" />
              <Skeleton className="mt-3 h-4 w-full" />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
