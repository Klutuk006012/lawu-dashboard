'use client'

import * as React from 'react'
import {
  CheckCircle2,
  ListChecks,
  ShieldAlert,
  Terminal,
} from 'lucide-react'
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
// ======================================================================

const CLEANUP_AUDIT = `# 0.A — Audit server kotor (JALANKAN DULU, lihat apa yang ada sebelum bersihkan)
# Paten 3: murni CPU, tanpa GPU — audit hanya mencari sisa project Lawu lama

echo "=== AUDIT SERVER LAWU LAMA ==="

echo "1. Proses yang dengarkan port Lawu (80/8080/8081):"
sudo ss -tlnp | grep -E ':(80|8080|8081)\\b' || echo "   (kosong)"

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
sudo ss -tlnp | grep -E ':(8080|8081)\\b' \\
  | grep -oP 'pid=\\K[0-9]+' | sort -u \\
  | while read -r pid; do sudo kill "$pid" 2>/dev/null || true; done

# 4) Hapus cron jobs Lawu lama (user crontab + /etc/cron.d)
sudo crontab -r -u lawu 2>/dev/null || true
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

sudo du -sh "$BACKUP_DIR"/* 2>/dev/null
sudo chmod -R lawu:lawu "$BACKUP_DIR" 2>/dev/null || true
echo "Backup Lawu lama tersimpan di: $BACKUP_DIR"`

const CLEANUP_REMOVE = `# 0.D — Hapus direktori & binary Lawu lama
# PERINGATAN: langkah ini MENGHAPUS PERMANEN. Pastikan 0.C (backup) sudah dilakukan.

# 1) Hapus direktori aplikasi Lawu (/opt/lawu berisi skrip watch/backup/reindex)
sudo rm -rf /opt/lawu

# 2) Hapus binary lawu-server lama
rm -f ~/.cargo/bin/lawu-server

# 3) Hapus source tree llama.cpp lama (akan di-clone ulang di Langkah 11)
rm -rf ~/llama.cpp

# 4) Hapus model GGUF Lawu lama (HATI-HATI — file besar)
#    Jika ingin simpan model agar tidak perlu re-download/re-quant, COMMENT baris ini.
rm -f ~/models/lawu-2.5-fine-*.gguf

# 5) Hapus index Tantivy & markdown hasil ekstraksi lama
#    (JIKA ingin mulai indexing dari nol. Jika ingin pakai index lama, COMMENT baris ini.)
sudo rm -rf /mnt/data/tantivy_index
sudo rm -rf /mnt/data/processed_markdowns

# 6) Kosongkan incoming/ (file ebook yang belum diproses)
# sudo rm -rf /mnt/data/ebooks/incoming/*`

const CLEANUP_USER = `# 0.E — Hapus user & group 'lawu' lama
# User ini akan dibuat ulang bersih di Langkah 2.
# Jika server Anda TIDAK pernah pakai user 'lawu' sebelumnya, lewati langkah ini.

# 1) Pastikan tidak ada proses yang masih berjalan sebagai user lawu
sudo pkill -u lawu 2>/dev/null || true
sleep 2

# 2) Hapus user lawu lama BESERTA home directory-nya (-r)
sudo userdel -r lawu 2>/dev/null || true

# 3) Hapus group 'lawu' jika masih tersisa
sudo groupdel lawu 2>/dev/null || true

# 4) Verifikasi tidak ada file sisa milik UID lawu lama (orphaned files)
sudo find / -path /proc -prune -o -path /sys -prune -o -path /dev -prune \\
  -path /run -prune -o -nouser -print 2>/dev/null | head -20 || true`

const CLEANUP_CONFIG = `# 0.F — Bersihkan sysctl, Nginx config, dan log Lawu lama

# 1) Hapus sysctl custom Lawu lama (akan dibuat ulang bersih di Langkah 6)
sudo rm -f /etc/sysctl.d/99-lawu-fine.conf
sudo sysctl --system 2>/dev/null || true

# 2) Hapus Nginx config Lawu lama (akan dibuat ulang bersih di Langkah 17)
sudo rm -f /etc/nginx/sites-enabled/lawu
sudo rm -f /etc/nginx/sites-available/lawu
sudo nginx -t 2>/dev/null && sudo systemctl reload nginx 2>/dev/null || true

# 3) Bersihkan log Lawu lama (file log + entry journald lama)
sudo rm -rf /var/log/lawu
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
sudo ss -tlnp | grep -E ':(8080|8081)\\b' && echo "   ✗ MASIH ADA proses!" || echo "   ✓ Bersih"

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
echo "   Lanjut ke Langkah 1: Prerequisites & Update Sistem."
echo "=========================================="`

// ======================================================================
// LANGKAH 1 — PREREQUISITES & UPDATE SISTEM
// ======================================================================

const PREREQ_UPDATE = `# 1.A — Update & upgrade sistem Debian 13 (trixie)
# Jalankan sebagai user biasa dengan sudo. Pastikan internet stabil.

sudo apt update && sudo apt full-upgrade -y
sudo apt autoremove -y

# Verifikasi versi Debian
cat /etc/debian_version
# Harus cetak: 13.x (trixie)`

const PREREQ_INSTALL = `# 1.B — Install build dependencies & tools
# Semua paket ini open-source (Debian main repo) — Paten 5: open source terpenuhi.

sudo apt install -y \\
  build-essential \\
  cmake \\
  ninja-build \\
  pkg-config \\
  git \\
  curl \\
  wget \\
  unzip \\
  tar \\
  ca-certificates \\
  libssl-dev \\
  libcurl4-openssl-dev \\
  libsqlite3-dev \\
  procps \\
  nginx \\
  ufw \\
  fail2ban \\
  inotify-tools \\
  python3 \\
  python3-pip \\
  python3-venv \\
  jq \\
  htop \\
  btop \\
  ncdu \\
  strace \\
  lsof \\
  sqlite3

# Verifikasi paket kunci terpasang
cmake --version | head -1
gcc --version | head -1
nginx -v 2>&1
ufw version`

const PREREQ_PYTHON = `# 1.C — Python virtualenv untuk MarkltDown (ekstraksi teks ebook)
# Paten 5: MarkltDown = MIT (Microsoft) — open source, aman dipakai.
# JANGAN pakai pip global (PEP 668 protected). Gunakan venv.

python3 -m venv ~/venvs/lawu
source ~/venvs/lawu/bin/activate

# Install MarkltDown di dalam venv (tidak mengganggu system Python)
pip install --upgrade pip
pip install markitdown

# Tes MarkltDown — harus cetak teks dari PDF/DOCX dummy
echo "# test" > /tmp/test.md
markitdown /tmp/test.md | head -5
deactivate`

// ======================================================================
// LANGKAH 2 — SETUP USER lawu & DIREKTORI
// ======================================================================

const USER_SETUP = `# 2.A — Buat user & group 'lawu' (system user, no sudo)
# >>> RUN AS: user admin Anda (yang punya sudo) <<<
# User 'lawu' akan menjalankan semua service Lawu — isolasi privilege (Paten keamanan).
# User lawu TIDAK diberi sudo (intentional — principle of least privilege).

# 1) Buat group 'lawu' jika belum ada
sudo groupadd -f lawu

# 2) Buat user system 'lawu' dengan home directory
sudo useradd -m -d /home/lawu -s /bin/bash -g lawu lawu

# 3) Set password kuat untuk user lawu (untuk 'su - lawu' saat debugging dari user admin)
sudo passwd lawu

# 4) Verifikasi user dibuat (tanpa sudo di grup)
id lawu
ls -ld /home/lawu

# 5) VERIFIKASI lawu TIDAK di sudoers (ini BENAR — by design)
sudo -u lawu sudo -n whoami 2>&1 | grep -q 'not in the sudoers' \\
  && echo "✓ lawu TIDAK punya sudo (correct — service user)" \\
  || echo "✗ lawu punya sudo (HAPUS: sudo deluser lawu sudo)"

# 6) Untuk setup service nanti, gunakan 'sudo -u lawu <cmd>' dari user admin
#    Contoh: sudo -u lawu git clone ... (build sebagai lawu, tanpa sudo)
# Atau switch ke lawu: 'sudo su - lawu' lalu exit kembali ke admin

# CATATAN: Semua perintah sudo di Langkah 0-6, 14-17 jalankan sebagai USER ADMIN.
#          Langkah 7-13 (Rust build, llama.cpp build) jalankan sebagai USER LAWU
#          (sudo su - lawu, tanpa sudo prefix).`

const USER_DIRS = `# 2.B — Buat struktur direktori Lawu & set ownership

# Direktori APLIKASI di SSD 128GB (OS) — cepat, untuk binary & config
sudo mkdir -p /opt/lawu
sudo mkdir -p /opt/lawu/bin
sudo mkdir -p /opt/lawu/scripts
sudo mkdir -p /opt/lawu/logs

# Direktori DATA di HDD 500GB — koleksi ebook, index, markdown, backup
sudo mkdir -p /mnt/data/ebooks
sudo mkdir -p /mnt/data/ebooks/incoming
sudo mkdir -p /mnt/data/ebooks/processed
sudo mkdir -p /mnt/data/processed_markdowns
sudo mkdir -p /mnt/data/tantivy_index
sudo mkdir -p /mnt/data/backup
sudo mkdir -p /mnt/data/models

# Direktori di home user lawu (source tree llama.cpp & cargo)
sudo -u lawu mkdir -p /home/lawu/src
sudo -u lawu mkdir -p /home/lawu/models

# Set ownership: semua direktori Lawu milik user lawu
sudo chown -R lawu:lawu /opt/lawu
sudo chown -R lawu:lawu /mnt/data

# Set permission: 755 untuk dir, 640 untuk file (principle least privilege)
sudo find /opt/lawu -type d -exec chmod 755 {} \\;
sudo find /opt/lawu -type f -exec chmod 640 {} \\;
sudo find /mnt/data -type d -exec chmod 755 {} \\;

# Verifikasi
ls -ld /opt/lawu /mnt/data/ebooks /mnt/data/tantivy_index /mnt/data/backup
ls -ld /home/lawu /home/lawu/src /home/lawu/models`

// ======================================================================
// LANGKAH 3 — MOUNT & FORMAT HDD/SSD
// ======================================================================

const DISK_IDENTIFY = `# 3.A — Identifikasi disk SSD (OS) & HDD (DATA)
# SSD 128GB biasanya sudah jadi disk OS (sda). HDD 500GB untuk DATA.

# 1) List semua block device
lsblk -o NAME,SIZE,TYPE,MOUNTPOINT,FSTYPE,MODEL

# 2) Cek disk terpasang
sudo fdisk -l | grep -E '^Disk /dev/(sd|nvme)'

# 3) Identifikasi SSD vs HDD berdasarkan rotasi (0=SSD, 1=HDD)
for dev in /sys/block/sd* /sys/block/nvme*; do
  [ -d "$dev" ] || continue
  name=$(basename "$dev")
  rotational=$(cat "$dev/queue/rotational" 2>/dev/null)
  size=$(lsblk -dn -o SIZE "/dev/$name" 2>/dev/null)
  [ "$rotational" = "0" ] && echo "$name (SSD, $size)" || echo "$name (HDD, $size)"
done

# CONTOH OUTPUT:
# sda (SSD, 128G)   ← disk OS, jangan diformat!
# sdb (HDD, 500G)   ← disk DATA, akan di-mount ke /mnt/data`

const DISK_FORMAT = `# 3.B — Format HDD 500GB sebagai ext4 (JIKA belum diformat)
# HATI-HATI: pastikan /dev/sdb BENAR-BENAR HDD data kosong, bukan disk OS!
# Cek ulang dengan: sudo blkid /dev/sdb1 — harus TIDAK ADA output jika kosong.

# 1) Partisi HDD (single partition, GPT)
sudo parted -s /dev/sdb mklabel gpt
sudo parted -s /dev/sdb mkpart primary ext4 0% 100%

# 2) Format ext4 (pilihan terbaik untuk Linux file server — journaling, ACL support)
sudo mkfs.ext4 -L lawu-data -m 1 -T largefile4 /dev/sdb1
#   -L lawu-data  = label disk (memudah identifikasi)
#   -m 1          = reserved 1% untuk root (default 5% terlalu boros di 500GB)
#   -T largefile4 = optimasi untuk file besar (ebook PDF/EPUB, index Tantivy)

# 3) Verifikasi format
sudo blkid /dev/sdb1
# Harus cetak: TYPE="ext4" LABEL="lawu-data"`

const DISK_FSTAB = `# 3.C — Mount otomatis via /etc/fstab (persistent across reboot)

# 1) Dapat UUID partisi HDD
UUID=$(sudo blkid -s UUID -o value /dev/sdb1)
echo "UUID HDD: $UUID"

# 2) Backup fstab lama
sudo cp /etc/fstab /etc/fstab.bak.$(date +%Y%m%d)

# 3) Tambah entry mount
echo "UUID=$UUID  /mnt/data  ext4  defaults,noatime,nodiratime,data=writeback  0  2" \\
  | sudo tee -a /etc/fstab

#   noatime       = jangan update access time (hemat write SSD/HDD, cepat)
#   data=writeback = mode journaling paling cepat (risiko minor korupsi jika power loss)
#                    AMAN karena ada backup harian (Langkah 15)
#
#   UNTUK PRODUKSI SENSITIF: ganti data=writeback → data=ordered (default, lebih aman)

# 4) Mount sekarang
sudo mount -a

# 5) Verifikasi mount
mount | grep /mnt/data
df -hT /mnt/data
# Harus cetak: /dev/sdb1 ext4  492G  ...  /mnt/data`

const DISK_SSD_TUNING = `# 3.D — Tuning SSD 128GB (OS disk) untuk umur panjang
# TRIM otomatis + scheduler I/O yang sesuai untuk SSD

# 1) Aktifkan TRIM periodik (hemat SSD, hapus blok tidak terpakai)
sudo systemctl enable --now fstrim.timer
sudo systemctl status fstrim.timer --no-pager

# 2) Set I/O scheduler ke 'mq-deadline' atau 'none' untuk SSD/NVMe
#    (cek yang tersedia dulu)
cat /sys/block/sda/queue/scheduler
# Set persisten via udev:
echo 'ACTION=="add|change", KERNEL=="sd[a-z]", ATTR{queue/rotational}=="0", ATTR{queue/scheduler}="mq-deadline"' \\
  | sudo tee /etc/udev/rules.d/60-ssd-scheduler.rules
sudo udevadm control --reload-rules

# 3) (OPSIONAL) Kurangi swappiness khusus SSD (ditimpa Langkah 6 sysctl)
# SSD 128GB cepat penuh jika swap aktif — swap harus di HDD atau disabled
sudo swapoff --all 2>/dev/null || true
sudo sed -i '/swap/d' /etc/fstab  # hapus entry swap lama`

// ======================================================================
// LANGKAH 4 — FIREWALL & SSH HARDENING
// ======================================================================

const FIREWALL_UFW = `# 4.A — Konfigurasi firewall UFW (default deny, hanya buka port yang perlu)
# Paten 4: Linux only — ufw = front-end iptables/nftables (Debian default)

# 1) Reset UFW ke kondisi default (bersih)
sudo ufw --force reset

# 2) Default policy: tolak incoming, izinkan outgoing
sudo ufw default deny incoming
sudo ufw default allow outgoing

# 3) Izinkan SSH (port 22) — WAJIB sebelum enable, kalau tidak Anda terkunci!
sudo ufw allow 22/tcp comment 'SSH admin'

# 4) Izinkan HTTP (port 80) & HTTPS (port 443) untuk Nginx reverse proxy (Langkah 17)
sudo ufw allow 80/tcp comment 'Nginx HTTP'
sudo ufw allow 443/tcp comment 'Nginx HTTPS'

# 5) (OPSIONAL) Batasi akses internal-only untuk port inference & API
#    Hanya izinkan dari localhost (Axum & llama.cpp sudah bind 127.0.0.1, jadi tidak perlu)
#    JANGAN buka 8080/8081 ke publik — hanya via Nginx reverse proxy

# 6) Enable UFW
sudo ufw --force enable

# 7) Verifikasi status
sudo ufw status verbose
sudo ufw status numbered`

const SSH_HARDENING = `# 4.B — SSH hardening (cegah brute-force & privilege escalation)

# 1) Backup config SSH lama
sudo cp /etc/ssh/sshd_config /etc/ssh/sshd_config.bak.$(date +%Y%m%d)

# 2) Edit /etc/ssh/sshd_config — tambah/baris berikut (di akhir file):
sudo tee -a /etc/ssh/sshd_config > /dev/null <<'SSHCONF'

# ===== Lawu-2.5-Fine SSH Hardening =====
PermitRootLogin no              # root tidak boleh SSH langsung
PasswordAuthentication no       # WAJIB pakai SSH key, bukan password
PubkeyAuthentication yes
KbdInteractiveAuthentication no
ChallengeResponseAuthentication no
X11Forwarding no               # tidak perlu X11 di server
AllowTcpForwarding no          # cegah SSH tunneling abuse
AllowAgentForwarding no
ClientAliveInterval 300        # disconnect idle setelah 5 menit
ClientAliveCountMax 2          # 2x ping = 10 menit max idle
MaxAuthTries 3                 # max 3 percobaan login
LoginGraceTime 30              # timeout login 30 detik
SSHCONF

# 3) Restart SSH daemon
sudo systemctl restart sshd
sudo systemctl status sshd --no-pager

# 4) SEBELUM tutup sesi ini: BUKA TERMINAL BARU & test login SSH dengan key
#    Jika gagal login, Anda bisa kembalikan config backup dari sesi yang masih hidup:
#    sudo cp /etc/ssh/sshd_config.bak.* /etc/ssh/sshd_config && sudo systemctl restart sshd`

const SSH_KEY = `# 4.C — Generate SSH key pair (di mesin admin/laptop Anda, BUKAN di server)

# 1) Di laptop admin Anda — generate ed25519 key (modern, aman, ringan)
ssh-keygen -t ed25519 -a 100 -C "admin@lawu-server" -f ~/.ssh/lawu_admin

# 2) Copy public key ke server lawu (masukkan password sekali, setelah ini pakai key)
ssh-copy-id -i ~/.ssh/lawu_admin.pub lawu@<IP-SERVER>

# 3) Test login dengan key (tanpa password)
ssh -i ~/.ssh/lawu_admin lawu@<IP-SERVER>

# 4) Setelah login dengan key berhasil, password login otomatis disabled (Langkah 4.B)
#    Verifikasi: SSH dengan password harus DITOLAK
ssh lawu@<IP-SERVER>   # harus gagal: Permission denied (publickey)`

const FAIL2BAN = `# 4.D — Install & konfigurasi fail2ban (auto-ban IP setelah 3x gagal SSH)

# 1) fail2ban sudah diinstall di Langkah 1.B — konfigurasi sekarang
sudo tee /etc/fail2ban/jail.d/lawu-sshd.local > /dev/null <<'F2B'
[sshd]
enabled  = true
port     = 22
filter   = sshd
backend  = systemd
maxretry = 3
findtime = 600
bantime  = 3600
ignoreip = 127.0.0.1/8 ::1
F2B

# 2) Restart fail2ban
sudo systemctl restart fail2ban
sudo systemctl enable fail2ban

# 3) Verifikasi jail aktif
sudo fail2ban-client status sshd

# 4) (Lewat waktu) Cek IP yang di-ban
sudo fail2ban-client status sshd
# Untuk unban: sudo fail2ban-client set sshd unbanip <IP>`

// ======================================================================
// LANGKAH 5 — RINGKASAN ARSITEKTUR
// ======================================================================

const ARCH = `┌─────────────────────────── SERVER DEBIAN 13 — i5-10400 ───────────────────────────┐
│                                                                                   │
│  HDD 500GB (DATA)                       SSD 128GB (OS)                            │
│  ├─ ebooks/ (PDF·EPUB·DOCX)             ├─ Debian 13 (Linux 6.x)                  │
│  ├─ incoming/  ◄─── inotifywait         ├─ ~/.cargo/bin/lawu-server (Axum+Tantivy)│
│  ├─ processed_markdowns/ (MarkltDown)   ├─ llama-server + GGUF lawu-2.5-fine      │
│  ├─ tantivy_index/                      └─ /var/log + journald                    │
│  └─ backup/ (retensi 7 hari)                     │                                │
│          │                                       │                                │
│          ▼                                       ▼                                │
│  Tantivy Index (BM25)  ──►  Axum :8081  ──►  Nginx :80  ──►  Dashboard Web        │
│  llama.cpp :8080 (OpenAI-compatible /v1/chat/completions)  ──►  Konsol Chat       │
│  Cron 02:00 backup_lawu.sh · Cron 07:00 send_error_report.sh ──► Telegram (sosul) │
│  UFW: 22/80/443 open · 8080/8081 localhost-only · fail2ban sshd jail              │
└───────────────────────────────────────────────────────────────────────────────────┘`

// ======================================================================
// LANGKAH 6 — KERNEL TUNING (sysctl)
// ======================================================================

const SYSCTL = `# 6.A — Tulis config sysctl Lawu ke file (heredoc — LANGSUNG JALANKAN)
# >>> RUN AS: user admin Anda (yang punya sudo) <<<
# JANGAN jalankan sebagai user lawu — akan error "not in sudoers file"
# Ini CONFIG FILE, bukan script. Heredoc menulis ke /etc/sysctl.d/99-lawu-fine.conf lalu apply.
sudo tee /etc/sysctl.d/99-lawu-fine.conf > /dev/null <<'SYSCTL'
# Tuning kernel untuk search engine ebook Lawu-2.5-Fine

# Manfaatkan RAM 16GB untuk caching disk/Tantivy, kurangi swap ke SSD
vm.swappiness = 10

# Tulis data kotor ke disk bertahap — cegah I/O stall saat indexing
vm.dirty_background_ratio = 5
vm.dirty_ratio = 15

# Batas file descriptor besar untuk Axum & Tantivy (buka banyak segmen index)
fs.file-max = 2097152

# Pemantauan inotifywait hingga ratusan ribu file ebook di HDD
fs.inotify.max_user_watches = 524288
fs.inotify.max_user_instances = 512

# Perbesar antrean backlog koneksi masuk untuk HTTP API Axum
net.core.somaxconn = 65535
net.ipv4.tcp_max_syn_backlog = 65535

# Tweak TCP untuk API responsiveness
net.ipv4.tcp_fastopen = 3
net.core.netdev_max_backlog = 16384

# Cegah SYN flood (DDoS ringan)
net.ipv4.tcp_syncookies = 1
SYSCTL

# Apply config ke kernel yang sedang berjalan (full path — anti PATH issue)
sudo /usr/sbin/sysctl --system

# Verifikasi nilai sudah berubah (pakai sudo — secure_path include /usr/sbin)
sudo sysctl vm.swappiness fs.file-max fs.inotify.max_user_watches net.core.somaxconn`

const LIMITS_CONF = `# 6.B — Tulis limits.conf untuk user lawu (heredoc — LANGSUNG JALANKAN)
# Naikkan batas file descriptor untuk Axum + Tantivy
sudo tee /etc/security/limits.d/99-lawu-fine.conf > /dev/null <<'LIMITS'
lawu  soft  nofile  1048576
lawu  hard  nofile  2097152
lawu  soft  nproc   65535
lawu  hard  nproc   131072
root  soft  nofile  1048576
root  hard  nofile  2097152
LIMITS

# Aktifkan: logout + login ulang (atau reboot) agar limit baru berlaku
# Verifikasi setelah relogin: ulimit -n  (harus 1048576)
sudo systemctl daemon-reload`

// ======================================================================
// LANGKAH 7 — INSTALL RUST TOOLCHAIN
// ======================================================================

const RUST_INSTALL = `# 7.A — Install Rust via rustup (official installer, open source Apache-2.0/MIT)
# Paten 1: Rust = backend tunggal. Paten 5: rustup = open source.
# >>> RUN AS: user lawu (TANPA sudo — build tidak butuh root) <<<
# Dari shell user admin Anda (yang punya sudo), switch ke lawu dulu:

# 1) Switch ke user lawu (dari shell user admin Anda)
sudo su - lawu
# Sekarang prompt berubah: lawu@hostname:~$
# Verifikasi Anda sebagai lawu (BUKAN sudo — lawu tidak punya sudo):
whoami    # harus cetak: lawu
id        # groups harus TIDAK ada sudo

# 2) Install rustup (rust compiler + cargo + toolchain manager)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y \\
  --default-toolchain stable \\
  --profile default \\
  --component rustfmt clippy

# 3) Source environment cargo
source ~/.cargo/env

# 4) Verifikasi instalasi
rustc --version
cargo --version
rustup --version
rustup component list --installed

# 5) (OPSIONAL) Set target khusus CPU native (optimasi AVX2 di i5-10400)
#    Tidak wajib — Cargo.toml bisa pakai RUSTFLAGS="-C target-cpu=native"
mkdir -p ~/.cargo
echo 'export RUSTFLAGS="-C target-cpu=native"' >> ~/.bashrc
source ~/.bashrc`

const RUST_VERIFY = `# 7.B — Verifikasi Rust toolchain dengan build hello-world

# Sebagai user lawu
sudo su - lawu
source ~/.cargo/env

# 1) Buat project dummy
cd /tmp
cargo new hello_lawu --bin
cd hello_lawu

# 2) Build dengan optimasi native CPU
RUSTFLAGS="-C target-cpu=native" cargo build --release
./target/release/hello_lawu
# Harus cetak: Hello, world!

# 3) Cek binary ter-link dengan benar (Paten 3: murni CPU, tanpa GPU dep)
ldd ./target/release/hello_lawu
# Harus HANYA cetak: libc.so.6, libgcc_s.so.1, ld-linux-x86-64.so.2
# JANGAN ada libcuda, libnvrtc, atau libGPU apa pun

# 4) Cleanup
cd / && rm -rf /tmp/hello_lawu`

// ======================================================================
// LANGKAH 8 — PROYEK CARGO lawu-server
// ======================================================================

const CARGO_NEW = `# 8.A — Inisialisasi project Cargo lawu-server

# Sebagai user lawu
sudo su - lawu
source ~/.cargo/env

# 1) Buat project di home directory
cd ~
cargo new --bin lawu-server
cd lawu-server

# 2) Struktur direktori yang dihasilkan
tree -L 2
# lawu-server/
# ├── Cargo.toml
# ├── src/
# │   └── main.rs
# └── target/  (akan muncul setelah build)`

const CARGO_TOML = `# ~/lawu-server/Cargo.toml
[package]
name = "lawu-server"
version = "0.1.0"
edition = "2021"
authors = ["Lawu Team <lawu@example.id>"]
description = "Lawu-2.5-Fine search API — Axum + Tantivy"
license = "MIT"

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
anyhow = "1"
thiserror = "1"
tower-http = { version = "0.5", features = ["cors", "trace"] }
chrono = { version = "0.4", features = ["serde"] }

[profile.release]
opt-level = 3
lto = true
codegen-units = 1
strip = true        # strip symbol → binary lebih kecil
panic = "abort"     # hemat binary size, tanpa unwind tables`

const CARGO_BUILD = `# 8.B — Build lawu-server (release mode, optimasi native CPU)

# Sebagai user lawu, di ~/lawu-server/
source ~/.cargo/env
cd ~/lawu-server

# 1) Copy Cargo.toml dari Langkah 8.A ke file (paste via editor)
nano Cargo.toml
# (paste konten, Ctrl+O, Enter, Ctrl+X)

# 2) Copy src/main.rs dari Langkah 10 ke file
nano src/main.rs
# (paste konten, Ctrl+O, Enter, Ctrl+X)

# 3) Copy src/schema.rs dari Langkah 9 ke file
mkdir -p src
nano src/schema.rs
# (paste konten, Ctrl+O, Enter, Ctrl+X)

# 4) Build release dengan optimasi native CPU
RUSTFLAGS="-C target-cpu=native" cargo build --release

# 5) Install binary ke ~/.cargo/bin/ (akses global dari PATH)
cargo install --path .
# Binary tersimpan di: ~/.cargo/bin/lawu-server

# 6) Verifikasi binary ter-link bersih (Paten 3: murni CPU)
ldd ~/.cargo/bin/lawu-server
# Harus HANYA: libc, libgcc_s, libm, libpthread, libdl, ld-linux
# JANGAN ada libcuda / libnvrtc / libGPU`

// ======================================================================
// LANGKAH 9 — SKEMA TANTIVY
// ======================================================================

const TANTIVY = `// ~/lawu-server/src/schema.rs
use tantivy::schema::{Schema, TEXT, STORED, IndexRecordOption, Facet, FAST};

pub fn build_schema() -> Schema {
    // Skema multi-field — identik dengan kontrak dashboard:
    // title, body, path, file_type, category
    let mut schema = Schema::builder();

    // title — STORED untuk di-return di hasil pencarian, TEXT untuk BM25
    schema.add_text_field("title", TEXT | STORED);

    // body — TEXT only (tidak di-store, hemat disk; snippet di-generate saat query)
    schema.add_text_field("body", TEXT);

    // path — unique per dokumen, STORED untuk lookup file asli
    schema.add_text_field("path", TEXT | STORED);

    // file_type — PDF | EPUB | DOCX (filter TermQuery presisi)
    schema.add_text_field("file_type", TEXT);

    // category — misal "Agama Islam", "Programming", "AI/ML"
    schema.add_text_field("category", TEXT);

    // pages — jumlah halaman (FAST untuk sort/filter numerik)
    schema.add_u64_field("pages", FAST | STORED);

    // size_bytes — ukuran file asli (FAST untuk sort)
    schema.add_u64_field("size_bytes", FAST | STORED);

    // indexed_at — timestamp indexing (FAST untuk sort terbaru)
    schema.add_date_field("indexed_at", FAST | STORED);

    schema.build()
}

// Index writer dengan commit per batch (Rayon memparalelkan ekstraksi):
// let writer = index.writer(64_000_000)?;            // 64 MB heap
// writer.add_document(doc)?;
// writer.commit()?;  // posting list BM25 siap dicari`

// ======================================================================
// LANGKAH 10 — ENDPOINT API AXUM
// ======================================================================

const AXUM_API = `// ~/lawu-server/src/main.rs
use axum::{
    extract::{Path, State},
    http::{header, StatusCode},
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tantivy::collector::TopDocs;
use tantivy::query::QueryParser;
use tantivy::{doc, Index, IndexReader, IndexWriter, ReloadPolicy};
use tracing_subscriber;

#[derive(Clone)]
struct AppState {
    index: Arc<Index>,
    reader: Arc<IndexReader>,
    // path field disimpan agar bisa dipakai ulang
    schema_fields: Arc<SchemaFields>,
}

struct SchemaFields {
    title: tantivy::schema::Field,
    body: tantivy::schema::Field,
    path: tantivy::schema::Field,
    file_type: tantivy::schema::Field,
    category: tantivy::schema::Field,
}

#[derive(Deserialize)]
struct SearchRequest {
    query: String,
    file_type: Option<String>,
    category: Option<String>,
    limit: Option<usize>,
}

#[derive(Serialize)]
struct SearchHit {
    title: String,
    path: String,
    file_type: String,
    category: String,
    score: f32,
}

#[derive(Serialize)]
struct SearchResponse {
    results: Vec<SearchHit>,
    total: usize,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt().with_env_filter("info").init();

    // 1) Buka index Tantivy di HDD
    let index_path = "/mnt/data/tantivy_index";
    let index = Index::open_in_dir(index_path)
        .or_else(|_| {
            // Index belum ada — buat baru dengan schema
            std::fs::create_dir_all(index_path)?;
            let schema = crate::schema::build_schema();
            Index::create_in_dir(index_path, schema)
        })?;

    // 2) Reader dengan auto-reload (indexer & searcher di proses yang sama)
    let reader = index
        .reader_builder()
        .reload_policy(ReloadPolicy::OnCommitWithDelay)
        .try_into()?;

    let state = AppState {
        index: Arc::new(index),
        reader: Arc::new(reader),
        schema_fields: Arc::new(/* init fields di sini */),
    };

    // 3) Router Axum
    let app = Router::new()
        .route("/api/stats", get(stats_handler))
        .route("/api/search", post(search_handler))
        .route("/api/telegram/test", post(telegram_test_handler))
        .with_state(state);

    let listener = tokio::net::TcpListener::bind("127.0.0.1:8081").await?;
    tracing::info!("lawu-server berjalan di http://127.0.0.1:8081");
    axum::serve(listener, app).await?;
    Ok(())
}

async fn search_handler(
    State(state): State<AppState>,
    Json(req): Json<SearchRequest>,
) -> Result<Json<SearchResponse>, StatusCode> {
    let searcher = state.reader.searcher();
    let schema = state.index.schema();

    let title_field = schema.get_field("title").map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let path_field = schema.get_field("path").map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let ft_field = schema.get_field("file_type").map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let cat_field = schema.get_field("category").map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let query_parser = QueryParser::for_index(&state.index, vec![title_field, /* body_field */]);
    let query = query_parser.parse_query(&req.query).map_err(|_| StatusCode::BAD_REQUEST)?;

    let limit = req.limit.unwrap_or(60).min(200);
    let top_docs = searcher
        .search(&query, &TopDocs::with_limit(limit))
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let hits: Vec<SearchHit> = top_docs
        .into_iter()
        .map(|(score, doc_addr)| {
            let doc = searcher.doc(doc_addr).unwrap();
            SearchHit {
                title: doc.get_first(title_field).and_then(|v| v.as_text()).unwrap_or("").to_string(),
                path: doc.get_first(path_field).and_then(|v| v.as_text()).unwrap_or("").to_string(),
                file_type: doc.get_first(ft_field).and_then(|v| v.as_text()).unwrap_or("").to_string(),
                category: doc.get_first(cat_field).and_then(|v| v.as_text()).unwrap_or("").to_string(),
                score,
            }
        })
        .collect();

    Ok(Json(SearchResponse { total: hits.len(), results: hits }))
}

async fn stats_handler(State(_state): State<AppState>) -> Json<serde_json::Value> {
    // Return metrik: total docs, byType, byCategory, sizeIndex, lastIndexedAt
    Json(serde_json::json!({
        "docs": { "total": 0, "byType": [], "byCategory": [], "indexSizeMb": 0, "lastIndexedAt": null },
        "chats": { "conversations": 0, "messages": 0 },
        "alerts": { "total24h": 0 }
    }))
}

async fn telegram_test_handler() -> Json<serde_json::Value> {
    // Tes konektivitas Telegram Bot (mode simulasi dulu)
    Json(serde_json::json!({ "ok": true, "mode": "simulasi", "message": "Telegram belum dikonfigurasi" }))
}`

// ======================================================================
// LANGKAH 11 — BUILD llama.cpp
// ======================================================================

const LLAMA_CLONE = `# 11.A — Clone & build llama.cpp (open source MIT)
# Paten 3: murni CPU. Paten 5: llama.cpp = MIT license.
# llama.cpp TIDAK butuh GPU — pure CPU dengan optimasi AVX2 otomatis di i5-10400.

# Sebagai user lawu
sudo su - lawu
source ~/.cargo/env

# 1) Clone repo llama.cpp (official ggerganov)
cd ~/src
git clone https://github.com/ggerganov/llama.cpp.git
cd llama.cpp

# 2) Checkout release stabil terbaru (misal b3xxx)
#    Cek tag terbaru: https://github.com/ggerganov/llama.cpp/releases
git checkout b3500  # ganti dengan tag stabil terbaru saat Anda menjalankan

# 3) Update submodule (jika ada)
git submodule update --init --recursive`

const LLAMA_BUILD = `# 11.B — Build llama.cpp dengan optimasi CPU native (AVX2 di i5-10400)

cd ~/src/llama.cpp

# 1) Konfigurasi build dengan CMake
#    GGML_NATIVE=ON = deteksi otomatis AVX2/AVX512/FMA di i5-10400
#    LLAMA_BUILD_SERVER=ON = bangun 'llama-server' (OpenAI-compatible endpoint)
cmake -B build \\
  -DGGML_NATIVE=ON \\
  -DGGML_AVX2=ON \\
  -DGGML_FMA=ON \\
  -DGGML_F16C=ON \\
  -DLLAMA_BUILD_SERVER=ON \\
  -DLLAMA_CURL=ON \\
  -DCMAKE_BUILD_TYPE=Release \\
  -G Ninja

# 2) Build paralel (6 core fisik i5-10400)
cmake --build build --config Release -j 6

# 3) Verifikasi binary ada
ls -lh build/bin/llama-server
ls -lh build/bin/llama-quantize
ls -lh build/bin/llama-cli

# 4) Verifikasi murni CPU — TIDAK ada dependency CUDA
ldd build/bin/llama-server | grep -iE 'cuda|nvrtc|cudnn' && echo "✗ ADA GPU dep!" || echo "✓ Murni CPU (Paten 3 terpenuhi)"

# Estimasi waktu build: 5-8 menit di i5-10400 dengan 6 thread`

// ======================================================================
// LANGKAH 12 — KONVERSI & KUANTISASI GGUF
// ======================================================================

const GGUF_CONVERT = `# 12.A — Konversi model HuggingFace → GGUF F16

# Sebagai user lawu
sudo su - lawu
cd ~/src/llama.cpp

# 1) Dapatkan model fine-tune Lawu-2.5-Fine (basis Qwen2.5-Coder-7B)
#    Letakkan model HuggingFace di ~/models/lawu-2.5-fine-hf/
#    (hasil fine-tune dari tim Lawu, atau model base open source)

ls ~/models/lawu-2.5-fine-hf/
# Harus ada: config.json, model.safetensors, tokenizer.json, dll.

# 2) Aktifkan venv Python yang ada MarkltDown/llama.cpp deps
source ~/venvs/lawu/bin/activate
pip install -r requirements.txt   # llama.cpp Python deps

# 3) Konversi HF → GGUF F16 (full precision, ukuran besar)
python3 convert_hf_to_gguf.py ~/models/lawu-2.5-fine-hf \\
  --outfile ~/models/lawu-2.5-fine-f16.gguf \\
  --outtype f16

# 4) Verifikasi GGUF F16
ls -lh ~/models/lawu-2.5-fine-f16.gguf
# Estimasi: 7B F16 ≈ 14 GB

# 5) Cek metadata GGUF
~/src/llama.cpp/build/bin/llama-gguf-dump ~/models/lawu-2.5-fine-f16.gguf | head -20`

const GGUF_QUANTIZE = `# 12.B — Kuantisasi GGUF F16 → Q4_K_M (hemat RAM untuk CPU inference)

# Sebagai user lawu
sudo su - lawu
cd ~/src/llama.cpp

# 1) Kuantisasi ke Q4_K_M (4-bit, K-quant medium)
#    Trade-off optimal: ukuran ~4.4GB, kualitas mendekati F16, throughput tinggi
./build/bin/llama-quantize \\
  ~/models/lawu-2.5-fine-f16.gguf \\
  ~/models/lawu-2.5-fine-q4_k_m.gguf Q4_K_M

# 2) Verifikasi hasil kuantisasi
ls -lh ~/models/lawu-2.5-fine-q4_k_m.gguf
# Estimasi: 7B Q4_K_M ≈ 4.4 GB

# 3) (OPSIONAL) Kuantisasi alternatif untuk testing
./build/bin/llama-quantize \\
  ~/models/lawu-2.5-fine-f16.gguf \\
  ~/models/lawu-2.5-fine-q5_k_m.gguf Q5_K_M
# Q5_K_M ≈ 5.2 GB — kualitas lebih baik, throughput sedikit lebih lambat

# 4) Hapus GGUF F16 setelah quantize sukses (hemat HDD)
#    SIMPAN F16 jika Anda berencana re-quantize ke format lain nanti
rm -f ~/models/lawu-2.5-fine-f16.gguf

# 5) Verifikasi akhir model
~/src/llama.cpp/build/bin/llama-gguf-dump ~/models/lawu-2.5-fine-q4_k_m.gguf | head -30`

// ======================================================================
// LANGKAH 13 — SERVE llama.cpp
// ======================================================================

const LLAMA_SERVE = `# 13.A — Jalankan llama-server (OpenAI-compatible endpoint)

# Sebagai user lawu
sudo su - lawu
cd ~/src/llama.cpp

# 1) Tes serve manual dulu (sebelum systemd di Langkah 14)
./build/bin/llama-server \\
  -m ~/models/lawu-2.5-fine-q4_k_m.gguf \\
  --alias lawu-2.5-fine \\
  -t 6 \\
  --mmap \\
  -c 4096 \\
  --host 127.0.0.1 \\
  --port 8080

# Parameter penjelasan:
#   -m           = path model GGUF
#   --alias      = nama model di endpoint OpenAI-compatible
#   -t 6         = 6 thread fisik i5-10400 (sisakan thread utk OS/indexer)
#   --mmap        = memory-map file model (hemat RAM, pakai page cache OS)
#   -c 4096      = context window 4K token (cukup utk chat + snippet ebook)
#   --host 127.0.0.1 = bind localhost SAJA (akses via Nginx reverse proxy)
#   --port 8080  = port inference

# 2) Di terminal lain, test endpoint OpenAI-compatible
curl http://127.0.0.1:8080/v1/models | jq

curl http://127.0.0.1:8080/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "lawu-2.5-fine",
    "messages": [{"role": "user", "content": "Halo, siapa kamu?"}],
    "max_tokens": 100
  }' | jq

# 3) Estimasi throughput: 7B Q4_K_M ≈ 9-14 tok/s di i5-10400 murni CPU
#    14B Q4_K_M masih muat RAM 16GB tapi throughput turun ~2x (mulai dari 7B)

# 4) Stop manual serve (Ctrl+C), lanjut setup systemd di Langkah 14`

// ======================================================================
// LANGKAH 14 — SYSTEMD UNITS
// ======================================================================

const SYSTEMD_USER = `# 14.A — Pastikan user lawu bisa jalankan service systemd

# (sudah dibuat di Langkah 2.A — ini hanya verifikasi)
id lawu
# harus cetak: uid=1001(lawu) gid=1001(lawu) groups=1001(lawu)

# Enable lingering agar service user berjalan tanpa login
sudo loginctl enable-linger lawu
loginctl show-user lawu | grep Linger
# harus cetak: Linger=yes`

const SYSTEMD_LLAMA = `# 14.A — Tulis unit file systemd untuk llama.cpp (heredoc — LANGSUNG JALANKAN)
# Service inference llama.cpp (CPU only — Paten 3)
sudo tee /etc/systemd/system/llama-lawu.service > /dev/null <<'UNIT'
[Unit]
Description=Lawu-2.5-Fine — llama.cpp GGUF server (CPU)
After=network.target
After=mnt-data.mount

[Service]
User=lawu
Group=lawu
Type=simple
ExecStart=/home/lawu/src/llama.cpp/build/bin/llama-server -m /home/lawu/models/lawu-2.5-fine-q4_k_m.gguf --alias lawu-2.5-fine -t 6 --mmap -c 4096 --host 127.0.0.1 --port 8080
Restart=always
RestartSec=3
LimitNOFILE=65535

# Hardening systemd
NoNewPrivileges=yes
ProtectSystem=full
ProtectHome=read-only
PrivateTmp=yes
ReadWritePaths=/mnt/data /home/lawu/models

[Install]
WantedBy=multi-user.target
UNIT

# Verify file created
cat /etc/systemd/system/llama-lawu.service | head -10`

const SYSTEMD_AXUM = `# 14.B — Tulis unit file systemd untuk Axum API (heredoc — LANGSUNG JALANKAN)
# Service API search Axum + Tantivy
sudo tee /etc/systemd/system/lawu-2.5-fine.service > /dev/null <<'UNIT'
[Unit]
Description=Lawu-2.5-Fine — Axum + Tantivy search API
After=network.target llama-lawu.service
Requires=llama-lawu.service

[Service]
User=lawu
Group=lawu
Type=simple
Environment=RUST_LOG=info
Environment=LAWU_INDEX_PATH=/mnt/data/tantivy_index
Environment=LAWU_LLM_URL=http://127.0.0.1:8080
EnvironmentFile=/etc/lawu/env
ExecStart=/home/lawu/.cargo/bin/lawu-server
Restart=always
RestartSec=3
LimitNOFILE=65535

# Hardening systemd
NoNewPrivileges=yes
ProtectSystem=full
ProtectHome=read-only
PrivateTmp=yes
ReadWritePaths=/mnt/data /var/log/lawu

[Install]
WantedBy=multi-user.target
UNIT

# Verify file created
cat /etc/systemd/system/lawu-2.5-fine.service | head -10`

const SYSTEMD_ENABLE = `# 14.B — Aktifkan & enable kedua service systemd

# 1) Buat direktori log (jika belum)
sudo mkdir -p /var/log/lawu
sudo chown lawu:lawu /var/log/lawu

# 2) Tulis unit files (paste SYSTEMD_LLAMA & SYSTEMD_AXUM di atas)
sudo nano /etc/systemd/system/llama-lawu.service
sudo nano /etc/systemd/system/lawu-2.5-fine.service

# 3) Reload systemd daemon
sudo systemctl daemon-reload

# 4) Enable & start service (urutan: llama dulu, baru axum)
sudo systemctl enable --now llama-lawu
sleep 3   # tunggu model load
sudo systemctl enable --now lawu-2.5-fine

# 5) Verifikasi status
sudo systemctl status llama-lawu --no-pager
sudo systemctl status lawu-2.5-fine --no-pager

# 6) Cek log real-time
sudo journalctl -u llama-lawu -f
sudo journalctl -u lawu-2.5-fine -f

# 7) Test endpoint API
curl http://127.0.0.1:8081/api/stats | jq
curl -X POST http://127.0.0.1:8081/api/search \\
  -H "Content-Type: application/json" \\
  -d '{"query":"test","limit":5}' | jq`

// ======================================================================
// LANGKAH 15 — OTOMASI PEMANTAUAN
// ======================================================================

const WATCH_SCRIPT = `# /opt/lawu/scripts/watch_ebooks.sh — File Watcher & Notifikasi Real-time
#!/usr/bin/env bash
# Paten 5: inotifywait = GPL-2 (open source, aman)
set -euo pipefail

WATCH_DIR="/mnt/data/ebooks/incoming"
LOG_FILE="/var/log/lawu/watch.log"
TELEGRAM_TOKEN="\${TELEGRAM_TOKEN:-}"   # set via /etc/lawu/env
TELEGRAM_CHAT="\${TELEGRAM_CHAT:-}"

send_tg() {
  [ -z "$TELEGRAM_TOKEN" ] && return 0   # mode simulasi jika token kosong
  curl -s -X POST "https://api.telegram.org/bot\${TELEGRAM_TOKEN}/sendMessage" \\
    -d chat_id="\${TELEGRAM_CHAT}" -d text="$1" >/dev/null || true
}

mkdir -p "$(dirname "$LOG_FILE")"

inotifywait -m -e close_write -e moved_to --format '%w%f' "\${WATCH_DIR}" |
while read -r FILE; do
  case "\${FILE,,}" in
    *.pdf|*.epub|*.docx)
      echo "[\$(date '+%F %T')] \${FILE}" >> "\${LOG_FILE}"
      # 1) Ekstrak teks (MarkltDown via venv)
      source ~/venvs/lawu/bin/activate
      markitdown "\${FILE}" >> /mnt/data/processed_markdowns/index.md
      deactivate
      # 2) Reindex Tantivy (trigger via API Axum) — pakai jq untuk build JSON aman
      PAYLOAD=\$(jq -n --arg p "\$FILE" '{path:\$p}')
      curl -s -X POST http://127.0.0.1:8081/api/reindex \\
        -H "Content-Type: application/json" -d "\$PAYLOAD" || true
      # 3) Notifikasi Telegram
      send_tg "📚 Ebook baru terindeks: \$(basename "\${FILE}") — Lawu-2.5-Fine"
      ;;
  esac
done`

const BACKUP_SCRIPT = `# /opt/lawu/scripts/backup_lawu.sh — Backup Harian & Rotasi Retensi 7 Hari
#!/usr/bin/env bash
# Cron 02:00 WIB
set -euo pipefail

STAMP=\$(date +%Y%m%d_%H%M)
DEST="/mnt/data/backup"

mkdir -p "\${DEST}"

tar -czf "\${DEST}/lawu_\${STAMP}.tar.gz" \\
  /mnt/data/processed_markdowns \\
  /mnt/data/tantivy_index

# Rotasi retensi: hapus arsip lebih tua dari 7 hari
find "\${DEST}" -name 'lawu_*.tar.gz' -mtime +7 -delete

echo "[\$(date '+%F %T')] Backup \${STAMP} selesai" >> /var/log/lawu/backup.log`

const ERROR_REPORT = `# /opt/lawu/scripts/send_error_report.sh — Monitoring Error Log Harian
#!/usr/bin/env bash
# Cron 07:00 WIB
set -euo pipefail

source /etc/lawu/env   # load TELEGRAM_TOKEN & TELEGRAM_CHAT

NGINX_ERR=\$(tail -n 5 /var/log/nginx/error.log 2>/dev/null || echo "kosong")
JOURNAL_ERR=\$(journalctl -u lawu-2.5-fine.service -u llama-lawu.service -p err..warning --since "24h ago" \\
  --no-pager | tail -n 20 || echo "kosong")

MSG="🛠️ <b>Lawu-2.5-Fine — Laporan Error Harian</b>
📅 \$(date '+%F %T WIB')

<b>Nginx error (5 baris terakhir):</b>
\`\`\`
\${NGINX_ERR}
\`\`\`
<b>Journalctl Lawu (err..warning, 24 jam):</b>
\`\`\`
\${JOURNAL_ERR}
\`\`\`"

curl -s -X POST "https://api.telegram.org/bot\${TELEGRAM_TOKEN}/sendMessage" \\
  -d chat_id="\${TELEGRAM_CHAT}" \\
  --data-urlencode "text=\${MSG}" \\
  -d parse_mode="HTML" >/dev/null || true`

const CRONTAB = `# crontab -e  (user lawu)
# Backup harian pukul 02:00 WIB (Asia/Jakarta = UTC+7)
0 2 * * * /opt/lawu/scripts/backup_lawu.sh

# Laporan error harian pukul 07:00 WIB
0 7 * * * /opt/lawu/scripts/send_error_report.sh

# Jaga file watcher tetap hidup (restart jika mati)
@reboot /usr/bin/screen -dmS lawu-watch /opt/lawu/scripts/watch_ebooks.sh

# (OPSIONAL) Auto-update index Tantivy setiap 6 jam (jika watcher mati)
0 */6 * * * curl -s -X POST http://127.0.0.1:8081/api/reindex-all >/dev/null 2>&1`

const ENV_FILE = `# /etc/lawu/env — Environment variables untuk Telegram (jangan commit ke git!)
# Set permission 640, owner root:lawu
sudo mkdir -p /etc/lawu
sudo tee /etc/lawu/env > /dev/null <<'ENV'
TELEGRAM_TOKEN=123456:ABC-YOUR-TOKEN-FROM-BOTFATHER
TELEGRAM_CHAT=123456789
ENV

sudo chown root:lawu /etc/lawu/env
sudo chmod 640 /etc/lawu/env

# Set environment file dipakai oleh systemd service lawu-2.5-fine:
# Tambahkan baris berikut ke /etc/systemd/system/lawu-2.5-fine.service di [Service]:
#   EnvironmentFile=/etc/lawu/env

# Reload & restart
sudo systemctl daemon-reload
sudo systemctl restart lawu-2.5-fine`

// ======================================================================
// LANGKAH 16 — LOAD TESTING k6
// ======================================================================

const K6_INSTALL = `# 16.A — Install k6 (open source AGPL-3.0, aman)

# 1) Tambah repo k6 & install
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg \\
  --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A36442D57A27E0310A66EA77C
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" \\
  | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt update
sudo apt install -y k6

# 2) Verifikasi
k6 version`

const K6 = `// ~/src/load_test.js — target: p95 /api/search < 300ms dengan 20 Virtual Users
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 20,
  duration: '2m',
  thresholds: {
    http_req_duration: ['p(95)<300'],
    http_req_failed: ['rate<0.01'],   // < 1% error rate
  },
};

export default function () {
  const res = http.post('http://127.0.0.1:8081/api/search',
    JSON.stringify({ query: 'tantivy index', file_type: 'PDF', category: 'all', limit: 60 }),
    { headers: { 'Content-Type': 'application/json' } }
  );
  check(res, {
    'status 200': (r) => r.status === 200,
    'has results': (r) => r.json('results') !== null,
  });
  sleep(0.5);   // 500ms think time antara request
}

// Jalankan: k6 run ~/src/load_test.js
// Lihat report HTML: k6 run --out json=results.json ~/src/load_test.js && k6 report --format json results.json`

// ======================================================================
// LANGKAH 17 — NGINX REVERSE PROXY
// ======================================================================

const NGINX = `# 17 — Tulis config Nginx (heredoc — LANGSUNG JALANKAN)
# Reverse proxy: dashboard/API Rust di root, inference llama.cpp di /v1/
sudo tee /etc/nginx/sites-available/lawu > /dev/null <<'NGINX'
server {
    listen 80;
    server_name _;   # ganti dengan domain Anda di produksi

    # Logging terpisah untuk audit
    access_log /var/log/nginx/lawu_access.log;
    error_log  /var/log/nginx/lawu_error.log;

    # Body upload max 100MB (untuk ebook PDF/EPUB besar)
    client_max_body_size 100M;

    # Dashboard + API Rust (Axum :8081)
    location / {
        proxy_pass http://127.0.0.1:8081;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }

    # Inference llama.cpp (OpenAI-compatible) untuk konsol chat
    location /v1/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 300s;   # inference bisa lama untuk prompt panjang
        proxy_buffering off;       # streaming response (SSE untuk chat)
    }

    # Static assets (cache 1 jam)
    location ~* \\.(css|js|png|jpg|jpeg|gif|svg|ico|woff2?)$ {
        proxy_pass http://127.0.0.1:8081;
        expires 1h;
        add_header Cache-Control "public, immutable";
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
}
NGINX

# Enable site (symlink ke sites-enabled)
sudo ln -sf /etc/nginx/sites-available/lawu /etc/nginx/sites-enabled/lawu

# Hapus default site (bentrok dengan port 80)
sudo rm -f /etc/nginx/sites-enabled/default

# Test config (harus cetak 'syntax is ok' dan 'test is successful')
sudo nginx -t

# Reload nginx jika test ok
sudo systemctl reload nginx
sudo systemctl status nginx --no-pager`

// ======================================================================
// LANGKAH 18 — INTEGRASI DASHBOARD
// ======================================================================

const INTEGRATE = `1. Buka tab "Pengaturan" di dashboard Lawu-2.5-Fine ini.
2. Isi Endpoint LLM: http://<IP-SERVER>  (Nginx :80 akan proxy ke /v1/)
   · Model: lawu-2.5-fine
   · API Key: kosong (lokal) atau token bila Anda menambah middleware.
3. Klik Simpan — konsol chat otomatis beralih dari "Simulasi (SDK)"
   ke "llama.cpp (terhubung)".
4. Untuk data pencarian nyata: arahkan fetch ke server Rust Axum Anda
   (kontrak identik: POST /api/search, GET /api/stats, GET /api/conversations).
5. Telegram Bot: daftar bot via @BotFather, dapatkan token, isi di
   /etc/lawu/env (Langkah 15) lalu restart service lawu-2.5-fine.

# Test end-to-end dari laptop admin:
curl http://<IP-SERVER>/api/stats | jq
curl -X POST http://<IP-SERVER>/api/search \\
  -H "Content-Type: application/json" \\
  -d '{"query":"machine learning","limit":10}' | jq

curl http://<IP-SERVER>/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -d '{"model":"lawu-2.5-fine","messages":[{"role":"user","content":"Halo Lawu"}],"max_tokens":50}' | jq`

// ======================================================================
// LANGKAH 19 — FINAL GO-LIVE CHECKLIST
// ======================================================================

const CHECKLIST_SCRIPT = `# 19 — Final Go-Live Checklist (jalankan SEBELUM buka ke publik)
# Setiap item harus ✓. Jika ada ✗, FIX dulu sebelum go-live.

echo "=== LAWU-2.5-FINE GO-LIVE CHECKLIST ==="
echo ""

echo "─── 1. SISTEM ───"
echo "1.1 Debian 13 (trixie): $(cat /etc/debian_version)"
echo "1.2 Kernel: $(uname -r)"
echo "1.3 Uptime: $(uptime -p)"
echo "1.4 Load average: $(cat /proc/loadavg | awk '{print $1, $2, $3}')"
echo ""

echo "─── 2. DISK & FILESYSTEM ───"
df -hT / /mnt/data 2>/dev/null
echo "SSD TRIM timer: $(sudo systemctl is-active fstrim.timer)"
echo ""

echo "─── 3. FIREWALL & SECURITY ───"
echo "3.1 UFW status:"
sudo ufw status | head -5
echo "3.2 fail2ban jails:"
sudo fail2ban-client status 2>/dev/null | grep -i jail || echo "   (fail2ban tidak aktif)"
echo "3.3 SSH root login disabled: $(grep -E '^PermitRootLogin' /etc/ssh/sshd_config | head -1)"
echo "3.4 SSH password auth disabled: $(grep -E '^PasswordAuthentication' /etc/ssh/sshd_config | head -1)"
echo ""

echo "─── 4. USER lawu ───"
id lawu
echo "Linger enabled: $(loginctl show-user lawu 2>/dev/null | grep Linger || echo 'no')"
echo ""

echo "─── 5. SERVICES ───"
for svc in llama-lawu lawu-2.5-fine nginx fail2ban; do
  status=$(sudo systemctl is-active "$svc" 2>/dev/null)
  enabled=$(sudo systemctl is-enabled "$svc" 2>/dev/null)
  echo "  $svc: active=$status, enabled=$enabled"
done
echo ""

echo "─── 6. PORTS LISTENING ───"
sudo ss -tlnp | grep -E ':(80|443|8080|8081)\\b' | awk '{print "  "$4" "$6}'
echo ""

echo "─── 7. API HEALTH CHECK ───"
echo "7.1 Axum /api/stats:"
curl -s -o /dev/null -w "   HTTP %{http_code} in %{time_total}s\\n" http://127.0.0.1:8081/api/stats
echo "7.2 Axum /api/search:"
curl -s -o /dev/null -w "   HTTP %{http_code} in %{time_total}s\\n" \\
  -X POST http://127.0.0.1:8081/api/search \\
  -H "Content-Type: application/json" -d '{"query":"test","limit":1}'
echo "7.3 llama.cpp /v1/models:"
curl -s -o /dev/null -w "   HTTP %{http_code} in %{time_total}s\\n" http://127.0.0.1:8080/v1/models
echo "7.4 Nginx /api/stats (via reverse proxy):"
curl -s -o /dev/null -w "   HTTP %{http_code} in %{time_total}s\\n" http://127.0.0.1/api/stats
echo ""

echo "─── 8. CRON JOBS ───"
sudo crontab -l -u lawu 2>/dev/null | grep -v '^#' | grep -v '^$' || echo "   (tidak ada cron lawu)"
echo ""

echo "─── 9. BACKUP & LOGS ───"
echo "9.1 Backup terbaru:"
ls -lh /mnt/data/backup/lawu_*.tar.gz 2>/dev/null | tail -3 || echo "   (belum ada backup)"
echo "9.2 Log terbaru:"
ls -lh /var/log/lawu/ 2>/dev/null || echo "   (/var/log/lawu tidak ada)"
echo "9.3 Journald disk usage:"
sudo journalctl --disk-usage
echo ""

echo "─── 10. MEMORY & PERFORMANCE ───"
free -h
echo ""
echo "Top 5 proses by RAM:"
ps aux --sort=-%mem | head -6 | awk '{print "  "$2" "$3"% "$4"% "$11}'
echo ""

echo "=========================================="
echo "✅ GO-LIVE CHECKLIST SELESAI"
echo "   Periksa setiap item di atas — semua harus sehat (active, HTTP 200, ada backup)."
echo "   Jika semua ✓, server siap menerima traffic publik."
echo "=========================================="`

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
          <Badge variant="secondary">20 Langkah · 0→19</Badge>
        </div>
        <h1 className="mt-3 text-xl font-semibold tracking-tight">
          Panduan Server Rust — Lawu-2.5-Fine
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          Diterapkan pada {LAWU_HARDWARE.cpu} ({LAWU_HARDWARE.cpuDetail}), {LAWU_HARDWARE.ram},{' '}
          {LAWU_HARDWARE.ssd} ({LAWU_HARDWARE.ssdRole}), {LAWU_HARDWARE.hdd} ({LAWU_HARDWARE.hddRole}).
          Panduan lengkap dari server kosong sampai production-ready. Semua blok kode siap disalin
          (tombol Salin di pojok kanan setiap blok).
        </p>
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
          <Terminal className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div>
            <strong className="text-foreground">Urutan eksekusi yang disarankan:</strong>{' '}
            Langkah 0 (bersihkan) → 1 (prerequisites) → 2 (user &amp; dir) → 3 (disk) → 4
            (firewall) → 5-6 (arsitektur &amp; sysctl) → 7 (Rust) → 8-10 (Axum API) → 11-13
            (llama.cpp) → 14 (systemd) → 15 (otomasi) → 16 (load test) → 17 (Nginx) → 18
            (integrasi) → 19 (go-live checklist).
          </div>
        </div>
        <div className="mt-2 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-50 p-3 text-xs text-muted-foreground dark:bg-amber-950/30">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <div>
            <strong className="text-foreground">⚠ User Context — siapa menjalankan apa?</strong>{' '}
            User <code className="rounded bg-muted px-1 py-0.5 text-[10px]">lawu</code> sengaja
            dibuat TANPA sudo (principle of least privilege). Semua perintah <code className="rounded bg-muted px-1 py-0.5 text-[10px]">sudo ...</code>{' '}
            di Langkah <strong>0-6, 14-17</strong> wajib dijalankan sebagai{' '}
            <strong>user admin Anda</strong> (user yang dibuat saat install Debian, punya sudo).
            <br />
            Baru di Langkah <strong>7-13</strong> (Rust, Cargo, llama.cpp build) Anda{' '}
            <code className="rounded bg-muted px-1 py-0.5 text-[10px]">sudo su - lawu</code> dan
            menjalankan sebagai user <code className="rounded bg-muted px-1 py-0.5 text-[10px]">lawu</code>{' '}
            (tanpa sudo — build tidak butuh root).
            <br />
            <strong className="text-amber-700 dark:text-amber-300">
              JANGAN jalankan perintah <code className="rounded bg-amber-100 px-1 py-0.5 text-[10px] dark:bg-amber-900/50">sudo</code> sebagai user lawu — akan error "lawu is not in the sudoers file".
            </strong>
          </div>
        </div>
      </div>

      <div className="mt-6 space-y-8">
        {/* ─── LANGKAH 0: CLEANUP ─── */}
        <Section
          id="cleanup"
          step="0"
          title="Bersihkan Server Sebelum Instalasi"
          desc="Jika server pernah dipakai project Lawu versi lama, jalankan langkah ini DULU. Skip jika server masih fresh."
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
                <strong>0.C (backup)</strong> terlebih dahulu jika ada data yang ingin disimpan.
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

        {/* ─── LANGKAH 1: PREREQUISITES ─── */}
        <Section
          id="prereq"
          step="1"
          title="Prerequisites & Update Sistem"
          desc="Update Debian 13 ke versi terbaru, install build dependencies (gcc, cmake, nginx, ufw, fail2ban, python venv untuk MarkltDown). Semua paket open source dari Debian main repo."
        >
          <CodeBlock code={PREREQ_UPDATE} filename="1.A-apt-update.sh" />
          <CodeBlock code={PREREQ_INSTALL} filename="1.B-apt-install-deps.sh" />
          <CodeBlock code={PREREQ_PYTHON} filename="1.C-python-venv-markitdown.sh" />
        </Section>

        {/* ─── LANGKAH 2: USER & DIREKTORI ─── */}
        <Section
          id="user-setup"
          step="2"
          title="Setup User lawu & Struktur Direktori"
          desc="Buat system user 'lawu' (isolasi privilege), struktur direktori aplikasi di SSD (/opt/lawu) & data di HDD (/mnt/data)."
        >
          <CodeBlock code={USER_SETUP} filename="2.A-create-user-lawu.sh" />
          <CodeBlock code={USER_DIRS} filename="2.B-create-directories.sh" />
        </Section>

        {/* ─── LANGKAH 3: DISK ─── */}
        <Section
          id="disk"
          step="3"
          title="Mount & Format HDD/SSD"
          desc="Identifikasi SSD (OS) vs HDD (DATA), format HDD 500GB sebagai ext4, mount otomatis via fstab, tuning SSD (TRIM, I/O scheduler)."
        >
          <Alert>
            <ShieldAlert />
            <AlertTitle>Hati-hati memilih disk!</AlertTitle>
            <AlertDescription>
              <p>
                Pastikan <code className="rounded bg-muted px-1 py-0.5 text-xs">/dev/sdb</code> di
                Langkah 3.B BENAR-BENAR HDD data kosong, bukan disk OS. Salah format = kehilangan
                sistem. Selalu verifikasi dengan <strong>3.A</strong> dulu sebelum 3.B.
              </p>
            </AlertDescription>
          </Alert>
          <CodeBlock code={DISK_IDENTIFY} filename="3.A-identify-disks.sh" />
          <CodeBlock code={DISK_FORMAT} filename="3.B-format-hdd-ext4.sh" />
          <CodeBlock code={DISK_FSTAB} filename="3.C-fstab-mount.sh" />
          <CodeBlock code={DISK_SSD_TUNING} filename="3.D-ssd-tuning.sh" />
        </Section>

        {/* ─── LANGKAH 4: FIREWALL & SSH ─── */}
        <Section
          id="firewall"
          step="4"
          title="Firewall (UFW) & SSH Hardening"
          desc="Default deny incoming, hanya buka port 22 (SSH), 80 (HTTP), 443 (HTTPS). Disable SSH password auth, wajib SSH key. Install fail2ban untuk auto-ban IP brute-force."
        >
          <Alert variant="destructive">
            <ShieldAlert />
            <AlertTitle>Jangan terkunci dari server!</AlertTitle>
            <AlertDescription>
              <p>
                Sebelum enable UFW &amp; disable SSH password, PASTIKAN Anda sudah setup SSH key
                (Langkah 4.C) DAN test login dengan key di terminal terpisah. Jika gagal, Anda bisa
                kembalikan config dari sesi yang masih hidup.
              </p>
            </AlertDescription>
          </Alert>
          <CodeBlock code={FIREWALL_UFW} filename="4.A-ufw-firewall.sh" />
          <CodeBlock code={SSH_HARDENING} filename="4.B-sshd-hardening.sh" />
          <CodeBlock code={SSH_KEY} filename="4.C-ssh-key-setup.sh" />
          <CodeBlock code={FAIL2BAN} filename="4.D-fail2ban-sshd.sh" />
        </Section>

        {/* ─── LANGKAH 5: ARSITEKTUR ─── */}
        <Section
          id="arsitektur"
          step="5"
          title="Ringkasan Arsitektur"
          desc="Alur data end-to-end dari HDD koleksi ebook hingga dashboard web, termasuk firewall & binding localhost-only."
        >
          <CodeBlock code={ARCH} filename="arsitektur.txt" />
        </Section>

        {/* ─── LANGKAH 6: SYSCTL ─── */}
        <Section
          id="sysctl"
          step="6"
          title="Spesifikasi Infrastruktur & Kernel Tuning (sysctl)"
          desc="Parameter kernel di /etc/sysctl.d/99-lawu-fine.conf + limits.conf untuk file descriptor besar (Axum + Tantivy)."
        >
          <CodeBlock code={SYSCTL} filename="6.A-apply-sysctl.sh" />
          <CodeBlock code={LIMITS_CONF} filename="6.B-apply-limits.sh" />
        </Section>

        {/* ─── LANGKAH 7: RUST ─── */}
        <Section
          id="rust"
          step="7"
          title="Install Rust Toolchain"
          desc="Install Rust via rustup (stable + rustfmt + clippy), set RUSTFLAGS target-cpu=native untuk optimasi AVX2 di i5-10400. Verifikasi murni CPU — tidak ada dependency GPU."
        >
          <CodeBlock code={RUST_INSTALL} filename="7.A-install-rustup.sh" />
          <CodeBlock code={RUST_VERIFY} filename="7.B-verify-rust-cpu.sh" />
        </Section>

        {/* ─── LANGKAH 8: CARGO ─── */}
        <Section
          id="cargo"
          step="8"
          title="Proyek Cargo — lawu-server"
          desc="Inisialisasi project Cargo, paste Cargo.toml + main.rs + schema.rs, build release dengan optimasi native CPU, install binary ke ~/.cargo/bin/."
        >
          <CodeBlock code={CARGO_NEW} filename="8.A-cargo-init.sh" />
          <CodeBlock code={CARGO_TOML} filename="~/lawu-server/Cargo.toml" />
          <CodeBlock code={CARGO_BUILD} filename="8.B-build-release.sh" />
        </Section>

        {/* ─── LANGKAH 9: TANTIVY ─── */}
        <Section
          id="tantivy"
          step="9"
          title="Skema Full-Text Tantivy"
          desc="Skema multi-field (title, body, path, file_type, category, pages, size_bytes, indexed_at) dengan BM25 scoring, FAST field untuk sort numerik."
        >
          <CodeBlock code={TANTIVY} filename="~/lawu-server/src/schema.rs" />
        </Section>

        {/* ─── LANGKAH 10: AXUM API ─── */}
        <Section
          id="api"
          step="10"
          title="Endpoint API Backend (Axum)"
          desc="GET /api/stats · POST /api/search (QueryParser + TopDocs) · POST /api/telegram/test. Bind 127.0.0.1:8081 (akses via Nginx reverse proxy)."
        >
          <CodeBlock code={AXUM_API} filename="~/lawu-server/src/main.rs" />
        </Section>

        {/* ─── LANGKAH 11: BUILD LLAMA.CPP ─── */}
        <Section
          id="llama-build"
          step="11"
          title="Build llama.cpp (Pure CPU)"
          desc="Clone repo llama.cpp (MIT license), build dengan GGML_NATIVE=ON + AVX2 + FMA + F16C untuk i5-10400. Verifikasi binary TIDAK ada dependency CUDA/GPU."
        >
          <CodeBlock code={LLAMA_CLONE} filename="11.A-clone-llamacpp.sh" />
          <CodeBlock code={LLAMA_BUILD} filename="11.B-build-cmake.sh" />
        </Section>

        {/* ─── LANGKAH 12: GGUF QUANTIZE ─── */}
        <Section
          id="gguf"
          step="12"
          title="Konversi & Kuantisasi Model GGUF"
          desc="Konversi HuggingFace → GGUF F16, lalu kuantisasi ke Q4_K_M (4.4 GB untuk model 7B). Verifikasi metadata GGUF."
        >
          <CodeBlock code={GGUF_CONVERT} filename="12.A-convert-hf-to-gguf.sh" />
          <CodeBlock code={GGUF_QUANTIZE} filename="12.B-quantize-q4_k_m.sh" />
        </Section>

        {/* ─── LANGKAH 13: SERVE LLAMA ─── */}
        <Section
          id="llama-serve"
          step="13"
          title="Serve llama.cpp (OpenAI-compatible)"
          desc="Jalankan llama-server dengan -t 6, --mmap, -c 4096, bind 127.0.0.1:8080. Test endpoint /v1/models & /v1/chat/completions. Estimasi 9-14 tok/s di i5-10400."
        >
          <CodeBlock code={LLAMA_SERVE} filename="13.A-serve-llama.sh" />
        </Section>

        {/* ─── LANGKAH 14: SYSTEMD ─── */}
        <Section
          id="systemd"
          step="14"
          title="Unit systemd (Auto-restart & Boot)"
          desc="Dua service: llama-lawu (inference) & lawu-2.5-fine (API Axum). Hardening systemd (NoNewPrivileges, ProtectSystem, PrivateTmp). Auto-restart on crash."
        >
          <CodeBlock code={SYSTEMD_USER} filename="14.A-verify-user.sh" />
          <CodeBlock code={SYSTEMD_LLAMA} filename="/etc/systemd/system/llama-lawu.service" />
          <CodeBlock code={SYSTEMD_AXUM} filename="/etc/systemd/system/lawu-2.5-fine.service" />
          <CodeBlock code={SYSTEMD_ENABLE} filename="14.B-enable-services.sh" />
        </Section>

        {/* ─── LANGKAH 15: OTOMASI ─── */}
        <Section
          id="otomasi"
          step="15"
          title="Otomasi Pemantauan & Operasional"
          desc="File watcher inotifywait, backup harian (retensi 7 hari), laporan error harian via Telegram. Cron jobs & environment file /etc/lawu/env."
        >
          <CodeBlock code={WATCH_SCRIPT} filename="/opt/lawu/scripts/watch_ebooks.sh" />
          <CodeBlock code={BACKUP_SCRIPT} filename="/opt/lawu/scripts/backup_lawu.sh" />
          <CodeBlock code={ERROR_REPORT} filename="/opt/lawu/scripts/send_error_report.sh" />
          <CodeBlock code={ENV_FILE} filename="/etc/lawu/env" />
          <CodeBlock code={CRONTAB} filename="crontab -e (user lawu)" />
        </Section>

        {/* ─── LANGKAH 16: K6 LOAD TEST ─── */}
        <Section
          id="k6"
          step="16"
          title="Pengujian Beban (Load Testing k6)"
          desc="Install k6 (AGPL-3.0, open source). Target: p95 latency /api/search < 300ms dengan 20 VUs selama 2 menit. Error rate < 1%."
        >
          <CodeBlock code={K6_INSTALL} filename="16.A-install-k6.sh" />
          <CodeBlock code={K6} filename="~/src/load_test.js" />
        </Section>

        {/* ─── LANGKAH 17: NGINX ─── */}
        <Section
          id="nginx"
          step="17"
          title="Reverse Proxy Nginx"
          desc="Satu port 80: dashboard/API Rust di root, inference llama.cpp di /v1/. Security headers, client_max_body_size 100MB untuk upload ebook, buffering off untuk streaming chat."
        >
          <CodeBlock code={NGINX} filename="/etc/nginx/sites-available/lawu" />
        </Section>

        {/* ─── LANGKAH 18: INTEGRASI ─── */}
        <Section
          id="integrasi"
          step="18"
          title="Integrasi dengan Dashboard"
          desc="Hubungkan dashboard ini ke server nyata: setting endpoint LLM di tab Pengaturan, arahkan fetch ke Nginx :80, setup Telegram bot token."
        >
          <CodeBlock code={INTEGRATE} filename="integrasi-dashboard.txt" />
        </Section>

        {/* ─── LANGKAH 19: GO-LIVE CHECKLIST ─── */}
        <Section
          id="checklist"
          step="19"
          title="Final Go-Live Checklist"
          desc="Audit terakhir SEBELUM buka server ke publik. Cek sistem, disk, firewall, services, ports, API health, cron, backup, memory. Semua harus sehat."
        >
          <Alert>
            <ListChecks />
            <AlertTitle>Jalankan checklist ini sebagai verifikasi akhir</AlertTitle>
            <AlertDescription>
              <p>
                Skrip ini akan cetak status real-time dari semua komponen. Periksa setiap baris —
                jika ada <code className="rounded bg-destructive/10 px-1 py-0.5 text-xs">✗</code> atau
                service <code className="rounded bg-muted px-1 py-0.5 text-xs">inactive</code>,
                FIX dulu sebelum buka port 80 ke publik.
              </p>
            </AlertDescription>
          </Alert>
          <CodeBlock code={CHECKLIST_SCRIPT} filename="19-go-live-checklist.sh" />
        </Section>

        {/* ─── FOOTER RINGKASAN ─── */}
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#34a853]" />
            <div>
              <h3 className="text-sm font-semibold tracking-tight">
                Setelah Langkah 19 selesai
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Server Lawu-2.5-Fine Anda siap menerima traffic publik via port 80 (Nginx). Inference
                &amp; API tetap bind localhost-only (Paten keamanan). Backup harian aktif, fail2ban
                menjaga SSH, UFW membatasi port terbuka. Paten 1-7 terpenuhi semua: Rust backend,
                murni CPU, Linux only, open source, parallel Rayon, Islam Ahlussunnah wal Jama&apos;ah.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
