# PRD — Lawu-2.5-Fine · Server Setup & Deployment

**Versi:** 3.1.0
**Update:** 2026-11-03
**Perubahan major v3.1.0:** Hardening server dipindah ke LANGKAH TERAKHIR (sebelum go-live checklist). Setup: **jalan dulu → lalu amankan**.

---

## 1. Ringkasan Proyek

Lawu-2.5-Fine adalah AI model Indonesia ("AI Model Cerdas, Irit Budget") untuk search engine ebook dengan 7 Paten terkunci yang TIDAK BOLEH dilanggar:

| # | Paten | Status |
|---|---|---|
| 1 | **Rust** = satu-satunya backend (Axum + Tantivy) | ✅ Terpenuhi |
| 2 | **Vue.js 3** = satu-satunya frontend (Vite + Pinia) | ✅ Terpenuhi |
| 3 | **Pure CPU+RAM+SSD** = NO GPU, NO cloud API | ✅ Terverifikasi (`ldd` bersih) |
| 4 | **Linux only** = Debian 13 (trixie) | ✅ Terpenuhi |
| 5 | **Open source** = MIT/Apache/BSD/GPL saja | ✅ Terpenuhi |
| 6 | **Parallel RARE** = 5-way retrieval + 1 LLM call | ✅ Terpenuhi |
| 7 | **Islam** = Ahlussunnah wal Jama'ah, permanen | ✅ Terpenuhi |

**Target hardware:**
- CPU: Intel Core i5-10400 (6C/12T, AVX2)
- RAM: **8 GB DDR4** (bukan 16GB — semua tuning disesuaikan)
- Disk: SSD 128 GB (OS) + HDD 500 GB (DATA — ebook, index, models, backup)

---

## 2. Prinsip Setup yang BENAR (Pelajaran Penting v3.1.0)

> ⚠️ **Pelajaran mahal dari incident 2026-11-03:**
> Hardening (disable SSH password) di awal setup menyebabkan user terkunci dari server
> sendiri → reinstall OS. Ini kesalahan urutan, bukan kesalahan teknik.

**Prinsip deployment yang benar:**

```
1. JALANKAN DULU (get it running)
   ↓ Install semua service, test endpoint, debug dari SSH password biasa
2. LALU AMANKAN (lock it down)
   ↓ Setelah SEMUA service jalan + test sukses → baru hardening
3. TERAKHIR: GO-LIVE CHECKLIST
   ↓ Audit final sebelum buka ke publik
```

**Alasan teknis:**
- SSH password aktif = debugging mudah (bisa SSH dari laptop kapan saja)
- UFW belum aktif = tidak ada risiko port blocked salah konfigurasi
- fail2ban belum jalan = tidak ada risiko IP sendiri ke-ban
- Kalau ada error setup, fix-nya cepat tanpa harus akses konsol fisik

---

## 3. Urutan Langkah Setup yang BENAR (v3.1.0)

### FASE 1 — Persiapan Server (Langkah 0-3)

| Langkah | Judul | Isi |
|---|---|---|
| **0** | Bersihkan Server | Audit → stop service lama → backup → hapus → verify |
| **1** | Prerequisites | apt update + install build deps, nginx, python venv |
| **2** | User lawu & Direktori | useradd lawu (no sudo), /opt/lawu (SSD), /mnt/data (HDD), symlink ~/models → /mnt/data/models |
| **3** | Mount & Format HDD | fdisk → mkfs.ext4 → fstab → TRIM → SSD tuning |

### FASE 2 — Build & Deploy Services (Langkah 4-12)

| Langkah | Judul | Isi |
|---|---|---|
| **4** | Arsitektur | Diagram end-to-end alur data |
| **5** | Kernel Tuning | sysctl (vm.swappiness=40 utk RAM 8GB) + limits.conf |
| **6** | Install Rust | rustup stable, RUSTFLAGS=-C target-cpu=native, verify ldd murni CPU |
| **7** | Project Cargo | cargo new lawu-server + Cargo.toml (axum 0.8, tantivy 0.24) + build release |
| **8** | Skema Tantivy | schema.rs multi-field BM25 |
| **9** | Axum API | main.rs: /api/stats, /api/search, /api/telegram/test |
| **10** | Build llama.cpp | clone ggml-org/llama.cpp tag b12069+, cmake STATIC linking, -j 3 (RAM 8GB) |
| **11** | Model GGUF | wget pre-quantized Qwen2.5-Coder-7B Q3_K_M (3.55GB) ke HDD |
| **12** | Serve llama.cpp | llama-server -t 4 -c 2048, test /v1/chat/completions |

### FASE 3 — Otomasi & Dashboard (Langkah 13-17)

| Langkah | Judul | Isi |
|---|---|---|
| **13** | systemd Units | llama-lawu.service + lawu-2.5-fine.service (auto-restart, boot) |
| **14** | Otomasi | watch_ebooks.sh, backup_lawu.sh, send_error_report.sh, cron, /etc/lawu/env |
| **15** | Load Testing | k6: p95 /api/search < 300ms dengan 20 VUs |
| **16** | Nginx Reverse Proxy | port 80 → Axum :8081 + llama :8080 (/v1/) |
| **17** | Integrasi Dashboard | Vue.js 3 frontend ↔ API Rust + llama.cpp |

### FASE 4 — Amankan & Go-Live (Langkah 18-19)

| Langkah | Judul | Isi |
|---|---|---|
| **18** | ⭐ **HARDENING** | UFW (deny incoming, allow 22/80/443) + SSH key-only + fail2ban — **DIPINDAH KE SINI (terakhir sebelum go-live)** |
| **19** | Go-Live Checklist | Audit final: sistem, disk, firewall, services, ports, API health, cron, backup, memory |

---

## 4. Hardening — Detail Langkah 18 (v3.1.0)

Hardening HANYA dijalankan setelah:
- ✅ Semua service jalan (systemd active, HTTP 200)
- ✅ Test endpoint sukses (chat completion bisa respon)
- ✅ Load test lulus (p95 < 300ms)
- ✅ Dashboard Vue.js connect ke API

**Urutan hardening yang aman:**

```bash
# 1) PASTIKAN SSH KEY SUDAH TERSETUP + TEST LOGIN DENGAN KEY
#    (di laptop: ssh -i ~/.ssh/lawu_admin admin@server — harus sukses)
# 2) BARU disable password auth
# 3) Enable UFW (test rule 22 dulu sebelum deny)
# 4) fail2ban TERAKHIR (setelah semua lainnya aman)
```

**Jangan pernah:**
- ❌ Disable SSH password sebelum SSH key terverifikasi
- ❌ Enable UFW default-deny sebelum test akses current
- ❌ Hardening saat masih ada langkah setup yang belum selesai

---

## 5. Stack Teknologi & Versi (Terverifikasi di Server Asli)

| Komponen | Versi | Catatan |
|---|---|---|
| Debian | 13 (trixie) | Kernel 6.x |
| Rust | 1.99.1 (2026-10-13) | via rustup, stable |
| Axum | 0.8 | (bukan 0.7 — incompatible dengan Rust 1.99) |
| Tantivy | 0.24.2 | (bukan 0.22 — API berubah) |
| tokio | 1.x | full features |
| llama.cpp | b12069 (build 12069, commit e6192de0a) | ggml-org repo, static linking |
| Model | Qwen2.5-Coder-7B Q3_K_M | 3.55GB, ~10-15 tok/s di i5-10400 |
| Python | 3.13 | venv untuk markitdown |
| Nginx | 1.26+ | reverse proxy |
| Frontend | Vue.js 3 + Vite + Pinia | (Paten 2 — BUKAN Next.js) |

---

## 6. Konfigurasi RAM 8GB (Bukan 16GB!)

**RAM budget saat inference (7B Q3_K_M):**
```
Model mmap load    : ~3.6GB
KV cache ctx 2048  : ~0.5GB
Axum + Tantivy     : ~0.6GB
OS + page cache    : ~3.3GB
─────────────────────────────
TOTAL              : ~8.0GB (headroom ~1.3GB)
```

**Parameter yang disesuaikan:**

| Parameter | Nilai (RAM 8GB) | Nilai lama (16GB) |
|---|---|---|
| `vm.swappiness` | **40** | 10 |
| `cmake --build -j` | **3** | 6 |
| `llama-server -t` | **4** | 6 |
| `llama-server -c` | **2048** | 4096 |
| Model default | **Q3_K_M (3.6GB)** | Q4_K_M (4.4GB) |

---

## 7. Struktur Direktori

```
SSD 128GB (OS):
├── /opt/lawu/              # scripts, binary, logs (755/640)
├── /home/lawu/
│   ├── src/llama.cpp/      # source tree (build di sini — cepat)
│   ├── .cargo/bin/lawu-server  # binary Axum API
│   └── models -> /mnt/data/models  # SYMLINK ke HDD

HDD 500GB (DATA — /dev/sdb1, ext4, noatime):
├── /mnt/data/
│   ├── ebooks/             # PDF·EPUB·DOCX koleksi
│   │   ├── incoming/       # file watcher (inotifywait)
│   │   └── processed/
│   ├── processed_markdowns/  # hasil ekstraksi MarkltDown
│   ├── tantivy_index/      # BM25 index
│   ├── backup/             # retensi 7 hari
│   └── models/             # GGUF (fisik di sini!)
```

---

## 8. Status Setup Saat Ini (Server Asli)

| Langkah | Status | Catatan |
|---|---|---|
| 0. Bersihkan server | ✅ | |
| 1. Prerequisites | ✅ | cmake 3.31.6, gcc 14.2.0 |
| 2. User & direktori | ✅ | lawu + symlink models |
| 3. Mount HDD | ✅ | 458GB ext4 di /mnt/data |
| 4. Arsitektur | ✅ | |
| 5. sysctl | ✅ | vm.swappiness=40 |
| 6. Rust toolchain | ✅ | rustc 1.99.1, cargo 1.99.1 |
| 7. Cargo project | ✅ | lawu-server v0.1.0 built (Paten 3 ✓) |
| 8. Tantivy schema | ✅ | |
| 9. Axum API | ✅ | binary built, ldd bersih |
| 10. llama.cpp build | ✅ | b12069, static linking |
| 11. Model GGUF | ✅ | Q3_K_M 3.55GB di HDD |
| 12. Serve | 🔄 **IN PROGRESS** | test endpoint |
| 13. systemd | ⏳ | |
| 14. Otomasi | ⏳ | |
| 15. k6 | ⏳ | |
| 16. Nginx | ⏳ | |
| 17. Integrasi | ⏳ | |
| 18. **Hardening** | ⏳ | **TERAKHIR!** |
| 19. Go-Live | ⏳ | |

**Incident log:**
- 2026-11-03: User terkunci dari server setelah hardening di Langkah 4 lama (SSH password disabled sebelum semua service jalan). Solusi: reinstall OS + susun ulang urutan (v3.1.0 — hardening pindah ke Langkah 18).

---

## 9. Kata Kunci dari Incident (Pelajaran Terbaik)

1. **"Get it running first, then lock it down"** — bukan sebaliknya
2. **Jangan pernah paste block yang mengandung `exit`** — shell jalan tanpa syarat
3. **Sediakan jalur rollback** sebelum hardening (backup sshd_config, dst.)
4. **Test SSH key SEBELUM disable password** — selalu
5. **Dokumentasikan user admin** — siapa yang punya sudo, password-nya apa
