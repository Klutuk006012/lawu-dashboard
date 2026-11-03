'use client'

import * as React from 'react'
import { ShieldAlert } from 'lucide-react'
import { CodeBlock } from '@/components/lawu/code-block'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
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

// ======================================================================
// LANGKAH 0 — BERSIHKAN SERVER SEBELUM INSTALASI
// (audit → stop → backup → hapus → hapus user → bersihkan config → verify)
// ======================================================================

const CLEANUP_AUDIT = `# 0.A — Audit server kotor (JALANKAN DULU, lihat apa yang ada sebelum bersihkan)
# Paten 3: murni CPU, tanpa GPU — audit hanya mencari sisa project Lawu lama

echo "=== AUDIT SERVER LAWU LAMA ==="

echo "1. Proses yang dengarkan port Lawu (80/8080/8081):"
sudo ss -tlnp | grep -E ':(80|8080|8081)\b' || echo "   (kosong)"

echo "2. Service systemd Lawu/llama lama:"
systemctl list-units --type=service --all | grep -iE 'lawu|llama|tantivy' || echo "   (kosong)"
systemctl list-unit-files | grep -iE 'lawu|llama|tantivy' || echo "   (tidak ada unit file)"

echo "3. Cron jobs Lawu lama:"
crontab -l 2>/dev/null | grep -iE 'lawu|llama' || echo "   (user crontab kosong)"
sudo crontab -l -u lawu 2>/dev/null || echo "   (crontab user lawu tidak ada)"
ls /etc/cron.d/ 2>/dev/null | grep -i lawu || echo "   (/etc/cron.d bersih)"

echo "4. User lawu lama:"
id lawu 2>/dev/null || echo "   (user lawu tidak ada)"
grep -E '^lawu:' /etc/passwd || echo "   (tidak ada di /etc/passwd)"

echo "5. Direktori & binary Lawu lama:"
ls -la /opt/lawu 2>/dev/null || echo "   /opt/lawu tidak ada"
ls -la /mnt/data/ebooks 2>/dev/null || echo "   /mnt/data/ebooks tidak ada"
ls -la /mnt/data/tantivy_index 2>/dev/null || echo "   /mnt/data/tantivy_index tidak ada"
ls -la ~/llama.cpp 2>/dev/null || echo "   ~/llama.cpp tidak ada"
ls -la ~/.cargo/bin/lawu-server 2>/dev/null || echo "   ~/.cargo/bin/lawu-server tidak ada"
ls -la ~/models/lawu-2.5-fine-*.gguf 2>/dev/null || echo "   ~/models tidak ada model GGUF Lawu"

echo "6. sysctl & Nginx config Lawu lama:"
ls /etc/sysctl.d/ 2>/dev/null | grep -i lawu || echo "   (sysctl bersih)"
ls /etc/nginx/sites-enabled/ 2>/dev/null | grep -i lawu || echo "   (nginx bersih)"

echo "7. Log Lawu lama:"
ls /var/log/lawu 2>/dev/null || echo "   /var/log/lawu tidak ada"`

const CLEANUP_STOP = `# 0.B — Stop & disable service Lawu/llama lama
# HATI-HATI: ini menghentikan service Lawu lama yang sedang berjalan

# 1) Stop & disable semua service systemd Lawu/llama lama
for svc in llama-lawu lawu-2.5-fine lawu tantivy; do
  sudo systemctl stop "$svc" 2>/dev/null || true
  sudo systemctl disable "$svc" 2>/dev/null || true
done

# 2) Hapus unit file systemd lama (daemon-reload setelahnya)
sudo rm -f /etc/systemd/system/llama-lawu.service
sudo rm -f /etc/systemd/system/lawu-2.5-fine.service
sudo rm -f /etc/systemd/system/lawu.service
sudo rm -f /etc/systemd/system/tantivy.service
sudo systemctl daemon-reload

# 3) Kill proses yang masih dengarkan port Lawu (8080 inference, 8081 API)
sudo ss -tlnp | grep -E ':(8080|8081)\b' \\
  | grep -oP 'pid=\\K[0-9]+' | sort -u \\
  | while read -r pid; do sudo kill "$pid" 2>/dev/null || true; done

# 4) Hapus cron jobs Lawu lama (user crontab + /etc/cron.d)
sudo crontab -r -u lawu 2>/dev/null || true
# Untuk crontab user biasa: hapus baris yang mengandung /opt/lawu/ atau lawu-
crontab -l 2>/dev/null | grep -v -E '/opt/lawu/|lawu-2.5-fine' | crontab - 2>/dev/null || true
sudo rm -f /etc/cron.d/lawu* 2>/dev/null`

const CLEANUP_BACKUP = `# 0.C — Backup data Lawu lama (OPSIONAL, sebelum hapus permanen)
# Jalankan ini JIKA Anda ingin jaga-jaga ada data ebook/index/markdown lama
# yang belum dimigrasi. Jika server benar-benar kosong/scrapped, lewati langkah ini.

STAMP=$(date +%Y%m%d_%H%M)
BACKUP_DIR="/mnt/data/backup-pre-clean-$STAMP"
sudo mkdir -p "$BACKUP_DIR"

# Backup koleksi ebook, index Tantivy, dan markdown hasil ekstraksi
sudo tar -czf "$BACKUP_DIR/lawu-old-data.tar.gz" \\
  /opt/lawu \\
  /mnt/data/ebooks \\
  /mnt/data/tantivy_index \\
  /mnt/data/processed_markdowns \\
  2>/dev/null || true

# Backup config systemd & sysctl lama (arsip referensi)
sudo tar -czf "$BACKUP_DIR/lawu-old-configs.tar.gz" \\
  /etc/systemd/system/llama-lawu.service \\
  /etc/systemd/system/lawu-2.5-fine.service \\
  /etc/sysctl.d/99-lawu-fine.conf \\
  /etc/nginx/sites-available/lawu \\
  2>/dev/null || true

# Catat ringkasan backup
sudo du -sh "$BACKUP_DIR"/* 2>/dev/null
sudo chmod -R lawu:lawu "$BACKUP_DIR" 2>/dev/null || true
echo "Backup Lawu lama tersimpan di: $BACKUP_DIR"`

const CLEANUP_REMOVE = `# 0.D — Hapus direktori & binary Lawu lama
# PERINGATAN: langkah ini MENGHAPUS PERMANEN. Pastikan 0.C (backup) sudah dilakukan
# jika ada data yang ingin disimpan.

# 1) Hapus direktori aplikasi Lawu (/opt/lawu berisi skrip watch/backup/reindex)
sudo rm -rf /opt/lawu

# 2) Hapus binary lawu-server lama (hasil 'cargo install' atau build lama)
rm -f ~/.cargo/bin/lawu-server

# 3) Hapus source tree llama.cpp lama (akan di-clone ulang di Langkah 6)
rm -rf ~/llama.cpp

# 4) Hapus model GGUF Lawu lama (HATI-HATI — file besar, butuh waktu dihapus)
#    Jika ingin simpan model agar tidak perlu re-download/re-quant, COMMENT baris ini.
rm -f ~/models/lawu-2.5-fine-*.gguf

# 5) Hapus index Tantivy & markdown hasil ekstraksi lama
#    (JIKA ingin mulai indexing dari nol. Jika ingin pakai index lama, COMMENT baris ini.)
sudo rm -rf /mnt/data/tantivy_index
sudo rm -rf /mnt/data/processed_markdowns

# 6) Kosongkan incoming/ (file ebook yang belum diproses oleh watcher lama)
#    (JIKA ingin simpa koleksi ebook, COMMENT baris ini — hanya kosongkan incoming)
# sudo rm -rf /mnt/data/ebooks/incoming/*`

const CLEANUP_USER = `# 0.E — Hapus user & group 'lawu' lama
# User ini akan dibuat ulang bersih di Langkah 7 (systemd).
# Jika server Anda TIDAK pernah pakai user 'lawu' sebelumnya, lewati langkah ini.

# 1) Pastikan tidak ada proses yang masih berjalan sebagai user lawu
sudo pkill -u lawu 2>/dev/null || true
sleep 2

# 2) Hapus user lawu lama BESERTA home directory-nya (-r)
#    Home directory user lawu berisi: ~/.cargo, ~/llama.cpp, ~/models — sudah di-backup di 0.C
sudo userdel -r lawu 2>/dev/null || true

# 3) Hapus group 'lawu' jika masih tersisa (userdel biasanya hapus grup primer otomatis)
sudo groupdel lawu 2>/dev/null || true

# 4) Verifikasi tidak ada file sisa milik UID lawu lama (orphaned files)
sudo find / -path /proc -prune -o -path /sys -prune -o -path /dev -prune \\
  -path /run -prune -o -nouser -print 2>/dev/null | head -20 || true`

const CLEANUP_CONFIG = `# 0.F — Bersihkan sysctl, Nginx config, dan log Lawu lama

# 1) Hapus sysctl custom Lawu lama (akan dibuat ulang bersih di Langkah 2)
sudo rm -f /etc/sysctl.d/99-lawu-fine.conf
sudo sysctl --system 2>/dev/null || true

# 2) Hapus Nginx config Lawu lama (akan dibuat ulang bersih di Langkah 10)
sudo rm -f /etc/nginx/sites-enabled/lawu
sudo rm -f /etc/nginx/sites-available/lawu
# Reload nginx jika masih aktif (bisa gagal jika nginx tidak terpasang — abaikan)
sudo nginx -t 2>/dev/null && sudo systemctl reload nginx 2>/dev/null || true

# 3) Bersihkan log Lawu lama (file log + entry journald lama)
sudo rm -rf /var/log/lawu
# Rotasi & vacuum journald: simpan 3 hari terakhir saja untuk hemat SSD
sudo journalctl --rotate 2>/dev/null || true
sudo journalctl --vacuum-time=3d 2>/dev/null || true

# 4) (OPSIONAL) Bersihkan cache build Cargo lama — hemat SSD 128GB
rm -rf ~/.cargo/registry/cache 2>/dev/null || true
rm -rf ~/.cargo/registry/src 2>/dev/null || true
rm -rf target 2>/dev/null || true`

const CLEANUP_VERIFY = `# 0.G — Verifikasi server bersih (FINAL CHECK)
# Jalankan setelah 0.A–0.F selesai. Semua check harus cetak "✓ Bersih".

echo "=== AUDIT FINAL — SERVER BERSIH? ==="

echo "1. Port Lawu (8080/8081 harus kosong):"
sudo ss -tlnp | grep -E ':(8080|8081)\b' && echo "   ✗ MASIH ADA proses!" || echo "   ✓ Bersih"

echo "2. Service systemd Lawu/llama (harus kosong):"
systemctl list-units --type=service --all | grep -iE 'lawu|llama' && echo "   ✗ MASIH ADA service!" || echo "   ✓ Bersih"
systemctl list-unit-files | grep -iE 'lawu|llama' && echo "   ✗ MASIH ADA unit file!" || echo "   ✓ Bersih"

echo "3. User lawu (harus tidak ada):"
id lawu 2>/dev/null && echo "   ✗ MASIH ADA user!" || echo "   ✓ Bersih"

echo "4. Direktori Lawu (harus tidak ada):"
ls /opt/lawu ~/llama.cpp ~/.cargo/bin/lawu-server 2>/dev/null && echo "   ✗ MASIH ADA file!" || echo "   ✓ Bersih"

echo "5. Cron Lawu (harus kosong):"
crontab -l 2>/dev/null | grep -iE 'lawu|llama' && echo "   ✗ MASIH ADA cron!" || echo "   ✓ Bersih"
sudo crontab -l -u lawu 2>/dev/null && echo "   ✗ MASIH ADA cron lawu!" || echo "   ✓ Bersih"
ls /etc/cron.d/ | grep -i lawu && echo "   ✗ MASIH ADA cron.d!" || echo "   ✓ Bersih"

echo "6. sysctl Lawu (harus tidak ada):"
ls /etc/sysctl.d/ | grep -i lawu && echo "   ✗ MASIH ADA sysctl!" || echo "   ✓ Bersih"

echo "7. Nginx Lawu (harus tidak ada):"
ls /etc/nginx/sites-enabled/lawu 2>/dev/null && echo "   ✗ MASIH ADA nginx config!" || echo "   ✓ Bersih"

echo "8. Log Lawu (harus tidak ada):"
ls /var/log/lawu 2>/dev/null && echo "   ✗ MASIH ADA log!" || echo "   ✓ Bersih"

echo ""
echo "=========================================="
echo "✅ SERVER BERSIH — siap instalasi Lawu-2.5-Fine."
echo "   Lanjut ke Langkah 1: Ringkasan Arsitektur."
echo "=========================================="`

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
        <Section
          id="cleanup"
          step="0"
          title="Bersihkan Server Sebelum Instalasi"
          desc="Jika server pernah dipakai project Lawu versi lama (atau eksperimen sebelumnya), jalankan langkah ini DULU agar instalasi baru tidak bentrok dengan service/port/cron lama. Skip jika server masih fresh."
        >
          <Alert variant="destructive">
            <ShieldAlert />
            <AlertTitle>Peringatan Data-Loss — Baca sebelum eksekusi!</AlertTitle>
            <AlertDescription>
              <p>
                Langkah <strong>0.D</strong> &amp; <strong>0.E</strong>{' '}
                menghapus permanen direktori, binary, model GGUF, dan user{' '}
                <code className="rounded bg-destructive/10 px-1 py-0.5 text-xs">lawu</code>.
                Pastikan Anda menjalankan{' '}
                <strong>0.C (backup)</strong> terlebih dahulu jika ada data ebook/index/model
                yang ingin disimpan. Semua perintah pakai{' '}
                <code className="rounded bg-destructive/10 px-1 py-0.5 text-xs">|| true</code>{' '}
                agar tidak gagal jika file sudah tidak ada — aman dijalankan ulang.
              </p>
            </AlertDescription>
          </Alert>

          <CodeBlock code={CLEANUP_AUDIT} filename="0.A-audit-server.sh" />
          <CodeBlock code={CLEANUP_STOP} filename="0.B-stop-services.sh" />
          <CodeBlock code={CLEANUP_BACKUP} filename="0.C-backup-old.sh" />
          <CodeBlock code={CLEANUP_REMOVE} filename="0.D-remove-files.sh" />
          <CodeBlock code={CLEANUP_USER} filename="0.E-remove-user.sh" />
          <CodeBlock code={CLEANUP_CONFIG} filename="0.F-clean-configs.sh" />
          <CodeBlock code={CLEANUP_VERIFY} filename="0.G-verify-clean.sh" />
        </Section>

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
