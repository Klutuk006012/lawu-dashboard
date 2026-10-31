import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import type { StatsResponse } from '@/lib/lawu'

export const dynamic = 'force-dynamic'

// Metrik simulasi hardware (di produksi: dibaca dari server Rust Axum /proc)
function simulateMetrics() {
  const jitter = (min: number, max: number, step: number) => {
    const base = (Date.now() / (step * 1000)) % 97
    const t = (base % 10) / 10
    return min + t * (max - min)
  }
  return {
    cpuPct: Math.round(jitter(9, 34, 7) * 10) / 10,
    ramUsedGb: Math.round(jitter(5.4, 8.6, 11) * 10) / 10,
    ramTotalGb: 16,
    ssdUsedGb: Math.round(jitter(31, 37, 13) * 10) / 10,
    ssdTotalGb: 128,
    hddUsedGb: Math.round(jitter(305, 318, 17) * 10) / 10,
    hddTotalGb: 500,
    llamaTokPerSec: Math.round(jitter(9, 14.5, 23) * 10) / 10,
    loadAvg: Math.round(jitter(0.8, 3.4, 31) * 100) / 100,
  }
}

export async function GET() {
  try {
    const [total, byTypeRaw, byCategoryRaw, sizeAgg, lastIndexed, conversations, messages, alerts24h] =
      await Promise.all([
        db.ebook.count(),
        db.ebook.groupBy({ by: ['fileType'], _count: { _all: true } }),
        db.ebook.groupBy({ by: ['category'], _count: { _all: true } }),
        db.ebook.aggregate({ _sum: { sizeMb: true } }),
        db.ebook.findFirst({ orderBy: { indexedAt: 'desc' }, select: { indexedAt: true } }),
        db.conversation.count(),
        db.message.count(),
        db.alert.count({
          where: { createdAt: { gte: new Date(Date.now() - 24 * 3600_000) } },
        }),
      ])

    const sourceSizeMb = Math.round((sizeAgg._sum.sizeMb ?? 0) * 10) / 10
    const payload: StatsResponse = {
      docs: {
        total,
        byType: byTypeRaw.map((r) => ({ fileType: r.fileType, count: r._count._all })),
        byCategory: byCategoryRaw
          .map((r) => ({ category: r.category, count: r._count._all }))
          .sort((a, b) => b.count - a.count),
        sourceSizeMb,
        // Estimasi index Tantivy ≈ 55% dari ukuran sumber (term dictionary + postings + docvalues)
        indexSizeMb: Math.round(sourceSizeMb * 0.55 * 10) / 10,
        lastIndexedAt: lastIndexed?.indexedAt.toISOString() ?? null,
      },
      chats: { conversations, messages },
      alerts: { total24h: alerts24h },
      metrics: simulateMetrics(),
    }

    return NextResponse.json(payload)
  } catch (error) {
    console.error('[/api/stats]', error)
    return NextResponse.json({ error: 'Gagal mengambil statistik' }, { status: 500 })
  }
}
