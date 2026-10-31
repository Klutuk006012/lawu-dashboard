import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import type { AlertItem } from '@/lib/lawu'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const alerts = await db.alert.findMany({ orderBy: { createdAt: 'desc' }, take: 50 })
    const payload: AlertItem[] = alerts.map((a) => ({
      id: a.id,
      level: a.level,
      title: a.title,
      message: a.message,
      source: a.source,
      delivered: a.delivered,
      createdAt: a.createdAt.toISOString(),
    }))
    return NextResponse.json(payload)
  } catch (error) {
    console.error('[/api/alerts GET]', error)
    return NextResponse.json({ error: 'Gagal memuat alert' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      level?: string
      title?: string
      message?: string
      source?: string
      delivered?: boolean
    }
    if (!body.title || !body.message) {
      return NextResponse.json({ error: 'Judul dan pesan alert wajib diisi' }, { status: 400 })
    }
    const alert = await db.alert.create({
      data: {
        level: body.level && ['info', 'success', 'warning', 'error'].includes(body.level) ? body.level : 'info',
        title: body.title.slice(0, 120),
        message: body.message.slice(0, 600),
        source: (body.source ?? 'dashboard').slice(0, 60),
        delivered: body.delivered ?? false,
      },
    })
    return NextResponse.json({ id: alert.id })
  } catch (error) {
    console.error('[/api/alerts POST]', error)
    return NextResponse.json({ error: 'Gagal membuat alert' }, { status: 500 })
  }
}
