#!/usr/bin/env bash
# Render va production uchun to'liq build skripti
# Backend + Frontend birgalikda yig'iladi
set -euo pipefail

echo "==> Node versiya: $(node -v)"
echo "==> Frontend build..."

cd frontend
npm ci
npm run build
cd ..

echo "==> Backend build..."
cd backend
npm ci
npm run build

echo "==> Frontend ni backend/public ga nusxalash..."
rm -rf public
mkdir -p public
cp -r ../frontend/dist/frontend/browser/* public/

echo "==> Build muvaffaqiyatli!"
ls -la public/
