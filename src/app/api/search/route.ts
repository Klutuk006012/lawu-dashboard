import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { searchWikipedia, isBackendReachable } from '@/lib/lawu-backend'
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

    // 1. Cek apakah Rust backend (Wikipedia-ID index) online
    const backendOnline = await isBackendReachable()

    // 2. Query Wikipedia-ID via Rust backend (paralel dengan Prisma query)
    //    Batasi ke 20 hasil agar UI tidak overload
    const wikiPromise = query
      ? searchWikipedia(query, 20)
      : Promise.resolve(null)

    // 3. Query Prisma ebooks (sumber data lokal SQLite)
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

    const [results, total, categories, wikiResults] = await Promise.all([
      db.ebook.findMany({
        where,
        orderBy: [{ category: 'asc' }, { title: 'asc' }],
        take: 60,
      }),
      db.ebook.count({ where }),
      db.ebook.findMany({ distinct: ['category'], select: { category: true }, orderBy: { category: 'asc' } }),
      wikiPromise,
    ])

    const payload: SearchResponse = {
      results,
      total,
      categories: categories.map((c) => c.category),
      wiki: wikiResults
        ? {
            results: wikiResults.results,
            total: wikiResults.total,
            latencyMs: wikiResults.latency_ms,
            backendOnline: true,
          }
        : {
            results: [],
            total: 0,
            latencyMs: 0,
            backendOnline,
          },
    }
    return NextResponse.json(payload)
  } catch (error) {
    console.error('[/api/search]', error)
    return NextResponse.json({ error: 'Gagal melakukan pencarian' }, { status: 500 })
  }
}
