// ============================================
// Lawu-2.5-Fine — Helper untuk panggil Rust backend (Axum port 3001)
// Dengan timeout & graceful fallback bila server offline
// ============================================

// URL backend Rust Axum — bisa di-override via env var
// Saat deploy di srv-fine: pakai http://127.0.0.1:3001 (localhost)
// Saat dev di sandbox: fallback ke mock data
export const LAWU_BACKEND_URL =
  process.env.LAWU_BACKEND_URL ?? 'http://127.0.0.1:3001'

// Timeout fetch ke backend Rust (ms) — backend Tantivy cepat (< 5ms),
// tapi kita kasih buffer untuk cold start / GC pause
const BACKEND_TIMEOUT_MS = 2000

export interface WikiSearchResult {
  docid: string
  title: string
  preview: string
  score: number
}

export interface WikiSearchResponse {
  query: string
  total: number
  latency_ms: number
  results: WikiSearchResult[]
}

export interface WikiStatsResponse {
  index_dir: string
  total_docs: number
  segments: number
}

/**
 * Cek apakah Rust backend (port 3001) reachable.
 * Dipakai untuk menentukan apakah perlu fallback ke mock data.
 */
export async function isBackendReachable(): Promise<boolean> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 500)
    const res = await fetch(`${LAWU_BACKEND_URL}/health`, {
      signal: controller.signal,
    })
    clearTimeout(timeout)
    return res.ok
  } catch {
    return false
  }
}

/**
 * Query Wikipedia-ID index via Rust Axum backend.
 * Return null jika backend offline (untuk fallback graceful).
 */
export async function searchWikipedia(
  query: string,
  limit: number = 10
): Promise<WikiSearchResponse | null> {
  if (!query.trim()) return null
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), BACKEND_TIMEOUT_MS)
    const url = `${LAWU_BACKEND_URL}/api/search?q=${encodeURIComponent(query)}&limit=${limit}`
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })
    clearTimeout(timeout)
    if (!res.ok) return null
    return (await res.json()) as WikiSearchResponse
  } catch {
    // Backend offline / timeout — caller fallback ke data mock
    return null
  }
}

/**
 * Fetch stats index Wikipedia-ID dari Rust Axum backend.
 * Return null jika backend offline.
 */
export async function fetchWikiStats(): Promise<WikiStatsResponse | null> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), BACKEND_TIMEOUT_MS)
    const res = await fetch(`${LAWU_BACKEND_URL}/api/stats`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })
    clearTimeout(timeout)
    if (!res.ok) return null
    return (await res.json()) as WikiStatsResponse
  } catch {
    return null
  }
}
