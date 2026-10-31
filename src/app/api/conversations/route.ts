import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import type { ConversationSummary } from '@/lib/lawu'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const conversations = await db.conversation.findMany({
      orderBy: { updatedAt: 'desc' },
      include: { _count: { select: { messages: true } } },
    })
    const payload: ConversationSummary[] = conversations.map((c) => ({
      id: c.id,
      title: c.title,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
      messageCount: c._count.messages,
    }))
    return NextResponse.json(payload)
  } catch (error) {
    console.error('[/api/conversations GET]', error)
    return NextResponse.json({ error: 'Gagal memuat daftar obrolan' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { title?: string }
    const conversation = await db.conversation.create({
      data: { title: body.title?.slice(0, 80) || 'Obrolan Baru' },
    })
    return NextResponse.json({ id: conversation.id, title: conversation.title })
  } catch (error) {
    console.error('[/api/conversations POST]', error)
    return NextResponse.json({ error: 'Gagal membuat obrolan' }, { status: 500 })
  }
}
