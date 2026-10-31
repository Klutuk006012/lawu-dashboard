import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import type { SearchResponse } from '@/lib/lawu'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      query?: string
      fileType?: string
      category?: string
    }

    const query = (body.query ?? '').trim()
    const fileType = body.fileType && body.fileType !== 'all' ? body.fileType : undefined
    const category = body.category && body.category !== 'all' ? body.category : undefined

    const where: {
      OR?: { title?: { contains: string }; author?: { contains: string }; summary?: { contains: string }; path?: { contains: string } }[]
      fileType?: string
      category?: string
    } = {}

    if (query) {
      where.OR = [
        { title: { contains: query } },
        { author: { contains: query } },
        { summary: { contains: query } },
        { path: { contains: query } },
      ]
    }
    if (fileType) where.fileType = fileType
    if (category) where.category = category

    const [results, total, categories] = await Promise.all([
      db.ebook.findMany({
        where,
        orderBy: [{ category: 'asc' }, { title: 'asc' }],
        take: 60,
      }),
      db.ebook.count({ where }),
      db.ebook.findMany({ distinct: ['category'], select: { category: true }, orderBy: { category: 'asc' } }),
    ])

    const payload: SearchResponse = {
      results,
      total,
      categories: categories.map((c) => c.category),
    }
    return NextResponse.json(payload)
  } catch (error) {
    console.error('[/api/search]', error)
    return NextResponse.json({ error: 'Gagal melakukan pencarian' }, { status: 500 })
  }
}
