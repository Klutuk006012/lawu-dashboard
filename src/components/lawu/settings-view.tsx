'use client'

import * as React from 'react'
import { useTheme } from 'next-themes'
import { KeyRound, Monitor, Palette, Save, ServerCog } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'
import { LAWU_HARDWARE } from '@/lib/lawu'

export function SettingsView() {
  const { toast } = useToast()
  const { theme, setTheme } = useTheme()
  const [baseUrl, setBaseUrl] = React.useState('')
  const [apiKey, setApiKey] = React.useState('')
  const [model, setModel] = React.useState('lawu-2.5-fine')
  const [saving, setSaving] = React.useState(false)
  const [loaded, setLoaded] = React.useState(false)

  React.useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((cfg) => {
        setBaseUrl(cfg.llm_base_url ?? '')
        setModel(cfg.llm_model || 'lawu-2.5-fine')
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
  }, [])

  const connected = baseUrl.trim().length > 0

  const save = async () => {
    setSaving(true)
    try {
      const body: Record<string, string> = {
        llm_base_url: baseUrl.trim(),
        llm_model: model.trim() || 'lawu-2.5-fine',
      }
      if (apiKey.trim()) body.llm_api_key = apiKey.trim()
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error()
      toast({
        title: 'Pengaturan LLM tersimpan',
        description: connected
          ? 'Konsol chat akan mencoba endpoint llama.cpp Anda.'
          : 'Konsol chat tetap berjalan pada mode simulasi (SDK).',
      })
      setApiKey('')
    } catch {
      toast({ title: 'Gagal menyimpan pengaturan', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      {/* Endpoint LLM */}
      <section aria-label="Endpoint model" className="rounded-xl border bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <ServerCog className="h-4.5 w-4.5 text-primary" />
            Endpoint Model — Lawu-2.5-Fine
          </h2>
          <Badge
            className={
              connected
                ? 'bg-[#e6f4ea] text-[#137333] dark:bg-[#1b2f22] dark:text-[#81c995]'
                : 'bg-[#fef7e0] text-[#b06000] dark:bg-[#3a2e12] dark:text-[#fdd663]'
            }
          >
            {connected ? 'llama.cpp (terhubung)' : 'Simulasi (SDK)'}
          </Badge>
        </div>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Isi base URL server llama.cpp Anda (endpoint OpenAI-compatible{' '}
          <code className="rounded bg-secondary px-1 py-0.5 font-mono text-[11px]">/v1/chat/completions</code>) bila sudah
          jalan di i5-10400. Kosongkan untuk tetap memakai mode simulasi.
        </p>

        <div className="mt-4 space-y-3">
          <div>
            <Label htmlFor="llm-url" className="text-xs">
              Base URL — mis. http://192.168.1.10:8080
            </Label>
            <Input
              id="llm-url"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="http://<IP-SERVER-i5-10400>:8080"
              className="mt-1 h-10"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="llm-model" className="text-xs">
                Nama Model
              </Label>
              <Input
                id="llm-model"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="mt-1 h-10"
              />
            </div>
            <div>
              <Label htmlFor="llm-key" className="text-xs flex items-center gap-1">
                <KeyRound className="h-3 w-3" /> API Key (opsional)
              </Label>
              <Input
                id="llm-key"
                type="password"
                autoComplete="off"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={connected ? 'kosongkan bila tanpa key' : 'tidak dipakai di mode simulasi'}
                className="mt-1 h-10"
              />
            </div>
          </div>
          <Button onClick={save} disabled={saving || !loaded} size="sm">
            <Save className="mr-1.5 h-3.5 w-3.5" />
            {saving ? 'Menyimpan…' : 'Simpan Pengaturan'}
          </Button>
        </div>
      </section>

      {/* Tampilan */}
      <section aria-label="Tampilan" className="mt-5 rounded-xl border bg-card p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Palette className="h-4.5 w-4.5 text-primary" />
          Tampilan
        </h2>
        <div className="mt-3 flex items-center justify-between rounded-lg border px-4 py-3">
          <div>
            <p className="text-sm font-medium">Mode Gelap</p>
            <p className="text-xs text-muted-foreground">
              Light: kertas #F8F7F5 + aksen #1A73E8 · Dark: #121212 + aksen #8AB4F8
            </p>
          </div>
          <Switch
            checked={theme === 'dark'}
            onCheckedChange={(v) => setTheme(v ? 'dark' : 'light')}
            aria-label="Aktifkan mode gelap"
          />
        </div>
      </section>

      {/* Info sistem */}
      <section aria-label="Info sistem" className="mt-5 rounded-xl border bg-card p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Monitor className="h-4.5 w-4.5 text-primary" />
          Info Sistem
        </h2>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-lg bg-secondary px-4 py-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">CPU</p>
            <p className="mt-0.5 text-sm font-semibold">{LAWU_HARDWARE.cpu}</p>
            <p className="text-xs text-muted-foreground">{LAWU_HARDWARE.cpuDetail}</p>
          </div>
          <div className="rounded-lg bg-secondary px-4 py-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Memori</p>
            <p className="mt-0.5 text-sm font-semibold">{LAWU_HARDWARE.ram}</p>
            <p className="text-xs text-muted-foreground">Model 7B Q3_K_M ≈ 3,6 GB</p>
          </div>
          <div className="rounded-lg bg-secondary px-4 py-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Penyimpanan</p>
            <p className="mt-0.5 text-sm font-semibold">{LAWU_HARDWARE.ssd}</p>
            <p className="text-xs text-muted-foreground">{LAWU_HARDWARE.ssdRole}</p>
          </div>
          <div className="rounded-lg bg-secondary px-4 py-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Data</p>
            <p className="mt-0.5 text-sm font-semibold">{LAWU_HARDWARE.hdd}</p>
            <p className="text-xs text-muted-foreground">{LAWU_HARDWARE.hddRole}</p>
          </div>
        </div>
        <Separator className="my-4" />
        <div className="flex flex-wrap gap-2">
          {['Next.js 16 · App Router', 'Tailwind CSS 4', 'shadcn/ui', 'Prisma + SQLite', 'z-ai SDK (simulasi LLM)', 'Target prod: Rust Axum + Tantivy'].map(
            (s) => (
              <Badge key={s} variant="secondary" className="font-normal">
                {s}
              </Badge>
            )
          )}
        </div>
      </section>
    </div>
  )
}
