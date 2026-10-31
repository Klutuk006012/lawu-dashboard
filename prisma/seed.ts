import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

const EBOOKS = [
  {
    title: 'AI-Ready PostgreSQL 18: Building Intelligent Data Systems with Transactions, Analytics, and Vectors',
    author: 'Vibhor Kumar, Marc Linster',
    category: 'Database',
    fileType: 'PDF',
    path: '/mnt/data/ebooks/database/ai-ready-postgresql-18.pdf',
    sizeMb: 18.4,
    pages: 580,
    summary:
      'Panduan membangun sistem data cerdas dengan PostgreSQL 18: transaksi ACID, analitik, pgvector, pipeline embedding produksi, dan asisten AI berbasis MCP.',
  },
  {
    title: 'Programming Rust: Fast, Safe Systems Development',
    author: 'Jim Blandy, Jason Orendorff',
    category: 'Rust',
    fileType: 'PDF',
    path: '/mnt/data/ebooks/rust/programming-rust-2e.pdf',
    sizeMb: 12.7,
    pages: 610,
    summary:
      'Dasar-dasar Rust untuk sistem performa tinggi: ownership, borrow checker, concurrency tanpa data race, dan desain modul yang idiomatik.',
  },
  {
    title: 'Rust Atomics and Locks: Low-Level Concurrency in Practice',
    author: 'Mara Bos',
    category: 'Rust',
    fileType: 'EPUB',
    path: '/mnt/data/ebooks/rust/rust-atomics-and-locks.epub',
    sizeMb: 3.2,
    pages: 258,
    summary:
      'Konkurensi level rendah di Rust: atomics, memory ordering, mutex, dan cara membangun primitif sinkronisasi dari nol.',
  },
  {
    title: 'Asynchronous Programming in Rust (Axum & Tokio Patterns)',
    author: 'Rust Community',
    category: 'Rust',
    fileType: 'EPUB',
    path: '/mnt/data/ebooks/rust/async-rust-axum-tokio.epub',
    sizeMb: 2.6,
    pages: 190,
    summary:
      'Pola async/await dengan Tokio dan Axum: handler, middleware, graceful shutdown, dan error handling untuk API produksi.',
  },
  {
    title: 'The Linux Programming Interface',
    author: 'Michael Kerrisk',
    category: 'Linux',
    fileType: 'PDF',
    path: '/mnt/data/ebooks/linux/tlpi.pdf',
    sizeMb: 45.1,
    pages: 1552,
    summary:
      'Referensi komprehensif sistem call Linux: proses, signal, inotify, memori virtual, dan IPC — fondasi tuning server Debian.',
  },
  {
    title: 'How Linux Works: What Every Superuser Should Know',
    author: 'Brian Ward',
    category: 'Linux',
    fileType: 'EPUB',
    path: '/mnt/data/ebooks/linux/how-linux-works-3e.epub',
    sizeMb: 8.9,
    pages: 406,
    summary:
      'Cara kerja internal Linux: boot, systemd, kernel parameter sysctl, filesystem, dan jaringan untuk administrasi server.',
  },
  {
    title: 'Debian 13 Administration Handbook',
    author: 'Raphaël Hertzog, Roland Mas',
    category: 'Linux',
    fileType: 'DOCX',
    path: '/mnt/data/ebooks/linux/debian-13-admin-handbook.docx',
    sizeMb: 5.4,
    pages: 512,
    summary:
      'Administrasi Debian 13 (Trixie): paket APT, systemd unit, hardening, cron, journald, dan praktik operasional server lokal.',
  },
  {
    title: 'Introduction to Information Retrieval (BM25 & Ranking)',
    author: 'Manning, Raghavan, Schütze',
    category: 'Search Engine',
    fileType: 'PDF',
    path: '/mnt/data/ebooks/search-engine/introduction-to-information-retrieval.pdf',
    sizeMb: 24.8,
    pages: 576,
    summary:
      'Teori pencarian teks: inverted index, BM25 scoring, evaluasi IR, dan ranking — dasar ilmiah di balik Tantivy.',
  },
  {
    title: 'Building Search Applications with Tantivy',
    author: 'Community Edition',
    category: 'Search Engine',
    fileType: 'PDF',
    path: '/mnt/data/ebooks/search-engine/building-search-tantivy.pdf',
    sizeMb: 6.3,
    pages: 210,
    summary:
      'Praktik membangun mesin pencarian full-text di Rust dengan Tantivy: schema multi-field, query boolean, tokenizer, dan commit strategy.',
  },
  {
    title: 'LLM Inference on CPU: llama.cpp and Quantization Handbook',
    author: 'ggml Community',
    category: 'AI & LLM',
    fileType: 'PDF',
    path: '/mnt/data/ebooks/ai/llm-inference-cpu-llamacpp.pdf',
    sizeMb: 9.8,
    pages: 245,
    summary:
      'Menjalankan LLM murni di CPU: format GGUF, skema kuantisasi Q4_K_M/Q5_K_M, mmap, threading AVX2, dan estimasi throughput.',
  },
  {
    title: 'Hands-On Large Language Models (Fine-Tuning & Reasoning)',
    author: 'Jay Alammar, Maarten Grootendorst',
    category: 'AI & LLM',
    fileType: 'EPUB',
    path: '/mnt/data/ebooks/ai/hands-on-llms.epub',
    sizeMb: 15.2,
    pages: 420,
    summary:
      'Arlitektur transformer, fine-tuning, chain-of-thought reasoning, dan pola RAG untuk asisten domain-spesifik.',
  },
  {
    title: 'Designing Data-Intensive Applications',
    author: 'Martin Kleppmann',
    category: 'Database',
    fileType: 'EPUB',
    path: '/mnt/data/ebooks/database/ddia.epub',
    sizeMb: 28.3,
    pages: 616,
    summary:
      'Reliability, scalability, maintainability sistem data: index structure, replication, partitioning, dan konsistensi terdistribusi.',
  },
  {
    title: 'Telegram Bot API Field Guide (BotFather to Production)',
    author: 'Lawu Notes',
    category: 'Automation',
    fileType: 'DOCX',
    path: '/mnt/data/ebooks/automation/telegram-bot-api-guide.docx',
    sizeMb: 1.8,
    pages: 96,
    summary:
      'Membuat bot via BotFather, getToken, sendMessage, webhook vs polling, dan pola notifikasi monitoring untuk server lokal.',
  },
  {
    title: 'Zero to Production in Rust',
    author: 'Luca Palmieri',
    category: 'Rust',
    fileType: 'PDF',
    path: '/mnt/data/ebooks/rust/zero-to-production-rust.pdf',
    sizeMb: 11.5,
    pages: 464,
    summary:
      'Membangun API Rust siap produksi: actix/axum, telemetri tracing, testing, deployment, dan pola observability.',
  },
  {
    title: 'Mastering PostgreSQL 18 Administration',
    author: 'Hans-Jürgen Schönig',
    category: 'Database',
    fileType: 'PDF',
    path: '/mnt/data/ebooks/database/mastering-postgresql-18.pdf',
    sizeMb: 19.6,
    pages: 520,
    summary:
      'Tuning dan operasional PostgreSQL modern: index GIN/GiST, replikasi, autovacuum, dan monitoring performa query.',
  },
]

const ALERTS = [
  {
    level: 'success',
    title: 'Reindex Tantivy selesai',
    message: '15 dokumen terindeks penuh (title, body, path, file_type, category) dalam 3.2 detik.',
    source: 'tantivy-indexer',
    delivered: false,
  },
  {
    level: 'info',
    title: 'File baru terdeteksi di incoming/',
    message: 'hands-on-llms.epub diterima oleh inotifywait dan diproses MarkltDown → Tantivy.',
    source: 'watch_ebooks.sh',
    delivered: false,
  },
  {
    level: 'warning',
    title: 'Penggunaan HDD DATA mendekati ambang',
    message: '/mnt/data terpakai 312GB dari 500GB (62%). Pertimbangkan rotasi arsip backup_lawu.sh.',
    source: 'monitor-agent',
    delivered: false,
  },
  {
    level: 'info',
    title: 'Backup harian berhasil',
    message: 'Arsip tar.gz processed_markdowns + tantivy_index tersimpan (rotasi retensi 7 hari aktif).',
    source: 'backup_lawu.sh',
    delivered: true,
  },
]

async function main() {
  await db.message.deleteMany()
  await db.conversation.deleteMany()
  await db.ebook.deleteMany()
  await db.alert.deleteMany()
  await db.setting.deleteMany()

  const now = Date.now()
  for (let i = 0; i < EBOOKS.length; i++) {
    const e = EBOOKS[i]
    await db.ebook.create({
      data: {
        ...e,
        indexedAt: new Date(now - (EBOOKS.length - i) * 3600_000 * 5),
      },
    })
  }

  for (let i = 0; i < ALERTS.length; i++) {
    const a = ALERTS[i]
    await db.alert.create({
      data: { ...a, createdAt: new Date(now - (ALERTS.length - i) * 1800_000) },
    })
  }

  const defaults: Record<string, string> = {
    telegram_bot_token: '',
    telegram_chat_id: '',
    llm_base_url: '',
    llm_api_key: '',
    llm_model: 'lawu-2.5-fine',
  }
  for (const [key, value] of Object.entries(defaults)) {
    await db.setting.create({ data: { key, value } })
  }

  console.log('Seed selesai: 15 ebook, 4 alert, 5 setting default.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
