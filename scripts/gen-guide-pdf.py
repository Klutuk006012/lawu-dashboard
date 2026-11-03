#!/usr/bin/env python3
"""
Generator HTML untuk PDF Panduan Setup Server Lawu-2.5-Fine.
Membaca code constants dari guide-view.tsx, generate HTML bersih,
lalu convert ke PDF via html2pdf-next.js (Paged.js).
"""
import re
import sys
from pathlib import Path

GUIDE_VIEW = Path("/home/z/my-project/src/components/lawu/guide-view.tsx")
OUTPUT_HTML = Path("/home/z/my-project/upload/lawu-setup-guide.html")

# ======================================================================
# 1. EXTRACT CODE CONSTANTS DARI guide-view.tsx
# ======================================================================

def extract_constants(source: str) -> dict:
    """Extract semua `const NAME = `...`` dari source TypeScript."""
    constants = {}
    pattern = re.compile(r'^const (\w+) = `', re.MULTILINE)
    matches = list(pattern.finditer(source))
    for m in matches:
        name = m.group(1)
        start = m.end()
        # Cari closing backtick yang TIDAK didahului \\
        idx = start
        while idx < len(source):
            bt_pos = source.find('`', idx)
            if bt_pos == -1:
                break
            # Cek apakah backtick didahului \\
            bs_count = 0
            j = bt_pos - 1
            while j >= 0 and source[j] == '\\':
                bs_count += 1
                j -= 1
            # Jika jumlah backslash genap, backtick tidak di-escape
            if bs_count % 2 == 0:
                raw = source[start:bt_pos]
                content = raw.replace('\\`', '`').replace('\\\\', '\\').replace('\\$', '$')
                constants[name] = content
                break
            idx = bt_pos + 1
    return constants

source = GUIDE_VIEW.read_text(encoding='utf-8')
consts = extract_constants(source)
print(f"Extracted {len(consts)} constants:", file=sys.stderr)
for k in consts:
    print(f"  - {k} ({len(consts[k])} chars)", file=sys.stderr)

# ======================================================================
# 2. STRUKTUR PANDUAN (urutan & metadata)
# ======================================================================

SECTIONS = [
    {
        "id": "cleanup", "step": "0", "title": "Bersihkan Server Sebelum Instalasi",
        "desc": "Jika server pernah dipakai project Lawu versi lama, jalankan langkah ini DULU. Skip jika server masih fresh.",
        "alert": {
            "variant": "destructive",
            "title": "Peringatan Data-Loss — Baca sebelum eksekusi!",
            "body": "Langkah <strong>0.D</strong> &amp; <strong>0.E</strong> menghapus permanen direktori, binary, model GGUF, dan user <code>lawu</code>. Pastikan Anda menjalankan <strong>0.C (backup)</strong> terlebih dahulu jika ada data yang ingin disimpan."
        },
        "blocks": [
            ("0.A-audit-server.sh", "CLEANUP_AUDIT"),
            ("0.B-stop-services.sh", "CLEANUP_STOP"),
            ("0.C-backup-old.sh", "CLEANUP_BACKUP"),
            ("0.D-remove-files.sh", "CLEANUP_REMOVE"),
            ("0.E-remove-user.sh", "CLEANUP_USER"),
            ("0.F-clean-configs.sh", "CLEANUP_CONFIG"),
            ("0.G-verify-clean.sh", "CLEANUP_VERIFY"),
        ]
    },
    {
        "id": "prereq", "step": "1", "title": "Prerequisites & Update Sistem",
        "desc": "Update Debian 13 ke versi terbaru, install build dependencies (gcc, cmake, nginx, ufw, fail2ban, python venv untuk MarkltDown). Semua paket open source dari Debian main repo.",
        "blocks": [
            ("1.A-apt-update.sh", "PREREQ_UPDATE"),
            ("1.B-apt-install-deps.sh", "PREREQ_INSTALL"),
            ("1.C-python-venv-markitdown.sh", "PREREQ_PYTHON"),
        ]
    },
    {
        "id": "user-setup", "step": "2", "title": "Setup User lawu & Struktur Direktori",
        "desc": "Buat system user 'lawu' (isolasi privilege), struktur direktori aplikasi di SSD (/opt/lawu) & data di HDD (/mnt/data).",
        "blocks": [
            ("2.A-create-user-lawu.sh", "USER_SETUP"),
            ("2.B-create-directories.sh", "USER_DIRS"),
        ]
    },
    {
        "id": "disk", "step": "3", "title": "Mount & Format HDD/SSD + Automount Reboot",
        "desc": "Identifikasi SSD (OS) vs HDD (DATA), format ulang HDD 500GB ext4 (WAJIB jika HDD ikut terformat saat install ulang OS), AUTOMOUNT via /etc/fstab dengan nofail (server tetap boot walau HDD error) + test reboot, tuning SSD (TRIM, I/O scheduler).",
        "alert": {
            "variant": "warning",
            "title": "Hati-hati memilih disk! · HDD ikut terformat saat install ulang?",
            "body": "Pastikan <code>/dev/sdb</code> BENAR-BENAR HDD data, bukan disk OS — nama device BISA berubah setelah install ulang, selalu verifikasi dengan <strong>3.A</strong>. Jika HDD ikut terformat installer: data lama hilang, lanjut format ulang di 3.B lalu automount di 3.C, download ulang model GGUF di Langkah 11. WAJIB test reboot (3.C langkah 7-8) — tanpa fstab benar, /mnt/data kosong tiap reboot dan semua service gagal start."
        },
        "blocks": [
            ("3.A-identify-disks.sh", "DISK_IDENTIFY"),
            ("3.B-format-hdd-ext4.sh", "DISK_FORMAT"),
            ("3.C-fstab-automount.sh", "DISK_FSTAB"),
            ("3.D-ssd-tuning.sh", "DISK_SSD_TUNING"),
        ]
    },
    {
        "id": "arsitektur", "step": "4", "title": "Ringkasan Arsitektur",
        "desc": "Alur data end-to-end dari HDD koleksi ebook hingga dashboard web, termasuk firewall & binding localhost-only.",
        "blocks": [
            ("arsitektur.txt", "ARCH"),
        ]
    },
    {
        "id": "sysctl", "step": "5", "title": "Spesifikasi Infrastruktur & Kernel Tuning (sysctl)",
        "desc": "Parameter kernel di /etc/sysctl.d/99-lawu-fine.conf + limits.conf untuk file descriptor besar (Axum + Tantivy).",
        "blocks": [
            ("5.A-apply-sysctl.sh", "SYSCTL"),
            ("5.B-apply-limits.sh", "LIMITS_CONF"),
        ]
    },
    {
        "id": "rust", "step": "6", "title": "Install Rust Toolchain",
        "desc": "Install Rust via rustup (stable + rustfmt + clippy), set RUSTFLAGS target-cpu=native untuk optimasi AVX2 di i5-10400. Verifikasi murni CPU — tidak ada dependency GPU.",
        "blocks": [
            ("6.A-install-rustup.sh", "RUST_INSTALL"),
            ("6.B-verify-rust-cpu.sh", "RUST_VERIFY"),
        ]
    },
    {
        "id": "cargo", "step": "7", "title": "Proyek Cargo — lawu-server",
        "desc": "Inisialisasi project Cargo, paste Cargo.toml + main.rs + schema.rs, build release dengan optimasi native CPU, install binary ke ~/.cargo/bin/.",
        "blocks": [
            ("7.A-cargo-init.sh", "CARGO_NEW"),
            ("~/lawu-server/Cargo.toml", "CARGO_TOML"),
            ("7.B-build-release.sh", "CARGO_BUILD"),
        ]
    },
    {
        "id": "tantivy", "step": "8", "title": "Skema Full-Text Tantivy",
        "desc": "Skema multi-field (title, body, path, file_type, category, pages, size_bytes, indexed_at) dengan BM25 scoring, FAST field untuk sort numerik.",
        "blocks": [
            ("~/lawu-server/src/schema.rs", "TANTIVY"),
        ]
    },
    {
        "id": "api", "step": "9", "title": "Endpoint API Backend (Axum)",
        "desc": "GET /api/stats · POST /api/search (QueryParser + TopDocs) · POST /api/telegram/test. Bind 127.0.0.1:8081 (akses via Nginx reverse proxy).",
        "blocks": [
            ("~/lawu-server/src/main.rs", "AXUM_API"),
        ]
    },
    {
        "id": "llama-build", "step": "10", "title": "Build llama.cpp (Pure CPU)",
        "desc": "Clone repo llama.cpp (MIT license), build dengan GGML_NATIVE=ON + AVX2 + FMA + F16C untuk i5-10400. STATIC linking (binary mandiri), -j 3 (RAM 8GB). Verifikasi binary TIDAK ada dependency CUDA/GPU.",
        "blocks": [
            ("10.A-clone-llamacpp.sh", "LLAMA_CLONE"),
            ("10.B-build-cmake.sh", "LLAMA_BUILD"),
        ]
    },
    {
        "id": "gguf", "step": "11", "title": "Konversi & Kuantisasi Model GGUF",
        "desc": "Opsi 1 (recommended): wget pre-quantized Qwen2.5-Coder-7B Q3_K_M (3.55GB) langsung ke HDD. Opsi 2: convert HF → F16 → quantize sendiri. Q3_K_M optimal untuk RAM 8GB (Q4_K_M 4.4GB terlalu mepet).",
        "blocks": [
            ("11.A-get-model-gguf.sh", "GGUF_CONVERT"),
            ("11.B-quantize-q3_k_m.sh", "GGUF_QUANTIZE"),
        ]
    },
    {
        "id": "korpus", "step": "12", "title": "Korpus Wikipedia-ID (Dataset Pelatihan Indonesia)",
        "desc": "Download dataset indonesian-nlp/wikipedia-id dari HuggingFace (1,44 juta artikel Wikipedia Indonesia, parquet ~345MB), konversi streaming ke markdown per-artikel (pyarrow, RAM ~400MB), lalu trigger indexing Tantivy. Schema docid·title·text pas persis dengan field Tantivy.",
        "alert": {
            "variant": "info",
            "title": "Kenapa korpus Wikipedia-ID penting?",
            "body": "Korpus ebook pribadi biasanya terbatas topiknya. Wikipedia-ID menambah pengetahuan umum Indonesia (sejarah, sains, biografi, geografi) sehingga jawaban RAG jauh lebih kaya. Schema dataset <code>docid·title·text</code> pas persis dengan field Tantivy — tanpa transformasi rumit. Lisensi CC BY-SA (open source — Paten 5 aman)."
        },
        "blocks": [
            ("12.A-download-wikipedia-id.sh", "WIKI_DOWNLOAD"),
            ("12.B-preprocess-wiki-to-markdown.sh", "WIKI_PREPROCESS"),
            ("12.C-verify-and-index.sh", "WIKI_INDEX"),
        ]
    },
    {
        "id": "llama-serve", "step": "13", "title": "Serve llama.cpp (OpenAI-compatible)",
        "desc": "Jalankan llama-server dengan -t 4, -c 2048 (RAM 8GB tuning, mmap default ON — flag --mmap sudah deprecated di b12069+), bind 127.0.0.1:8080. Test endpoint /v1/models & /v1/chat/completions. Estimasi 10-15 tok/s (7B Q3_K_M) di i5-10400.",
        "blocks": [
            ("13.A-serve-llama.sh", "LLAMA_SERVE"),
        ]
    },
    {
        "id": "systemd", "step": "14", "title": "Unit systemd (Auto-restart & Boot)",
        "desc": "Dua service: llama-lawu (inference) & lawu-2.5-fine (API Axum). Hardening systemd (NoNewPrivileges, ProtectSystem, PrivateTmp). Auto-restart on crash.",
        "blocks": [
            ("14.B-write-llama-service.sh", "SYSTEMD_LLAMA"),
            ("14.C-write-axum-service.sh", "SYSTEMD_AXUM"),
            ("14.D-enable-services.sh", "SYSTEMD_ENABLE"),
        ]
    },
    {
        "id": "otomasi", "step": "15", "title": "Otomasi Pemantauan & Operasional",
        "desc": "File watcher inotifywait, backup harian (retensi 7 hari), laporan error harian via Telegram. Cron jobs & environment file /etc/lawu/env.",
        "blocks": [
            ("/opt/lawu/scripts/watch_ebooks.sh", "WATCH_SCRIPT"),
            ("/opt/lawu/scripts/backup_lawu.sh", "BACKUP_SCRIPT"),
            ("/opt/lawu/scripts/send_error_report.sh", "ERROR_REPORT"),
            ("/etc/lawu/env", "ENV_FILE"),
            ("crontab -e (user lawu)", "CRONTAB"),
        ]
    },
    {
        "id": "k6", "step": "16", "title": "Pengujian Beban (Load Testing k6)",
        "desc": "Install k6 (AGPL-3.0, open source). Target: p95 latency /api/search < 300ms dengan 20 VUs selama 2 menit. Error rate < 1%.",
        "blocks": [
            ("16.A-install-k6.sh", "K6_INSTALL"),
            ("~/src/load_test.js", "K6"),
        ]
    },
    {
        "id": "nginx", "step": "17", "title": "Reverse Proxy Nginx",
        "desc": "Satu port 80: dashboard/API Rust di root, inference llama.cpp di /v1/. Security headers, client_max_body_size 100MB untuk upload ebook, buffering off untuk streaming chat.",
        "blocks": [
            ("17-apply-nginx-config.sh", "NGINX"),
        ]
    },
    {
        "id": "integrasi", "step": "18", "title": "Integrasi dengan Dashboard",
        "desc": "Hubungkan dashboard ini ke server nyata: setting endpoint LLM di tab Pengaturan, arahkan fetch ke Nginx :80, setup Telegram bot token.",
        "blocks": [
            ("integrasi-dashboard.txt", "INTEGRATE"),
        ]
    },
    {
        "id": "hardening", "step": "19", "title": "⚡ Hardening Server (TERAKHIR — setelah semua service jalan)",
        "desc": "⭐ POSISI TERAKHIR — get it running FIRST, lock it down LAST. Default deny incoming (allow 22/80/443), SSH key-only, fail2ban. HANYA jalankan setelah semua service aktif + test sukses.",
        "alert": {
            "variant": "warning",
            "title": "Jangan terkunci dari server!",
            "body": "Sebelum enable UFW &amp; disable SSH password, PASTIKAN Anda sudah setup SSH key (Langkah 19.C) DAN test login dengan key di terminal terpisah. Jika gagal, kembalikan config backup: sudo cp /etc/ssh/sshd_config.bak.* /etc/ssh/sshd_config && sudo systemctl restart sshd."
        },
        "blocks": [
            ("19.A-ufw-firewall.sh", "FIREWALL_UFW"),
            ("19.B-sshd-hardening.sh", "SSH_HARDENING"),
            ("19.C-ssh-key-setup.sh", "SSH_KEY"),
            ("19.D-fail2ban-sshd.sh", "FAIL2BAN"),
        ]
    },
    {
        "id": "checklist", "step": "20", "title": "Final Go-Live Checklist",
        "desc": "Audit terakhir SEBELUM buka server ke publik. Cek sistem, disk, firewall, services, ports, API health, cron, backup, memory. Semua harus sehat.",
        "alert": {
            "variant": "info",
            "title": "Jalankan checklist ini sebagai verifikasi akhir",
            "body": "Skrip ini akan cetak status real-time dari semua komponen. Periksa setiap baris — jika ada <code>✗</code> atau service <code>inactive</code>, FIX dulu sebelum buka port 80 ke publik."
        },
        "blocks": [
            ("20-go-live-checklist.sh", "CHECKLIST_SCRIPT"),
        ]
    },
]

# ======================================================================
# 3. GENERATE HTML
# ======================================================================

def esc(s: str) -> str:
    """HTML escape."""
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

# Build TOC entries
toc_items = "\n".join(
    f'<li class="toc-item"><span class="toc-step">{s["step"]}</span>'
    f'<a href="#{s["id"]}" class="toc-link">{esc(s["title"])}</a></li>'
    for s in SECTIONS
)

# Build sections HTML
sections_html = []
for sec in SECTIONS:
    alert_html = ""
    if sec.get("alert"):
        a = sec["alert"]
        variant_class = f"alert-{a['variant']}"
        icon_char = '⚠' if a['variant']=='destructive' else '!' if a['variant']=='warning' else 'ℹ'
        alert_html = f"""
        <div class="alert {variant_class}">
          <div class="alert-icon">{icon_char}</div>
          <div class="alert-content">
            <div class="alert-title">{a['title']}</div>
            <div class="alert-body">{a['body']}</div>
          </div>
        </div>"""

    blocks_html = ""
    for filename, const_name in sec["blocks"]:
        code = consts.get(const_name, f"# ERROR: constant {const_name} not found")
        lang = filename.rsplit('.', 1)[-1] if '.' in filename else 'sh'
        blocks_html += f"""
        <div class="code-block">
          <div class="code-header">
            <span class="code-filename">{esc(filename)}</span>
            <span class="code-lang">{esc(lang)}</span>
          </div>
          <pre class="code-content"><code>{esc(code)}</code></pre>
        </div>"""

    sections_html.append(f"""
    <section id="{sec['id']}" class="guide-section">
      <div class="section-header">
        <span class="step-badge">{sec['step']}</span>
        <div>
          <h2 class="section-title">{esc(sec['title'])}</h2>
          <p class="section-desc">{esc(sec['desc'])}</p>
        </div>
      </div>
      {alert_html}
      <div class="section-blocks">
        {blocks_html}
      </div>
    </section>""")

sections_html_str = "\n".join(sections_html)

html = f"""<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<title>Panduan Setup Server Lawu-2.5-Fine</title>
<style>
  /* ====== PAGE SETUP ====== */
  @page {{
    size: A4;
    margin: 0;
  }}

  /* Page numbering via Paged.js */
  @page {{
    @bottom-center {{
      content: counter(page);
      font-family: 'Liberation Sans', sans-serif;
      font-size: 9pt;
      color: #666;
    }}
  }}
  @page cover {{
    @bottom-center {{ content: none; }}
  }}

  /* ====== RESET ====== */
  * {{
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }}
  html, body {{
    margin: 0;
    padding: 0;
    background: #ffffff;
    font-family: 'Liberation Sans', 'DejaVu Sans', sans-serif;
    font-size: 10.5pt;
    line-height: 1.55;
    color: #1a1a1a;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }}

  /* ====== COVER PAGE ====== */
  .cover {{
    page: cover;
    width: 210mm;
    height: 297mm;
    background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%);
    color: #ffffff;
    padding: 25mm 20mm;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    position: relative;
    overflow: hidden;
    break-after: page;
  }}
  .cover::before {{
    content: "";
    position: absolute;
    top: -50mm; right: -50mm;
    width: 120mm; height: 120mm;
    background: radial-gradient(circle, rgba(52,168,83,0.15) 0%, transparent 70%);
    border-radius: 50%;
  }}
  .cover::after {{
    content: "";
    position: absolute;
    bottom: -40mm; left: -40mm;
    width: 100mm; height: 100mm;
    background: radial-gradient(circle, rgba(234,67,53,0.12) 0%, transparent 70%);
    border-radius: 50%;
  }}
  .cover-top {{
    position: relative;
    z-index: 2;
  }}
  .cover-badge {{
    display: inline-block;
    padding: 4px 12px;
    background: rgba(52,168,83,0.2);
    border: 1px solid rgba(52,168,83,0.5);
    border-radius: 4px;
    font-size: 9pt;
    font-weight: 600;
    color: #81c995;
    letter-spacing: 0.5px;
    margin-bottom: 16mm;
  }}
  .cover-title {{
    font-size: 36pt;
    font-weight: 800;
    line-height: 1.1;
    letter-spacing: -0.5px;
    margin-bottom: 6mm;
  }}
  .cover-subtitle {{
    font-size: 14pt;
    font-weight: 400;
    color: #cbd5e1;
    margin-bottom: 12mm;
    line-height: 1.4;
  }}
  .cover-tags {{
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 8mm;
  }}
  .cover-tag {{
    padding: 3px 10px;
    background: rgba(255,255,255,0.08);
    border: 1px solid rgba(255,255,255,0.15);
    border-radius: 3px;
    font-size: 8.5pt;
    color: #e2e8f0;
  }}
  .cover-middle {{
    position: relative;
    z-index: 2;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 8px;
    padding: 8mm 10mm;
    margin: 8mm 0;
  }}
  .cover-middle h3 {{
    font-size: 11pt;
    color: #34a853;
    margin-bottom: 4mm;
    font-weight: 600;
  }}
  .cover-middle p {{
    font-size: 10pt;
    color: #cbd5e1;
    line-height: 1.5;
  }}
  .cover-bottom {{
    position: relative;
    z-index: 2;
    border-top: 1px solid rgba(255,255,255,0.1);
    padding-top: 6mm;
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    font-size: 9pt;
    color: #94a3b8;
  }}
  .cover-bottom-left strong {{
    color: #e2e8f0;
    font-size: 10pt;
    display: block;
    margin-bottom: 2mm;
  }}
  .cover-version {{
    text-align: right;
  }}
  .cover-version strong {{
    color: #34a853;
    font-size: 11pt;
  }}

  /* ====== TOC PAGE ====== */
  .toc {{
    padding: 18mm 20mm;
    break-after: page;
    break-before: page;
  }}
  .toc h1 {{
    font-size: 22pt;
    font-weight: 700;
    color: #0f172a;
    margin-bottom: 4mm;
    padding-bottom: 4mm;
    border-bottom: 2px solid #34a853;
  }}
  .toc-subtitle {{
    font-size: 10pt;
    color: #64748b;
    margin-bottom: 8mm;
  }}
  .toc-list {{
    list-style: none;
  }}
  .toc-item {{
    display: flex;
    align-items: baseline;
    gap: 8px;
    padding: 3mm 0;
    border-bottom: 1px dotted #e2e8f0;
    font-size: 10.5pt;
  }}
  .toc-step {{
    display: inline-block;
    min-width: 24px;
    height: 24px;
    line-height: 24px;
    text-align: center;
    background: #0f172a;
    color: #ffffff;
    border-radius: 50%;
    font-size: 9pt;
    font-weight: 700;
    flex-shrink: 0;
  }}
  .toc-link {{
    color: #1e293b;
    text-decoration: none;
    font-weight: 500;
  }}

  /* ====== CONTENT PAGES ====== */
  .content {{
    padding: 16mm 18mm 20mm 18mm;
  }}

  .guide-section {{
    break-inside: avoid-page;
    margin-bottom: 8mm;
  }}
  .guide-section > .section-header {{
    break-after: avoid;
  }}

  .section-header {{
    display: flex;
    gap: 10px;
    align-items: flex-start;
    margin-bottom: 5mm;
    padding-bottom: 3mm;
    border-bottom: 1px solid #e2e8f0;
  }}
  .step-badge {{
    display: inline-block;
    min-width: 28px;
    height: 28px;
    line-height: 28px;
    text-align: center;
    background: #0f172a;
    color: #ffffff;
    border-radius: 50%;
    font-size: 10pt;
    font-weight: 700;
    flex-shrink: 0;
  }}
  .section-title {{
    font-size: 14pt;
    font-weight: 700;
    color: #0f172a;
    line-height: 1.2;
    margin-bottom: 2mm;
  }}
  .section-desc {{
    font-size: 9.5pt;
    color: #64748b;
    line-height: 1.45;
  }}

  /* ====== ALERTS ====== */
  .alert {{
    display: flex;
    gap: 10px;
    padding: 4mm 5mm;
    border-radius: 6px;
    border-left: 4px solid;
    margin: 4mm 0;
    break-inside: avoid;
  }}
  .alert-destructive {{
    background: #fef2f2;
    border-color: #dc2626;
  }}
  .alert-warning {{
    background: #fffbeb;
    border-color: #d97706;
  }}
  .alert-info {{
    background: #eff6ff;
    border-color: #2563eb;
  }}
  .alert-icon {{
    font-size: 14pt;
    font-weight: 700;
    flex-shrink: 0;
    width: 20px;
    text-align: center;
  }}
  .alert-destructive .alert-icon {{ color: #dc2626; }}
  .alert-warning .alert-icon {{ color: #d97706; }}
  .alert-info .alert-icon {{ color: #2563eb; }}
  .alert-content {{
    flex: 1;
  }}
  .alert-title {{
    font-size: 10.5pt;
    font-weight: 700;
    margin-bottom: 2mm;
    color: #0f172a;
  }}
  .alert-body {{
    font-size: 9.5pt;
    color: #475569;
    line-height: 1.5;
  }}
  .alert-body code {{
    background: rgba(0,0,0,0.06);
    padding: 1px 4px;
    border-radius: 3px;
    font-family: 'Liberation Mono', 'DejaVu Sans Mono', monospace;
    font-size: 8.5pt;
  }}

  /* ====== CODE BLOCKS ====== */
  .code-block {{
    margin: 3mm 0;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    overflow: hidden;
    break-inside: avoid;
    background: #fafafa;
  }}
  .code-header {{
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 2mm 4mm;
    background: #1e293b;
    color: #e2e8f0;
  }}
  .code-filename {{
    font-family: 'Liberation Mono', 'DejaVu Sans Mono', monospace;
    font-size: 8.5pt;
    font-weight: 500;
  }}
  .code-lang {{
    font-family: 'Liberation Mono', monospace;
    font-size: 7.5pt;
    padding: 1px 6px;
    background: rgba(255,255,255,0.1);
    border-radius: 3px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }}
  .code-content {{
    padding: 4mm 5mm;
    margin: 0;
    background: #f8fafc;
    overflow-x: auto;
    font-family: 'Liberation Mono', 'DejaVu Sans Mono', 'Courier New', monospace;
    font-size: 8pt;
    line-height: 1.45;
    color: #1e293b;
    white-space: pre;
    word-wrap: normal;
  }}
  .code-content code {{
    font-family: inherit;
    background: none;
    padding: 0;
  }}

  /* ====== FOOTER CARD ====== */
  .footer-card {{
    margin-top: 10mm;
    padding: 6mm 8mm;
    background: #f0fdf4;
    border: 1px solid #bbf7d0;
    border-radius: 8px;
    break-inside: avoid;
  }}
  .footer-card h3 {{
    font-size: 11pt;
    color: #137333;
    margin-bottom: 3mm;
  }}
  .footer-card p {{
    font-size: 9.5pt;
    color: #475569;
    line-height: 1.55;
  }}
</style>
</head>
<body>

<!-- ====== COVER PAGE ====== -->
<div class="cover">
  <div class="cover-top">
    <div class="cover-badge">PANDUAN IMPLEMENTASI · v3.2.0</div>
    <h1 class="cover-title">Panduan Setup Server<br>Lawu-2.5-Fine</h1>
    <p class="cover-subtitle">Panduan komprehensif 21 langkah dari server kosong sampai production-ready untuk Debian 13 dengan Rust + Axum + Tantivy + llama.cpp (Pure CPU) + Korpus Wikipedia-ID.</p>
    <div class="cover-tags">
      <span class="cover-tag">Debian 13 · Linux 6.x</span>
      <span class="cover-tag">Rust · Axum · Tantivy · Rayon</span>
      <span class="cover-tag">llama.cpp GGUF (Q3_K_M)</span>
      <span class="cover-tag">Pure CPU · No GPU</span>
      <span class="cover-tag">Open Source (MIT/Apache)</span>
    </div>
  </div>

  <div class="cover-middle">
    <h3>Target Hardware</h3>
    <p><strong>Intel Core i5-10400</strong> (6 Core / 12 Thread · AVX2 · 2.9–4.3 GHz) · <strong>8 GB DDR4</strong> · <strong>SSD 128 GB</strong> (OS — Debian 13) · <strong>HDD 500 GB</strong> (DATA — automount fstab nofail · koleksi ebook &amp; index Tantivy).</p>
  </div>

  <div class="cover-bottom">
    <div class="cover-bottom-left">
      <strong>Lawu-2.5-Fine</strong>
      AI Model Cerdas, Irit Budget · Muslim Ahlussunnah wal Jama&apos;ah
    </div>
    <div class="cover-version">
      Versi Dokumen<br><strong>3.2.0 · 2025</strong>
    </div>
  </div>
</div>

<!-- ====== TABLE OF CONTENTS ====== -->
<div class="toc">
  <h1>Daftar Isi</h1>
  <p class="toc-subtitle">21 langkah komprehensif — dari pembersihan server hingga go-live checklist.</p>
  <ul class="toc-list">
    {toc_items}
  </ul>

  <div class="footer-card" style="margin-top: 12mm;">
    <h3>Urutan Eksekusi yang Disarankan</h3>
    <p>Langkah 0 (bersihkan) → 1 (prerequisites) → 2 (user &amp; dir) → 3 (disk + AUTOMOUNT fstab, WAJIB test reboot) → 4 (arsitektur) → 5 (sysctl) → 6 (Rust) → 7 (Cargo) → 8-9 (Tantivy &amp; Axum API) → 10-11 (llama.cpp build, GGUF Q3_K_M) → <strong>12 (korpus Wikipedia-ID — dataset pelatihan Indonesia)</strong> → 13 (serve) → 14 (systemd) → 15 (otomasi) → 16 (load test) → 17 (Nginx) → 18 (integrasi) → <strong>19 (hardening — TERAKHIR!)</strong> → 20 (go-live checklist).</p>
  </div>
</div>

<!-- ====== CONTENT ====== -->
<div class="content">
  {sections_html_str}

  <div class="footer-card">
    <h3>✓ Setelah Langkah 20 Selesai</h3>
    <p>Server Lawu-2.5-Fine Anda siap menerima traffic publik via port 80 (Nginx). Inference &amp; API tetap bind localhost-only (Paten keamanan). HDD /mnt/data ter-automount via fstab nofail (aman saat reboot). Korpus = ebook pribadi + 1,44 juta artikel Wikipedia-ID. Backup harian aktif, fail2ban menjaga SSH, UFW membatasi port terbuka. <strong>Paten 1-7 terpenuhi semua:</strong> Rust backend, murni CPU, Linux only, open source, parallel Rayon, Islam Ahlussunnah wal Jama&apos;ah.</p>
  </div>
</div>

</body>
</html>
"""

OUTPUT_HTML.write_text(html, encoding='utf-8')
print(f"\n✓ HTML written: {OUTPUT_HTML} ({OUTPUT_HTML.stat().st_size} bytes)", file=sys.stderr)
