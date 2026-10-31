import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import type { ChatMessage } from '@/lib/lawu'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const conversation = await db.conversation.findUnique({
      where: { id },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    })
    if (!conversation) {
      return NextResponse.json({ error: 'Obrolan tidak ditemukan' }, { status: 404 })
    }
    const messages: ChatMessage[] = conversation.messages.map((m) => ({
      id: m.id,
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content,
      latencyMs: m.latencyMs,
      createdAt: m.createdAt.toISOString(),
    }))
    return NextResponse.json({ id: conversation.id, title: conversation.title, messages })
  } catch (error) {
    console.error('[/api/conversations/:id GET]', error)
    return NextResponse.json({ error: 'Gagal memuat obrolan' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    await db.conversation.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[/api/conversations/:id DELETE]', error)
    return NextResponse.json({ error: 'Gagal menghapus obrolan' }, { status: 500 })
  }
}
