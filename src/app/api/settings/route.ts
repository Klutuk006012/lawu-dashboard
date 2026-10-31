import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import type { SettingsMap } from '@/lib/lawu'

export const dynamic = 'force-dynamic'

const ALLOWED_KEYS: (keyof SettingsMap)[] = [
  'telegram_bot_token',
  'telegram_chat_id',
  'llm_base_url',
  'llm_api_key',
  'llm_model',
]

function maskToken(value: string): string {
  if (!value) return ''
  if (value.length <= 8) return '••••••••'
  return `${value.slice(0, 6)}••••••••${value.slice(-4)}`
}

export async function GET() {
  try {
    const rows = await db.setting.findMany()
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value])) as SettingsMap
    return NextResponse.json({
      ...map,
      // Token TIDAK pernah dikirim utuh ke client — hanya mask untuk UI
      telegram_bot_token_masked: maskToken(map.telegram_bot_token ?? ''),
      llm_api_key_masked: maskToken(map.llm_api_key ?? ''),
    })
  } catch (error) {
    console.error('[/api/settings GET]', error)
    return NextResponse.json({ error: 'Gagal memuat pengaturan' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<SettingsMap>
    const updates = Object.entries(body).filter(
      ([key, value]) => ALLOWED_KEYS.includes(key as keyof SettingsMap) && typeof value === 'string'
    ) as [string, string][]

    for (const [key, value] of updates) {
      await db.setting.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      })
    }
    return NextResponse.json({ ok: true, updated: updates.length })
  } catch (error) {
    console.error('[/api/settings PUT]', error)
    return NextResponse.json({ error: 'Gagal menyimpan pengaturan' }, { status: 500 })
  }
}
