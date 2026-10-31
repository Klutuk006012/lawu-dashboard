import { NextRequest, NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'
import { db } from '@/lib/db'
import { LAWU_SYSTEM_PROMPT, type ChatMessage } from '@/lib/lawu'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

interface OpenAIStyleResponse {
  choices?: { message?: { content?: string } }[]
}

async function getSettings(): Promise<Record<string, string>> {
  const rows = await db.setting.findMany()
  return Object.fromEntries(rows.map((r) => [r.key, r.value]))
}

// Panggil server llama.cpp lokal (OpenAI-compatible) bila endpoint dikonfigurasi
async function callLlamaCpp(
  baseUrl: string,
  apiKey: string,
  model: string,
  messages: { role: string; content: string }[]
): Promise<string> {
  const url = `${baseUrl.replace(/\/+$/, '')}/v1/chat/completions`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify({ model: model || 'lawu-2.5-fine', messages, stream: false }),
    signal: AbortSignal.timeout(45_000),
  })
  if (!res.ok) throw new Error(`llama.cpp HTTP ${res.status}`)
  const data = (await res.json()) as OpenAIStyleResponse
  const content = data.choices?.[0]?.message?.content?.trim()
  if (!content) throw new Error('Respons llama.cpp kosong')
  return content
}

async function callSdkFallback(messages: { role: string; content: string }[]): Promise<string> {
  const zai = await ZAI.create()
  const completion = await zai.chat.completions.create({
    messages: messages as never,
    thinking: { type: 'disabled' },
  })
  const content = completion.choices[0]?.message?.content?.trim()
  if (!content) throw new Error('Respons model kosong')
  return content
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { conversationId?: string; message?: string }
    const message = (body.message ?? '').trim()
    if (!message) {
      return NextResponse.json({ error: 'Pesan tidak boleh kosong' }, { status: 400 })
    }

    // 1. Siapkan conversation
    let conversationId = body.conversationId
    if (!conversationId) {
      const created = await db.conversation.create({
        data: { title: message.slice(0, 60) },
      })
      conversationId = created.id
    }

    // 2. Simpan pesan user
    const userMessage = await db.message.create({
      data: { conversationId, role: 'user', content: message },
    })

    // 3. Susun history (maks 16 pesan terakhir + persona)
    const history = await db.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take: 16,
    })
    const ordered = history.reverse().map((m) => ({ role: m.role, content: m.content }))
    const llmMessages = [{ role: 'assistant', content: LAWU_SYSTEM_PROMPT }, ...ordered]

    // 4. Panggil model: endpoint llama.cpp (bila dikonfigurasi) → fallback SDK simulasi
    const settings = await getSettings()
    const started = Date.now()
    let reply = ''
    let backend: 'llamacpp' | 'simulasi' = 'simulasi'
    try {
      if (settings.llm_base_url) {
        reply = await callLlamaCpp(
          settings.llm_base_url,
          settings.llm_api_key ?? '',
          settings.llm_model ?? 'lawu-2.5-fine',
          llmMessages
        )
        backend = 'llamacpp'
      } else {
        reply = await callSdkFallback(llmMessages)
      }
    } catch (err) {
      console.error('[/api/chat] backend utama gagal, fallback SDK:', err)
      reply = await callSdkFallback(llmMessages)
    }
    const latencyMs = Date.now() - started

    // 5. Simpan pesan assistant
    const assistantMessage = await db.message.create({
      data: { conversationId, role: 'assistant', content: reply, latencyMs },
    })
    await db.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    })

    const payload: {
      conversationId: string
      backend: 'llamacpp' | 'simulasi'
      userMessage: ChatMessage
      assistantMessage: ChatMessage
    } = {
      conversationId,
      backend,
      userMessage: {
        id: userMessage.id,
        role: 'user',
        content: userMessage.content,
        createdAt: userMessage.createdAt.toISOString(),
      },
      assistantMessage: {
        id: assistantMessage.id,
        role: 'assistant',
        content: assistantMessage.content,
        latencyMs,
        createdAt: assistantMessage.createdAt.toISOString(),
      },
    }
    return NextResponse.json(payload)
  } catch (error) {
    console.error('[/api/chat]', error)
    return NextResponse.json(
      { error: 'Gagal memproses pesan. Coba lagi sebentar.' },
      { status: 500 }
    )
  }
}
