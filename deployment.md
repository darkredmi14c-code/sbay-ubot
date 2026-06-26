# Render ga Deploy — Sodda Qo'llanma

Bu qo'llanma **eng sodda yo'l**. Faqat kerakli qadamlar, ortiqcha tushuntirish yo'q.

> **Oldin:** [testing.md](./testing.md) bo'yicha kompyuteringizda botni ishga tushiring va `TELEGRAM_SESSION` oling.

---

## Nima qayerda ishlaydi?

```
Sizning kompyuter (test)  →  GitHub  →  Render (internetda 24/7)
                                              ↓
                                    Admin panel + Bot bir joyda
                                    https://SIZNING-NOM.onrender.com
```

**Frontend alohida emas** — admin panel shu URL da ochiladi.

---

## 3 ta bepul xizmat kerak

| # | Xizmat | Nima qiladi | Link |
|---|--------|-------------|------|
| 1 | **GitHub** | Kod saqlash | github.com |
| 2 | **Supabase** | Ma'lumotlar bazasi (yo'qolmasin) | supabase.com |
| 3 | **Render** | Bot serveri | render.com |
| 4 | **UptimeRobot** | Bot uxlamasin | uptimerobot.com |
| 5 | **Groq** | AI (allaqachon bor) | console.groq.com |

---

## QADAM 1 — Supabase (baza)

Ma'lumotlar saqlanishi uchun **SQLite yetmaydi** — Render qayta ishga tushganda o'chib ketadi.

1. [supabase.com](https://supabase.com) → **New project**
2. Parol o'ylab toping va **yozib qo'ying** (masalan: `MeningParol123!`)
3. Region: **Frankfurt**
4. Project tayyor bo'lgach → **Settings** → **Database**
5. **Connection string** → **URI** → **Use connection pooling** yoqing
6. Parolni qo'yib, butun linkni nusxalang:

```
postgresql://postgres.xxxxx:SIZNING_PAROL@aws-0-eu-central-1.pooler.supabase.com:6543/postgres
```

Bu — `DATABASE_URL`. Keyinroq Render ga qo'yasiz.

---

## QADAM 2 — GitHub

Terminalda (loyiha papkasida):

```bash
git init
git add .
git commit -m "first commit"
git remote add origin https://github.com/SIZNING_NOM/soatbay-kuzatuvchi-userbot.git
git push -u origin main
```

---

## QADAM 3 — Render da servis yaratish

1. [render.com](https://render.com) → GitHub bilan kiring
2. **New +** → **Web Service**
3. Repozitoriyani tanlang
4. Quyidagilarni **aynan** kiriting:

| Maydon | Qiymat |
|--------|--------|
| Name | `soatbay-bot` (yoki istalgan) |
| Region | Frankfurt |
| Branch | main |
| Runtime | Node |
| **Build Command** | `bash scripts/build-production.sh` |
| **Start Command** | `cd backend && node dist/main.js` |
| Instance Type | **Free** |

5. **Advanced** oching → **Health Check Path:** `/api/ping`

6. **Environment** bo'limiga quyidagilarni qo'shing:

```
TELEGRAM_API_ID=12345678
TELEGRAM_API_HASH=abcdef...
TELEGRAM_SESSION=1BVtsOHwBu4T... (testing.md dan — uzun matn!)
GROQ_API_KEY=gsk_...
DATABASE_URL=postgresql://postgres.xxxxx:PAROL@...supabase.com:6543/postgres
NODE_ENV=production
CORS_ORIGIN=https://soatbay-bot.onrender.com
ADMIN_API_KEY=bash scripts/generate-api-key.sh dan olingan kalit
QUEUE_CONCURRENCY=6
AI_QUEUE_CONCURRENCY=2
```

**Muhim qoidalar:**
- `PORT` **QO'SHMANG** — Render o'zi beradi
- `CORS_ORIGIN` — o'z Render URL ingiz (yuqoridagi misoldagi kabi)
- `TELEGRAM_SESSION` — bo'sh qoldirmang!

7. **Create Web Service** bosing → 5-10 daqiqa kuting

---

## QADAM 4 — Tekshirish

Deploy tugagach brauzerda oching:

```
https://SIZNING-NOM.onrender.com
```

Admin panel ko'rinishi kerak.

Sidebar pastida **API kalit** maydoniga `ADMIN_API_KEY` ni kiriting.

**Bosh sahifa** da **Telegram: Ulangan** bo'lishi kerak.

Terminalda (ixtiyoriy):
```bash
curl https://SIZNING-NOM.onrender.com/api/ping
# {"pong":true,"ts":...}
```

---

## QADAM 5 — Bot UXLAMASIN (eng muhim!)

Render bepul rejimda **15 daqiqa** hech kim kirmasa bot uxlaydi. Userbot uxlaganda guruh xabarlarini ko'rmaydi.

**Yechim — UptimeRobot (5 daqiqa, bepul):**

1. [uptimerobot.com](https://uptimerobot.com) → ro'yxatdan o'ting
2. **Add New Monitor**
3. To'ldiring:
   - Monitor Type: **HTTP(s)**
   - URL: `https://SIZNING-NOM.onrender.com/api/ping`
   - Monitoring Interval: **5 minutes**
4. **Create Monitor**

Tayyor. Endi bot **hech qachon uxlamaydi**.

> Birinchi marta uyg'onish 30-60 soniya olishi mumkin — bu normal.

---

## QADAM 6 — Admin panel sozlash

Render URL oching → quyidagilarni to'ldiring:

1. **Kalit so'zlar** — kuzatiladigan so'zlar
2. **Guruhlar** — kuzatiladigan guruh ID lari
3. **Sozlamalar** — kanal ID lari
4. **Foydalanuvchilar** — bazadagi odamlar (employer / ishchi / spamchi)

Userbot guruhlarda **a'zo**, kanallarda **admin** bo'lishi shart.

---

## Frontend qayerda?

**Alohida deploy kerak emas.**

Build vaqtida Angular avtomatik yig'iladi va backend bilan birga ishlaydi:

| Manzil | Nima |
|--------|------|
| `https://SIZNING-NOM.onrender.com` | Admin panel |
| `https://SIZNING-NOM.onrender.com/api/...` | Backend API |

Mahalliy testda frontend alohida (`localhost:4200`), Render da **hammasi bitta URL** da.

---

## Yangilash

Kod o'zgartirsangiz:

```bash
git add .
git commit -m "o'zgarish"
git push
```

Render avtomatik qayta deploy qiladi.

---

## Muammo bo'lsa

| Belgilar | Sabab | Nima qilish |
|----------|-------|-------------|
| Telegram: Ulanmagan | Session yo'q/noto'g'ri | testing.md → session oling → Render Environment ga qo'ying |
| Ma'lumotlar yo'qoldi | DATABASE_URL yo'q | Supabase URL qo'shing (QADAM 1) |
| Bot kech qayta ishlaydi | Uxlab qolgan | UptimeRobot qo'shing (QADAM 5) |
| Admin panel 404 | Build xato | Render → Logs → `Build muvaffaqiyatli!` bormi? |
| `ng: not found` build xatosi | `NODE_ENV=production` da devDependencies o'rnatilmaydi | `scripts/build-production.sh` da `npm ci --include=dev` ishlatiladi (repo yangilang) |
| 401 xato | API kalit | Sidebar ga ADMIN_API_KEY kiriting |

Render **Logs** tab — har doim birinchi qarab chiqing.

---

## Xulosa — 6 qadam

```
1. Supabase → DATABASE_URL
2. GitHub → kod yuklash
3. Render → Web Service + env o'zgaruvchilar
4. Tekshirish → URL ochish
5. UptimeRobot → har 5 daqiqa ping
6. Admin panel → sozlash
```

**Xarajat: $0/oy**

---

Batafsil test: [testing.md](./testing.md)
