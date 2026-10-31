'use client'

import * as React from 'react'
import {
  Cpu,
  HardDrive,
  MemoryStick,
  MessageCircleWarning,
  Radio,
  RefreshCw,
  Send,
  ShieldCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { useToast } from '@/hooks/use-toast'
import { LAWU_HARDWARE, type AlertItem, type SettingsMap, type StatsResponse } from '@/lib/lawu'

const LEVEL_STYLE: Record<string, { label: string; className: string }> = {
  info: { label: 'Info', className: 'bg-[#e8f0fe] text-[#1a73e8] dark:bg-[#1d2a3f] dark:text-[#8ab4f8]' },
  success: { label: 'Sukses', className: 'bg-[#e6f4ea] text-[#137333] dark:bg-[#1b2f22] dark:text-[#81c995]' },
  warning: { label: 'Peringatan', className: 'bg-[#fef7e0] text-[#b06000] dark:bg-[#3a2e12] dark:text-[#fdd663]' },
  error: { label: 'Kritis', className: 'bg-[#fce8e6] text-[#c5221f] dark:bg-[#3c1f1d] dark:text-[#f28b82]' },
}

function HardwareCard({
  icon: Icon,
  title,
  detail,
  role,
}: {
  icon: React.ElementType
  title: string
  detail: string
  role?: string
}) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-primary">
          <Icon className="h-4.5 w-4.5" />
        </div>
        <p className="text-sm font-semibold">{title}</p>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{detail}</p>
      {role && <p className="mt-1 font-mono text-[11px] text-muted-foreground">{role}</p>}
    </div>
  )
}

function MetricRow({ label, value, max, unit }: { label: string; value: number; max: number; unit: string }) {
  const pct = Math.min(100, Math.round((value / max) * 100))
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums">
          {value} / {max} {unit}
        </span>
      </div>
      <Progress value={pct} className="mt-1.5 h-2" aria-label={`${label}: ${pct}%`} />
    </div>
  )
}

export function MonitorView() {
  const { toast } = useToast()
  const [stats, setStats] = React.useState<StatsResponse | null>(null)
  const [alerts, setAlerts] = React.useState<AlertItem[]>([])
  const [settings, setSettings] = React.useState<Partial<SettingsMap>>({})
  const [tokenInput, setTokenInput] = React.useState('')
  const [chatIdInput, setChatIdInput] = React.useState('')
  const [savingCfg, setSavingCfg] = React.useState(false)
  const [testing, setTesting] = React.useState(false)
  const [lastPreview, setLastPreview] = React.useState<string | null>(null)

  const loadAll = React.useCallback(async () => {
    const [s, a, cfg] = await Promise.all([
      fetch('/api/stats').then((r) => r.json()),
      fetch('/api/alerts').then((r) => r.json()),
      fetch('/api/settings').then((r) => r.json()),
    ])
    setStats(s)
    setAlerts(Array.isArray(a) ? a : [])
    setSettings(cfg)
    setChatIdInput(cfg.telegram_chat_id ?? '')
    // jangan timpa input token yang sedang diketik jika kosong di server
    setTokenInput((prev) => (prev ? prev : ''))
  }, [])

  React.useEffect(() => {
    loadAll()
    const timer = setInterval(() => {
      fetch('/api/stats')
        .then((r) => r.json())
        .then(setStats)
        .catch(() => {})
    }, 8000)
    return () => clearInterval(timer)
  }, [loadAll])

  const saveTelegram = async () => {
    setSavingCfg(true)
    try {
      const body: Record<string, string> = { telegram_chat_id: chatIdInput.trim() }
      if (tokenInput.trim()) body.telegram_bot_token = tokenInput.trim()
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error()
      toast({ title: 'Konfigurasi tersimpan', description: 'Bot Token & Chat ID diperbarui.' })
      setTokenInput('')
      const cfg = await fetch('/api/settings').then((r) => r.json())
      setSettings(cfg)
    } catch {
      toast({ title: 'Gagal menyimpan', variant: 'destructive' })
    } finally {
      setSavingCfg(false)
    }
  }

  const runTest = async () => {
    setTesting(true)
    try {
      const res = await fetch('/api/telegram/test', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Uji gagal')
      setLastPreview(data.payloadPreview?.text ?? '')
      toast({
        title: 'Uji simulasi terkirim ke timeline',
        description: data.tokenReady && data.chatIdReady
          ? 'Payload siap — bot asli menyusul.'
          : 'Mode simulasi aktif; lengkapi Bot Token & Chat ID.',
      })
      const a = await fetch('/api/alerts').then((r) => r.json())
      setAlerts(Array.isArray(a) ? a : [])
    } catch (err) {
      toast({
        title: 'Uji simulasi gagal',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      })
    } finally {
      setTesting(false)
    }
  }

  const m = stats?.metrics

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6">
      {/* Spesifikasi hardware */}
      <section aria-label="Spesifikasi server target">
        <h2 className="text-lg font-semibold tracking-tight">Spesifikasi Server Target</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Angka resmi proyek — dipakai di seluruh panduan implementasi Rust.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <HardwareCard icon={Cpu} title={LAWU_HARDWARE.cpu} detail={LAWU_HARDWARE.cpuDetail} />
          <HardwareCard icon={MemoryStick} title={LAWU_HARDWARE.ram} detail="Cukup untuk model 7B Q4_K_M (~4,5 GB)" />
          <HardwareCard icon={HardDrive} title={LAWU_HARDWARE.ssd} detail="Debian 13 + binari Rust + llama.cpp" role={LAWU_HARDWARE.ssdRole} />
          <HardwareCard icon={HardDrive} title={LAWU_HARDWARE.hdd} detail="Koleksi ebook, processed_markdowns, tantivy_index" role={LAWU_HARDWARE.hddRole} />
        </div>
      </section>

      {/* Metrik live (simulasi) */}
      <section aria-label="Metrik sistem" className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Metrik Sistem (Simulasi)</h2>
          <Badge variant="secondary" className="gap-1">
            <Radio className="h-3 w-3 animate-pulse" />
            polling 8 dtk
          </Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Di produksi, angka ini disajikan endpoint <code className="rounded bg-secondary px-1 py-0.5 font-mono text-[11px]">GET /api/stats</code> milik server Rust Axum.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="rounded-xl border bg-card p-4 shadow-sm">
            {m ? (
              <div className="space-y-4">
                <MetricRow label={`CPU Load — ${LAWU_HARDWARE.cpu}`} value={m.cpuPct} max={100} unit="%" />
                <MetricRow label="RAM Terpakai" value={m.ramUsedGb} max={m.ramTotalGb} unit="GB" />
                <div className="grid grid-cols-2 gap-4">
                  <MetricRow label="SSD OS" value={m.ssdUsedGb} max={m.ssdTotalGb} unit="GB" />
                  <MetricRow label="HDD DATA" value={m.hddUsedGb} max={m.hddTotalGb} unit="GB" />
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="rounded-lg bg-secondary px-3 py-2">
                    <p className="text-[11px] text-muted-foreground">Throughput llama.cpp</p>
                    <p className="text-sm font-semibold tabular-nums">{m.llamaTokPerSec} tok/dtk</p>
                  </div>
                  <div className="rounded-lg bg-secondary px-3 py-2">
                    <p className="text-[11px] text-muted-foreground">Load Average</p>
                    <p className="text-sm font-semibold tabular-nums">{m.loadAvg}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            )}
          </div>

          {/* Panel Telegram */}
          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <MessageCircleWarning className="h-4 w-4 text-primary" />
                Alert Telegram
              </h3>
              <Badge className="bg-[#fef7e0] text-[#b06000] dark:bg-[#3a2e12] dark:text-[#fdd663]">
                Mode Simulasi
              </Badge>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Bot asli menyusul. Pesan sekarang dicatat ke timeline alert di bawah, tanpa dikirim.
            </p>
            <div className="mt-3 space-y-3">
              <div>
                <Label htmlFor="bot-token" className="text-xs">
                  Bot API Token
                </Label>
                <Input
                  id="bot-token"
                  type="password"
                  autoComplete="off"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder={settings.telegram_bot_token_masked || '123456:ABC-DEF… (dari BotFather)'}
                  className="mt-1 h-10"
                />
              </div>
              <div>
                <Label htmlFor="chat-id" className="text-xs">
                  Chat ID / Group ID
                </Label>
                <Input
                  id="chat-id"
                  value={chatIdInput}
                  onChange={(e) => setChatIdInput(e.target.value)}
                  placeholder="mis. 123456789 atau -1001234567890"
                  className="mt-1 h-10"
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={saveTelegram} disabled={savingCfg} size="sm" className="flex-1">
                  {savingCfg ? 'Menyimpan…' : 'Simpan Konfigurasi'}
                </Button>
                <Button onClick={runTest} disabled={testing} size="sm" variant="outline" className="flex-1">
                  <Send className="mr-1 h-3.5 w-3.5" />
                  {testing ? 'Menguji…' : 'Uji Simulasi'}
                </Button>
              </div>
              {lastPreview && (
                <pre className="scrollbar-thin max-h-28 overflow-auto rounded-lg bg-[#202124] p-2.5 font-mono text-[10.5px] leading-relaxed text-[#e8eaed]">
                  {lastPreview}
                </pre>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Panduan BotFather */}
      <section aria-label="Panduan BotFather" className="mt-8">
        <h2 className="text-lg font-semibold tracking-tight">Panduan Membuat Bot via BotFather</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Siapkan token sekarang — tinggal tempel ke panel di atas begitu integrasi Telegram menyusul.
        </p>
        <Accordion type="single" collapsible className="mt-3 rounded-xl border bg-card px-4 shadow-sm">
          {[
            ['Buka @BotFather', 'Di aplikasi Telegram, cari @BotFather (bot resmi dengan centang biru) lalu kirim /start.'],
            ['Buat bot baru', 'Kirim /newbot. BotFather akan meminta nama tampilan, misal: Lawu Monitor Bot.'],
            ['Tentukan username', 'Isi username unik berakhiran _bot, misal: lawu_25_fine_monitor_bot.'],
            ['Ambil API Token', 'BotFather membalas dengan token format 123456789:AAHxxxxxxxx. Simpan baik-baik — jangan dibagikan.'],
            ['Ambil Chat ID', 'Kirim pesan ke bot Anda, lalu buka https://api.telegram.org/bot<TOKEN>/getUpdates dan salin chat.id. Untuk grup, ID diawali tanda minus.'],
            ['Tempel ke Dashboard', 'Masukkan Bot Token & Chat ID ke panel Alert Telegram di atas, klik Simpan, lalu Uji Simulasi untuk melihat payload di timeline.'],
          ].map(([title, body], i) => (
            <AccordionItem key={title} value={`step-${i}`} className="last:border-b-0">
              <AccordionTrigger className="py-3 text-sm font-medium">
                <span className="flex items-center gap-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
                    {i + 1}
                  </span>
                  {title}
                </span>
              </AccordionTrigger>
              <AccordionContent className="pb-4 pl-9 text-sm text-muted-foreground">{body}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      {/* Timeline alert */}
      <section aria-label="Timeline alert" className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Timeline Alert</h2>
          <Button variant="ghost" size="sm" onClick={loadAll} className="gap-1.5 text-xs">
            <RefreshCw className="h-3.5 w-3.5" />
            Muat ulang
          </Button>
        </div>
        <div className="scrollbar-thin mt-3 max-h-96 space-y-2 overflow-y-auto pr-1">
          {alerts.length === 0 && (
            <div className="rounded-xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
              Belum ada alert. Jalankan Uji Simulasi untuk membuat entri pertama.
            </div>
          )}
          {alerts.map((a) => {
            const style = LEVEL_STYLE[a.level] ?? LEVEL_STYLE.info
            return (
              <div key={a.id} className="flex items-start gap-3 rounded-xl border bg-card p-3.5 shadow-sm">
                <Badge variant="outline" className={`mt-0.5 shrink-0 border-transparent font-medium ${style.className}`}>
                  {style.label}
                </Badge>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold">{a.title}</p>
                    <Badge variant="secondary" className="gap-1 text-[10px]">
                      <ShieldCheck className="h-3 w-3" />
                      {a.delivered ? 'Terkirim' : 'Simulasi'}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{a.message}</p>
                  <p className="mt-1.5 font-mono text-[10.5px] text-muted-foreground">
                    {a.source} · {new Date(a.createdAt).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })} WIB
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
