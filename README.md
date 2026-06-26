# Soatbay Kuzatuvchi Userbot

Telegram guruhlaridagi kunlik ish e'lonlarini kuzatuvchi userbot. Kalit so'z filtri, AI tahlil, bazaga yozish va kanalga nashr.

## Texnologiyalar

| Qism | Texnologiya |
|------|-------------|
| Backend | NestJS, TypeORM, GramJS |
| Frontend | Angular 18 (admin panel) |
| Baza (mahalliy) | SQLite |
| Baza (Render) | Supabase PostgreSQL |
| AI | Groq / Gemini (bepul) |
| Hosting | Render.com (bepul) |

## Tez boshlash

```bash
# 1. Sozlash
cp backend/.env.example backend/.env
# .env ni to'ldiring

# 2. Backend
cd backend && npm install && npm run start:dev

# 3. Frontend (yangi terminal)
cd frontend && npm install && npm start
```

## Hujjatlar

| Fayl | Maqsad |
|------|--------|
| [testing.md](./testing.md) | Mahalliy test — har qadam batafsil |
| [deployment.md](./deployment.md) | Render deploy — 0 balans, uxlamaslik, frontend |

## Render deploy (qisqa)

1. [testing.md](./testing.md) bo'yicha mahalliy test + `TELEGRAM_SESSION` oling
2. Supabase da PostgreSQL yarating → `DATABASE_URL`
3. GitHub ga yuklang
4. Render Web Service yarating (`render.yaml` yoki qo'lda)
5. UptimeRobot bilan ping qiling (uxlamaslik)

## Arxitektura

```
Guruh xabari → Filter navbati → AI navbati → Kanalga nashr
                  (8 parallel)    (2-3 parallel)
```

Telegram handler bloklanmaydi — og'ir ish navbatda bajariladi.

## Production build

```bash
bash scripts/build-production.sh   # Frontend + Backend
bash scripts/pre-deploy-check.sh   # Deploy oldidan tekshiruv
```
# sbay-ubot
# sbay-ubot
