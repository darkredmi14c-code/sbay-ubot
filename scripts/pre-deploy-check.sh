#!/usr/bin/env bash
# Mahalliy testdan oldin tekshiruv
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

ok() { echo -e "${GREEN}✓${NC} $1"; }
fail() { echo -e "${RED}✗${NC} $1"; exit 1; }

echo "=== Soatbay pre-deploy tekshiruvi ==="

# Node
node -v | grep -qE "v(18|20|22)" && ok "Node.js versiya" || fail "Node.js 18+ kerak"

# .env
[ -f backend/.env ] && ok "backend/.env mavjud" || fail "backend/.env yo'q — cp backend/.env.example backend/.env"

source backend/.env 2>/dev/null || true

[ -n "${TELEGRAM_API_ID:-}" ] && ok "TELEGRAM_API_ID" || fail "TELEGRAM_API_ID bo'sh"
[ -n "${TELEGRAM_API_HASH:-}" ] && ok "TELEGRAM_API_HASH" || fail "TELEGRAM_API_HASH bo'sh"
[ -n "${TELEGRAM_SESSION:-}" ] && ok "TELEGRAM_SESSION" || fail "TELEGRAM_SESSION bo'sh — avval mahalliy kirish qiling"
[ -n "${GROQ_API_KEY:-}" ] && ok "GROQ_API_KEY" || fail "GROQ_API_KEY bo'sh"

# Build
echo ""
echo "Build tekshiruvi..."
bash scripts/build-production.sh

[ -f backend/public/index.html ] && ok "Frontend backend/public da" || fail "Frontend nusxalanmadi"
[ -f backend/dist/main.js ] && ok "Backend dist" || fail "Backend build xato"

echo ""
echo -e "${GREEN}Hammasi tayyor — Render ga deploy qilish mumkin!${NC}"
