'use client'

import * as React from 'react'
import { CodeBlock } from '@/components/lawu/code-block'
import { Badge } from '@/components/ui/badge'
import { LAWU_HARDWARE } from '@/lib/lawu'

function Section({
  id,
  step,
  title,
  desc,
  children,
}: {
  id: string
  step: string
  title: string
  desc?: string
  children?: React.ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
          {step}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          {desc && <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{desc}</p>}
          <div className="mt-3 space-y-3">{children}</div>
        </div>
      </div>
    </section>
  )
}

const ARCH = `┌─────────────────────────── SERVER DEBIAN 13 — i5-10400 ───────────────────────────┐
│                                                                                   │
│  HDD 500GB (DATA)                       SSD 128GB (OS)                            │
│  ├─ ebooks/ (PDF·EPUB·DOCX)             ├─ Debian 13 (Linux 6.x)                  │
│  ├─ incoming/  ◄─── inotifywait         ├─ ~/.cargo/bin/lawu-server (Axum+Tantivy)│
│  ├─ processed_markdowns/ (MarkltDown)   ├─ llama-server + GGUF lawu-2.5-fine      │
│  └─ tantivy_index/                      └─ /var/log + journald                    │
│          │                                       │                                │
│          ▼                                       ▼                                │
│  Tantivy Index (BM25)  ──►  Axum :8081  ──►  Nginx :80  ──►  Dashboard Web        │
│  llama.cpp :8080 (OpenAI-compatible /v1/chat/completions)  ──►  Konsol Chat       │
│  Cron 02:00 backup_lawu.sh · Cron 07:00 send_error_report.sh ──► Telegram (sosul) │
└───────────────────────────────────────────────────────────────────────────────────┘`

const SYSCTL = `# /etc/sysctl.d/99-lawu-fine.conf
# Tuning kernel untuk search engine ebook Lawu-2.5-Fine

# Manfaatkan RAM 16GB untuk caching disk/Tantivy, kurangi swap ke SSD
vm.swappiness = 10

# Tulis data kotor ke disk bertahap — cegah I/O stall saat indexing
vm.dirty_background_ratio = 5

# Batas file descriptor besar untuk Axum & Tantivy (buka banyak segmen index)
fs.file-max = 2097152

# Pemantauan inotifywait hingga ratusan ribu file ebook di HDD
fs.inotify.max_user_watches = 524288

# Perbesar antrean backlog koneksi masuk untuk HTTP API Axum
net.core.somaxconn = 65535`

const SYSCTL_APPLY = `sudo sysctl --system
# verifikasi
sysctl vm.swappiness fs.file-max fs.inotify.max_user_watches net.core.somaxconn`

const CARGO_TOML = `[package]
name = "lawu-server"
version = "0.1.0"
edition = "2021"

[dependencies]
axum = "0.7"
tokio = { version = "1", features = ["full"] }
tantivy = "0.22"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter"] }
reqwest = { version = "0.12", features = ["json"] }
walkdir = "2"
rayon = "1"

[profile.release]
opt-level = 3
lto = true
codegen-units = 1`

const TANTIVY = `use tantivy::schema::{Schema, TEXT, STORED, IndexRecordOption};

pub fn build_schema() -> Schema {
    // Skema multi-field — identik dengan kontrak dashboard:
    // title, body, path, file_type, category
    let mut schema = Schema::builder();

    schema.add_text_field("title", TEXT | STORED);
    schema.add_text_field("body", TEXT);
    schema.add_text_field("path", TEXT | STORED);       // unique per dokumen
    schema.add_text_field("file_type", TEXT);            // PDF | EPUB | DOCX
    schema.add_text_field("category", TEXT);

    schema.build()
}

// Index writer dengan commit per batch (Rayon memparalelkan ekstraksi):
// let writer = index.writer(64_000_000)?;            // 64 MB heap
// writer.add_document(doc)?;
// writer.commit()?;  // posting list BM25 siap dicari`

const AXUM_API = `use axum::{routing::{get, post}, Router, Json, extract::State};

#[derive(Clone)]
struct AppState { /* tantivy Index reader, config Telegram */ }

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt().with_env_filter("info").init();

    let state = AppState::default();

    let app = Router::new()
        // Metrik total dokumen + ukuran index (dipakai kartu Monitoring dashboard)
        .route("/api/stats", get(stats_handler))
        // Pencarian teks & filter format (PDF/EPUB/DOCX) + kategori
        .route("/api/search", post(search_handler))
        // Uji konektivitas Telegram Bot (sendMessage)
        .route("/api/telegram/test", post(telegram_test_handler))
        .with_state(state);

    let listener = tokio::net::TcpListener::bind("127.0.0.1:8081").await?;
    tracing::info!("lawu-server berjalan di http://127.0.0.1:8081");
    axum::serve(listener, app).await?;
    Ok(())
}

async fn search_handler(Json(req): Json<SearchRequest>) -> Json<SearchResponse> {
    // BooleanQuery + TermQuery untuk penyaringan presisi:
    //   body CONTAINS q  AND  file_type == "PDF"
    // Skor default Tantivy = BM25 — sesuai target latency k6 < 300ms
    // (implementasi memakai index_reader.searcher() + TopDocs::with_limit(60))
    Json(SearchResponse { results: vec![], total: 0 })
}`

const LLAMA_QUANT = `# 1) Build llama.cpp dengan optimasi CPU (AVX2 otomatis terdeteksi di i5-10400)
git clone https://github.com/ggerganov/llama.cpp && cd llama.cpp
cmake -B build -DGGML_NATIVE=ON -DLLAMA_BUILD_SERVER=ON
cmake --build build --config Release -j 6

# 2) Konversi & kuantisasi model fine-tune Lawu-2.5-Fine
python3 convert_hf_to_gguf.py ~/models/lawu-2.5-fine-hf \
  --outfile ~/models/lawu-2.5-fine-f16.gguf --outtype f16

./build/bin/llama-quantize \\
  ~/models/lawu-2.5-fine-f16.gguf \\
  ~/models/lawu-2.5-fine-q4_k_m.gguf Q4_K_M

# 3) Serve dengan endpoint OpenAI-compatible (dipakai panel Pengaturan dashboard)
./build/bin/llama-server \\
  -m ~/models/lawu-2.5-fine-q4_k_m.gguf \\
  --alias lawu-2.5-fine \\
  -t 6 \\              # 6 core fisik (sisakan thread utk OS/indexer)
  --mmap \\            # mmap + cache halaman OS (RAM 16GB nyaman)
  -c 4096 \\           # konteks 4K — cukup utk chat + snippet ebook
  --host 127.0.0.1 --port 8080

# Estimasi: 7B Q4_K_M ≈ 4,4 GB di RAM, ~9–14 tok/s di i5-10400 murni CPU
# (14B masih muat 16GB, namun throughput turun ~2x — mulai dari 7B)`

const SYSTEMD = `# /etc/systemd/system/llama-lawu.service
[Unit]
Description=Lawu-2.5-Fine — llama.cpp GGUF server (CPU)
After=network.target

[Service]
User=lawu
ExecStart=/home/lawu/llama.cpp/build/bin/llama-server \\
  -m /home/lawu/models/lawu-2.5-fine-q4_k_m.gguf --alias lawu-2.5-fine \\
  -t 6 --mmap -c 4096 --host 127.0.0.1 --port 8080
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target

# /etc/systemd/system/lawu-2.5-fine.service  (API Rust)
[Unit]
Description=Lawu-2.5-Fine — Axum + Tantivy search API
After=network.target llama-lawu.service

[Service]
User=lawu
ExecStart=/home/lawu/.cargo/bin/lawu-server
Environment=RUST_LOG=info
Restart=always
RestartSec=3
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target

# sudo systemctl daemon-reload && sudo systemctl enable --now llama-lawu lawu-2.5-fine`

const WATCH_SCRIPT = `#!/usr/bin/env bash
# watch_ebooks.sh — File Watcher & Notifikasi Real-time (simulasi Telegram dulu)
set -euo pipefail

WATCH_DIR="/mnt/data/ebooks/incoming"
TELEGRAM_TOKEN="123456:ABC-YOUR-TOKEN"   # nanti disusul via BotFather
TELEGRAM_CHAT="123456789"

send_tg() {  # saat bot menyusul, fungsi ini langsung hidup
  curl -s -X POST "https://api.telegram.org/bot\${TELEGRAM_TOKEN}/sendMessage" \\
    -d chat_id="\${TELEGRAM_CHAT}" -d text="$1" >/dev/null || true
}

inotifywait -m -e close_write -e moved_to --format '%w%f' "\${WATCH_DIR}" |
while read -r FILE; do
  case "\${FILE,,}" in
    *.pdf|*.epub|*.docx)
      echo "[\$(date '+%F %T')] \${FILE}" >> /var/log/lawu/watch.log
      # 1) Ekstrak teks (MarkltDown)  2) Reindex Tantivy  3) Notifikasi
      python3 /opt/lawu/markltdown.py "\${FILE}" \\
        >> /mnt/data/processed_markdowns/index.md
      /opt/lawu/reindex_one.sh "\${FILE}"
      send_tg "📚 Ebook baru terindeks: \$(basename "\${FILE}") — Lawu-2.5-Fine"
      ;;
  esac
done`

const BACKUP_SCRIPT = `#!/usr/bin/env bash
# backup_lawu.sh — Backup Harian & Rotasi Retensi 7 Hari (Cron 02:00 WIB)
set -euo pipefail

STAMP=\$(date +%Y%m%d_%H%M)
DEST="/mnt/data/backup"

tar -czf "\${DEST}/lawu_\${STAMP}.tar.gz" \\
  /mnt/data/processed_markdowns \\
  /mnt/data/tantivy_index

# Rotasi retensi: hapus arsip lebih tua dari 7 hari
find "\${DEST}" -name 'lawu_*.tar.gz' -mtime +7 -delete

echo "[\$(date '+%F %T')] Backup \${STAMP} selesai" >> /var/log/lawu/backup.log`

const ERROR_REPORT = `#!/usr/bin/env bash
# send_error_report.sh — Monitoring Error Log Harian (Cron 07:00 WIB)
set -euo pipefail

TELEGRAM_TOKEN="123456:ABC-YOUR-TOKEN"
TELEGRAM_CHAT="123456789"

NGINX_ERR=\$(tail -n 5 /var/log/nginx/error.log 2>/dev/null || echo "kosong")
JOURNAL_ERR=\$(journalctl -u lawu-2.5-fine.service -p err..warning --since "24h ago" \\
  --no-pager | tail -n 20 || echo "kosong")

MSG="🛠️ <b>Lawu-2.5-Fine — Laporan Error Harian</b>
📅 \$(date '+%F %T WIB')

<b>Nginx (5 baris terakhir):</b>
\`\`\`
\${NGINX_ERR}
\`\`\`
<b>Journalctl lawu-2.5-fine (err..warning, 24 jam):</b>
\`\`\`
\${JOURNAL_ERR}
\`\`\`"

curl -s -X POST "https://api.telegram.org/bot\${TELEGRAM_TOKEN}/sendMessage" \\
  -d chat_id="\${TELEGRAM_CHAT}" \\
  --data-urlencode "text=\${MSG}" \\
  -d parse_mode="HTML" >/dev/null || true`

const CRONTAB = `# crontab -e  (user lawu)
# Backup harian pukul 02:00 WIB
0 2 * * * /opt/lawu/backup_lawu.sh

# Laporan error harian pukul 07:00 WIB
0 7 * * * /opt/lawu/send_error_report.sh

# Jaga file watcher tetap hidup
@reboot /usr/bin/screen -dmS lawu-watch /opt/lawu/watch_ebooks.sh`

const K6 = `// load_test.js — target: p95 /api/search < 300ms dengan 20 Virtual Users
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  vus: 20,
  duration: '2m',
  thresholds: {
    http_req_duration: ['p(95)<300'],
  },
};

export default function () {
  const res = http.post('http://127.0.0.1:8081/api/search',
    JSON.stringify({ query: 'tantivy index', fileType: 'PDF', category: 'all' }),
    { headers: { 'Content-Type': 'application/json' } }
  );
  check(res, { 'status 200': (r) => r.status === 200 });
}

# k6 run load_test.js`

const NGINX = `# /etc/nginx/sites-available/lawu
server {
    listen 80;
    server_name _;

    # Dashboard + API Rust
    location / {
        proxy_pass http://127.0.0.1:8081;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Inference llama.cpp (OpenAI-compatible) untuk konsol chat
    location /v1/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_read_timeout 120s;
    }
}

# sudo ln -s /etc/nginx/sites-available/lawu /etc/nginx/sites-enabled/
# sudo nginx -t && sudo systemctl reload nginx`

const INTEGRATE = `1. Buka tab "Pengaturan" di dashboard ini.
2. Isi Endpoint LLM: http://<IP-SERVER>:8080  (llama-server OpenAI-compatible)
   · Model: lawu-2.5-fine
   · API Key: kosong (lokal) atau token bila Anda menambah middleware.
3. Klik Simpan — konsol chat otomatis beralih dari "Simulasi (SDK)"
   ke "llama.cpp (terhubung)".
4. Untuk data pencarian nyata: arahkan fetch ke server Rust Axum Anda
   (kontrak identik: POST /api/search, GET /api/stats).`

export function GuideView() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6">
      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="bg-[#e6f4ea] text-[#137333] dark:bg-[#1b2f22] dark:text-[#81c995]">
            Panduan Implementasi
          </Badge>
          <Badge variant="secondary">Debian 13 · Linux 6.x</Badge>
          <Badge variant="secondary">Rust · Axum · Tantivy · Rayon</Badge>
          <Badge variant="secondary">llama.cpp GGUF (Q4_K_M)</Badge>
        </div>
        <h1 className="mt-3 text-xl font-semibold tracking-tight">
          Panduan Server Rust — Lawu-2.5-Fine
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          Diterapkan pada {LAWU_HARDWARE.cpu} ({LAWU_HARDWARE.cpuDetail}), {LAWU_HARDWARE.ram},{' '}
          {LAWU_HARDWARE.ssd} ({LAWU_HARDWARE.ssdRole}), {LAWU_HARDWARE.hdd} ({LAWU_HARDWARE.hddRole}).
          Semua blok kode siap disalin (tombol Salin di pojok kanan setiap blok).
        </p>
      </div>

      <div className="mt-6 space-y-8">
        <Section id="arsitektur" step="1" title="Ringkasan Arsitektur" desc="Alur data end-to-end dari HDD koleksi ebook hingga dashboard.">
          <CodeBlock code={ARCH} filename="arsitektur.txt" />
        </Section>

        <Section
          id="sysctl"
          step="2"
          title="Spesifikasi Infrastruktur & Kernel Tuning (sysctl)"
          desc="Parameter kernel disesuaikan melalui /etc/sysctl.d/99-lawu-fine.conf untuk penanganan baca-tulis SSD optimal dan kestabilan pemantauan file disk."
        >
          <CodeBlock code={SYSCTL} filename="/etc/sysctl.d/99-lawu-fine.conf" />
          <CodeBlock code={SYSCTL_APPLY} filename="apply-sysctl.sh" />
        </Section>

        <Section id="cargo" step="3" title="Proyek Cargo — lawu-server" desc="Dependensi inti: Axum (API), Tantivy (full-text), Rayon (paralelisme ekstraksi).">
          <CodeBlock code={CARGO_TOML} filename="Cargo.toml" />
        </Section>

        <Section id="tantivy" step="4" title="Skema Full-Text Tantivy" desc="Skema multi-field (title, body, path, file_type, category) dengan kueri BooleanQuery + TermQuery untuk penyaringan presisi; skor default BM25.">
          <CodeBlock code={TANTIVY} filename="src/schema.rs" />
        </Section>

        <Section id="api" step="5" title="Endpoint API Backend (Axum)" desc="GET /api/stats — metrik total dokumen · POST /api/search — pencarian teks & filter format · POST /api/telegram/test — uji konektivitas bot.">
          <CodeBlock code={AXUM_API} filename="src/main.rs" />
        </Section>

        <Section
          id="llamacpp"
          step="6"
          title="Inference Lawu-2.5-Fine — llama.cpp GGUF (Pure CPU)"
          desc="Fine-tune (codex + reasoning) dikompilasi ke GGUF dan dikuantisasi Q4_K_M — satu-satunya jalur realistis murni CPU di i5-10400."
        >
          <CodeBlock code={LLAMA_QUANT} filename="setup-llamacpp.sh" />
        </Section>

        <Section id="systemd" step="7" title="Unit systemd" desc="Dua layanan: llama-lawu (inference) dan lawu-2.5-fine (API search) — auto-restart dan hidup saat boot.">
          <CodeBlock code={SYSTEMD} filename="systemd-units.conf" />
        </Section>

        <Section id="otomasi" step="8" title="Otomasi Pemantauan & Operasional" desc="Tiga skrip bash: file watcher inotifywait, backup harian dengan rotasi 7 hari, dan laporan error harian via Telegram.">
          <CodeBlock code={WATCH_SCRIPT} filename="watch_ebooks.sh" />
          <CodeBlock code={BACKUP_SCRIPT} filename="backup_lawu.sh" />
          <CodeBlock code={ERROR_REPORT} filename="send_error_report.sh" />
          <CodeBlock code={CRONTAB} filename="crontab -e" />
        </Section>

        <Section id="k6" step="9" title="Pengujian Beban (Load Testing k6)" desc="6 k6 run (load_test.js) dengan 20 Virtual Users; ambang p95 latency /api/search di bawah 300ms.">
          <CodeBlock code={K6} filename="load_test.js" />
        </Section>

        <Section id="nginx" step="10" title="Reverse Proxy Nginx" desc="Satu port 80: dashboard/API Rust di root, inference llama.cpp di /v1/.">
          <CodeBlock code={NGINX} filename="/etc/nginx/sites-available/lawu" />
        </Section>

        <Section id="integrasi" step="11" title="Integrasi dengan Dashboard Ini" desc="Hubungkan dashboard ke server nyata tanpa refactor.">
          <CodeBlock code={INTEGRATE} filename="integrasi.txt" />
        </Section>
      </div>
    </div>
  )
}
