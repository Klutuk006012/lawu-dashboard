#!/bin/bash
# ============================================
# Lawu-2.5-Fine Dashboard — Deploy Script
# Jalankan di srv-fine sebagai user lawu-web
# ============================================
set -e

echo "=== Lawu-2.5-Fine Dashboard Deploy ==="
echo "User: $(whoami)"
echo "Directory: /opt/lawu-dashboard"
echo ""

# 1. Verifikasi user
if [ "$(whoami)" != "lawu-web" ]; then
  echo "ERROR: Jalankan sebagai user lawu-web"
  echo "  sudo su - lawu-web"
  echo "  cd /opt/lawu-dashboard && bash deploy.sh"
  exit 1
fi

cd /opt/lawu-dashboard

# 2. Copy env production
echo "[1/6] Setup environment..."
cp -n .env.production .env.local 2>/dev/null || true
echo "  .env.local ready"

# 3. Install dependencies
echo "[2/6] Install dependencies (bun install)..."
bun install --frozen-lockfile 2>/dev/null || bun install
echo "  Dependencies installed"

# 4. Generate Prisma client
echo "[3/6] Generate Prisma client..."
bun run db:generate
echo "  Prisma client generated"

# 5. Push database schema (SQLite)
echo "[4/6] Push database schema..."
bun run db:push
echo "  Database ready"

# 6. Build Next.js (standalone output)
echo "[5/6] Build Next.js (production)..."
bun run build 2>&1 | tail -10
echo "  Build complete"

# 7. Stop existing PM2 process if any
echo "[6/6] Start with PM2..."
pm2 delete lawu-dashboard 2>/dev/null || true

# Start Next.js standalone server
pm2 start "bun .next/standalone/server.js" \
  --name lawu-dashboard \
  --cwd /opt/lawu-dashboard \
  --env production

# Save PM2 process list + setup auto-start on boot
pm2 save
pm2 startup systemd -u lawu-web --hp /home/lawu-web 2>&1 | tail -3

echo ""
echo "=== DEPLOY SELESAI ==="
echo "Dashboard: http://192.168.111.103:3000"
echo "PM2 status:"
pm2 list
echo ""
echo "Log realtime:"
echo "  pm2 logs lawu-dashboard"
echo ""
echo "Stop dashboard:"
echo "  pm2 stop lawu-dashboard"
echo "Restart dashboard:"
echo "  pm2 restart lawu-dashboard"
