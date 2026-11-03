'use client'

import * as React from 'react'
import { useTheme } from 'next-themes'
import { KeyRound, Palette, Save, ServerCog } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'

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
        title: 'Pengaturan tersimpan',
        description: connected
          ? 'Konsol chat akan mencoba endpoint model Anda.'
          : 'Konsol chat tetap berjalan pada mode simulasi.',
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
      {/* Endpoint Model */}
      <section aria-label="Endpoint model" className="rounded-xl border bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <ServerCog className="h-4.5 w-4.5 text-primary" />
            Endpoint Model
          </h2>
          <Badge
            className={
              connected
                ? 'bg-[#e6f4ea] text-[#137333] dark:bg-[#1b2f22] dark:text-[#81c995]'
                : 'bg-[#fef7e0] text-[#b06000] dark:bg-[#3a2e12] dark:text-[#fdd663]'
            }
          >
            {connected ? 'Terhubung' : 'Simulasi'}
          </Badge>
        </div>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Isi alamat endpoint model Anda (format{' '}
          <code className="rounded bg-secondary px-1 py-0.5 font-mono text-[11px]">/v1/chat/completions</code>)
          bila sudah tersedia. Kosongkan untuk tetap memakai mode simulasi.
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
              placeholder="http://alamat-endpoint-model-anda:8080"
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
              Beralih antara tema terang (kertas bersih) dan gelap (nyaman di mata).
            </p>
          </div>
          <Switch
            checked={theme === 'dark'}
            onCheckedChange={(v) => setTheme(v ? 'dark' : 'light')}
            aria-label="Aktifkan mode gelap"
          />
        </div>
      </section>
    </div>
  )
}
