// ============================================
// Lawu-2.5-Fine — Tipe bersama & konstanta
// (aman diimpor dari client maupun server)
// ============================================

export type ViewKey = 'chat' | 'search' | 'monitor' | 'guide' | 'settings'

export type Role = 'user' | 'assistant'

export interface ChatMessage {
  id: string
  role: Role
  content: string
  latencyMs?: number | null
  createdAt: string
}

export interface ConversationSummary {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  messageCount: number
}

export interface Ebook {
  id: string
  title: string
  author: string
  category: string
  fileType: 'PDF' | 'EPUB' | 'DOCX' | string
  path: string
  sizeMb: number
  pages?: number | null
  summary: string
  indexedAt: string
}

export interface SearchResponse {
  results: Ebook[]
  total: number
  categories: string[]
}

export interface StatsResponse {
  docs: {
    total: number
    byType: { fileType: string; count: number }[]
    byCategory: { category: string; count: number }[]
    sourceSizeMb: number
    indexSizeMb: number
    lastIndexedAt: string | null
  }
  chats: { conversations: number; messages: number }
  alerts: { total24h: number }
  metrics: {
    cpuPct: number
    ramUsedGb: number
    ramTotalGb: number
    ssdUsedGb: number
    ssdTotalGb: number
    hddUsedGb: number
    hddTotalGb: number
    llamaTokPerSec: number
    loadAvg: number
  }
}

export interface AlertItem {
  id: string
  level: 'info' | 'success' | 'warning' | 'error' | string
  title: string
  message: string
  source: string
  delivered: boolean
  createdAt: string
}

export interface SettingsMap {
  telegram_bot_token: string
  telegram_chat_id: string
  llm_base_url: string
  llm_api_key: string
  llm_model: string
}

export const LAWU_HARDWARE = {
  cpu: 'Intel Core i5-10400',
  cpuDetail: '6 Core / 12 Thread • AVX2 • 2.9–4.3 GHz',
  ram: '8 GB DDR4',
  ssd: 'SSD 128 GB',
  ssdRole: 'OS — Debian 13 (Linux 6.x)',
  hdd: 'HDD 500 GB',
  hddRole: 'DATA — koleksi ebook & index Tantivy',
} as const

// Prompt persona Lawu-2.5-Fine (dipakai di backend saat pemanggilan LLM)
export const LAWU_SYSTEM_PROMPT = `Kamu adalah Lawu-2.5-Fine — model bahasa custom fine-tune (basis codex + reasoning, gaya mirip GLM) milik proyek search engine ebook "Lawu".

Lingkunganmu:
- Server lokal Debian 13 (Linux 6.x), murni CPU: Intel Core i5-10400 (6 core/12 thread, AVX2), RAM 8 GB, SSD 128 GB untuk OS, HDD 500 GB untuk data ebook.
- Di produksi kamu dijalankan via llama.cpp dengan kuantisasi GGUF (Q4_K_M) — tanpa GPU sama sekali.
- Ekosistem proyek: Rust (Axum untuk API, Tantivy untuk full-text index BM25, Rayon untuk paralelisme), MarkltDown (Python) untuk ekstraksi teks, inotifywait untuk file watcher, Telegram Bot API untuk alert (saat ini mode simulasi).

Gaya jawaban:
- Bahasa Indonesia yang jelas, terstruktur, dan teknis.
- Ringkas namun lengkap; gunakan poin/blok kode bila membantu.
- Jika ditanya identitas, perkenalkan dirimu sebagai Lawu-2.5-Fine (fine-tune codex + reasoning, dijalankan via llama.cpp GGUF di i5-10400).
- Jika pertanyaan di luar ranah proyek, jawab tetap sebaik mungkin sebagai asisten umum yang cerdas.`

export const FORMAT_BADGE: Record<string, string> = {
  PDF: 'bg-[#fce8e6] text-[#c5221f] dark:bg-[#3c1f1d] dark:text-[#f28b82]',
  EPUB: 'bg-[#e6f4ea] text-[#137333] dark:bg-[#1b2f22] dark:text-[#81c995]',
  DOCX: 'bg-[#e8f0fe] text-[#1a73e8] dark:bg-[#1d2a3f] dark:text-[#8ab4f8]',
}
