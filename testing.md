# Soatbay Kuzatuvchi — To'liq Test Qo'llanmasi

Bu qo'llanma botni **Render ga yuklashdan oldin** mahalliy kompyuteringizda 100% ishonch hosil qilish uchun yozilgan. Har bir qadamda **nima qilish**, **nima ko'rish** va **xato bo'lsa nima qilish** ko'rsatilgan.

---

## Mundarija

1. [Oldindan tayyorgarlik](#1-oldindan-tayyorgarlik)
2. [Hisoblar ochish](#2-hisoblar-ochish)
3. [Loyihani yuklab olish va sozlash](#3-loyihani-yuklab-olish-va-sozlash)
4. [Backend ishga tushirish va Telegram kirish](#4-backend-ishga-tushirish-va-telegram-kirish)
5. [Frontend (admin panel) ishga tushirish](#5-frontend-admin-panel-ishga-tushirish)
6. [Admin panel sozlash](#6-admin-panel-sozlash)
7. [Test ssenariylari (batafsil)](#7-test-ssenariylari-batafsil)
8. [Production build sinovi](#8-production-build-sinovi)
9. [Deploy oldidan checklist](#9-deploy-oldidan-checklist)
10. [Muammolar va yechimlar (to'liq)](#10-muammolar-va-yechimlar-toliq)

---

## 1. Oldindan tayyorgarlik

### 1.1 Kerakli dasturlar

Terminal oching va tekshiring:

```bash
node -v    # v20.x.x yoki v18.x.x bo'lishi kerak
npm -v     # 9 yoki undan yuqori
git --version
```

Agar Node.js yo'q bo'lsa: [nodejs.org](https://nodejs.org) dan **LTS (20.x)** versiyasini o'rnating.

**Mac (Homebrew):**
```bash
brew install node@20
```

**Windows:** nodejs.org dan installer yuklab o'rnating, terminalni qayta oching.

### 1.2 Telegram akkaunt talablari

- Oddiy Telegram akkaunt (bot emas, **userbot** uchun shaxsiy akkaunt)
- Telefon raqamiga kirish huquqi (SMS kod keladi)
- Agar ikki bosqichli parol yoqilgan bo'lsa — parolni bilishingiz kerak

### 1.3 Test uchun Telegram resurslari

Oldindan tayyorlang:

| Resurs | Nima uchun | Qanday yaratish |
|--------|-----------|-----------------|
| Test guruhi | Xabar yuborib sinash | Telegram da yangi guruh yarating |
| E'lon beruvchi kanali | Employer postlar | Kanal yarating, userbotni admin qiling |
| Ishchi kanali | Seeker postlar | Kanal yarating, userbotni admin qiling |

> Userbot (sizning shaxsiy akkauntingiz) bu guruh va kanallarda **a'zo/admin** bo'lishi shart.

---

## 2. Hisoblar ochish

### 2.1 Telegram API (my.telegram.org)

1. Brauzerda [https://my.telegram.org](https://my.telegram.org) oching
2. Telefon raqamingizni kiriting → Telegram kodini kiriting
3. **API development tools** ni bosing
4. Formani to'ldiring:
   - **App title:** `Soatbay Bot` (ixtiyoriy)
   - **Short name:** `soatbay` (ixtiyoriy, faqat harf)
   - **Platform:** Desktop
5. **Create application** bosing
6. Quyidagilarni **xavfsiz joyga** yozing:

```
api_id:     12345678        ← raqam
api_hash:   abcd1234...     ← 32 belgili matn
```

> ⚠️ Bu kalitlar sizning Telegram akkauntingizga bog'langan. GitHub ga yuklamang!

### 2.2 Groq AI (bepul)

1. [https://console.groq.com](https://console.groq.com) ga kiring
2. Google yoki GitHub bilan ro'yxatdan o'ting
3. Chap menyudan **API Keys** → **Create API Key**
4. Nom bering: `soatbay-test`
5. Kalitni nusxalang — `gsk_` bilan boshlanadi

**Bepul limit (taxminan):**
- Kuniga ~14 000 so'rov (modelga qarab)
- Daqiqada ~30 so'rov
- Test va kichik production uchun yetarli

### 2.3 Supabase (production bazasi — Render uchun)

Bu bosqich **mahalliy testda ixtiyoriy**, lekin Render ga yuklashdan oldin qilish tavsiya etiladi.

1. [https://supabase.com](https://supabase.com) ga kiring
2. **Start your project** → GitHub bilan kiring
3. **New project:**
   - Name: `soatbay`
   - Database Password: **murakkab parol** yozing va saqlang!
   - Region: `Frankfurt (eu-central-1)` — Render bilan yaqin
4. Project yaratilguncha kuting (~2 daqiqa)
5. **Project Settings → Database** ga o'ting
6. **Connection string → URI** ni nusxalang:

```
postgresql://postgres.xxxxx:[YOUR-PASSWORD]@aws-0-eu-central-1.pooler.supabase.com:6543/postgres
```

> Bu `DATABASE_URL` — Render da ishlatiladi. Mahalliy testda SQLite yetarli.

---

## 3. Loyihani yuklab olish va sozlash

### 3.1 Loyiha papkasiga o'tish

```bash
cd "/Users/muhammadrizotursunov/private/dark projects/soatbay-kuzatuvchi-userbot"
```

(Yoki o'zingiz qayerda saqlagan bo'lsangiz)

### 3.2 Environment faylini yaratish

```bash
cp backend/.env.example backend/.env
```

### 3.3 `.env` faylini to'ldirish

`backend/.env` ni matn muharririda oching (VS Code, Notepad++ va hokazo):

```env
# ─── TELEGRAM ───
TELEGRAM_API_ID=12345678
TELEGRAM_API_HASH=abcdef1234567890abcdef1234567890
TELEGRAM_SESSION=

# ─── AI ───
AI_PROVIDER=groq
GROQ_API_KEY=gsk_sizning_kalitingiz
GROQ_MODEL=llama-3.1-8b-instant

# ─── SERVER (mahalliy) ───
PORT=3000
NODE_ENV=development
CORS_ORIGIN=http://localhost:4200

# ─── BAZA (mahalliy SQLite) ───
DATABASE_PATH=./data/soatbay.db

# ─── NAVBAT ───
QUEUE_CONCURRENCY=8
AI_QUEUE_CONCURRENCY=3

# ─── XAVFSIZLIK ───
ADMIN_API_KEY=
```

**Har bir qator tushuntirilishi:**

| O'zgaruvchi | Majburiy | Tushuntirish |
|-------------|----------|--------------|
| `TELEGRAM_API_ID` | Ha | my.telegram.org dan olingan raqam |
| `TELEGRAM_API_HASH` | Ha | my.telegram.org dan olingan hash |
| `TELEGRAM_SESSION` | Birinchi marta bo'sh | Backend birinchi ishga tushganda yaratiladi |
| `GROQ_API_KEY` | Ha | console.groq.com dan |
| `CORS_ORIGIN` | Ha | Frontend manzili (mahalliy: localhost:4200) |
| `ADMIN_API_KEY` | Ixtiyoriy (mahalliy) | Production da majburiy |

**API kalit yaratish (ixtiyoriy):**
```bash
bash scripts/generate-api-key.sh
# Chiqgan qiymatni ADMIN_API_KEY ga qo'ying
```

### 3.4 Paketlarni o'rnatish

```bash
cd backend && npm install && cd ..
cd frontend && npm install && cd ..
```

Kutilgan natija: xato yo'q, `added XXX packages` ko'rinadi.

---

## 4. Backend ishga tushirish va Telegram kirish

### 4.1 Backend ni ishga tushirish

```bash
cd backend
npm run start:dev
```

**Kutilgan loglar:**
```
[Nest] ... LOG [NestFactory] Starting Nest application...
[Nest] ... LOG [KeywordsService] Kalit so'zlar keshi yangilandi: 0 ta
[Nest] ... LOG [GroupsService] Guruhlar keshi yangilandi: 0 ta
? Telefon raqamingiz (+998...):
```

### 4.2 Telegram ga kirish (birinchi marta)

Terminal sizdan ketma-ket so'raydi:

**1-qadam — Telefon raqam:**
```
+998901234567
```
Format: `+` bilan xalqaro kod.

**2-qadam — Telegram kodi:**
Telegram ilovangizga kelgan 5 xonali kod:
```
12345
```

**3-qadam — Ikki bosqichli parol:**
Agar yoqilmagan bo'lsa — shunchaki **Enter** bosing.
```
(bo'sh — Enter bosing)
```

**Muvaffaqiyatli kirish loglari:**
```
[Nest] ... LOG [TelegramClientService] Telegram ulandi: @sizning_username
[Nest] ... LOG [Bootstrap] Server ishga tushdi: port 3000
[Nest] ... LOG [Bootstrap] Frontend: topilmadi (faqat API)
[Nest] ... LOG [Bootstrap] Baza: SQLite
```

**MUHIM — Session saqlash:**

Terminalda quyidagiga o'xshash satr chiqadi:
```
WARN [TelegramClientService] Yangi TELEGRAM_SESSION yaratildi — .env fayliga saqlang!
WARN [TelegramClientService] TELEGRAM_SESSION=1BVtsOHwBu4T...
```

1. `TELEGRAM_SESSION=` dan keyingi **butun matnni** nusxalang
2. `backend/.env` faylida `TELEGRAM_SESSION=` qatoriga qo'ying
3. Backend ni to'xtating (`Ctrl+C`) va qayta ishga tushiring
4. Endi telefon kodi so'ralmasligi kerak

### 4.3 Backend tekshiruvi

Yangi terminal oching:

```bash
curl http://localhost:3000/api/health
```

**Kutilgan javob:**
```json
{
  "status": "ok",
  "timestamp": "2026-06-25T...",
  "uptime": 42.5,
  "database": "connected",
  "telegram": "connected",
  "frontend": "not_built",
  "version": "1.0.0"
}
```

```bash
curl http://localhost:3000/api/ping
# {"pong":true,"ts":1719345678901}
```

Agar `"telegram": "disconnected"` bo'lsa — `.env` dagi session ni tekshiring.

---

## 5. Frontend (admin panel) ishga tushirish

### 5.1 Ishga tushirish

Yangi terminal (backend ishlab turgan bo'lishi kerak):

```bash
cd frontend
npm start
```

**Kutilgan natija:**
```
** Angular Live Development Server is listening on localhost:4200 **
✔ Compiled successfully.
```

### 5.2 Brauzerda ochish

[http://localhost:4200](http://localhost:4200) oching.

**Ko'rishingiz kerak:**
- Chap tomonda qora sidebar: Soatbay Kuzatuvchi
- Menyu: Bosh sahifa, Kalit so'zlar, Guruhlar, Sozlamalar, Baza
- Bosh sahifada statistika kartochkalari

Agar `Backend bilan aloqa yo'q` xabari chiqsa:
- Backend `localhost:3000` da ishlayaptimi tekshiring
- Frontend terminalida proxy xatosi bormi qarang

### 5.3 API kalit (agar o'rnatgan bo'lsangiz)

Sidebar pastidagi **API kalit** maydoniga `ADMIN_API_KEY` qiymatini kiriting.

---

## 6. Admin panel sozlash

### 6.1 Kalit so'zlar

1. **Kalit so'zlar** menyusiga o'ting
2. **Bitta qo'shish** maydoniga: `kunlik ish` → **Qo'shish**
3. Qo'shimcha so'zlar:
   - `ishchi kerak`
   - `kunlik`
   - `ish joyi`
   - `bo'shman`

**Ro'yxat bilan qo'shish sinovi:**
```
kunlik ish
ishchi kerak
bugun ish
ertaga ish
```
→ **Ro'yxatni saqlash**

**Tekshirish:** Jadvalda 4+ qator ko'rinishi kerak.

### 6.2 Guruhlar

1. **Guruhlar** menyusiga o'ting
2. Test guruhingizni qo'shing

**Guruh ID topish (eng ishonchli usul):**

Usul A — @userinfobot:
1. Test guruhingizga [@userinfobot](https://t.me/userinfobot) ni qo'shing
2. Guruhga biror xabar yuboring
3. Bot guruh ID sini yuboradi: `-1001234567890`

Usul B — Telegram Web:
1. [web.telegram.org](https://web.telegram.org) da guruhga kiring
2. URL da `#`-dan keyingi raqamni oling

3. **Guruhlar** sahifasiga `-1001234567890` kiriting → **Qo'shish**

**Tekshirish:** Backend logida:
```
LOG [TelegramClientService] Guruh hal qilindi: ...
```
yoki guruh allaqachon raqamli ID bilan qo'shilgan bo'lsa — hech narsa chiqmasligi normal.

### 6.3 Kanallar

1. **Sozlamalar** menyusiga o'ting
2. **E'lon beruvchilar kanali:** employer test kanalingiz ID si
3. **Ishchilar kanali:** seeker test kanalingiz ID si
4. **Saqlash**

**Kanal ID topish:**
- @userinfobot ni kanalga admin qiling, `/start` yuboring
- yoki kanal havolasidan: `@kanal_nomi` ishlatish mumkin

**Userbot kanal huquqlari (majburiy):**
- ✅ Post messages (xabar yuborish)
- ✅ Edit messages (ixtiyoriy)

---

## 7. Test ssenariylari (batafsil)

Har bir testdan oldin **Bosh sahifa** ni ochib qo'ying — raqamlar o'zgarishini kuzating.

### Test 1: Backend sog'lomligi ✅

```bash
curl -s http://localhost:3000/api/health | python3 -m json.tool
```

| Maydon | Kutilgan |
|--------|----------|
| status | ok |
| database | connected |
| telegram | connected |

### Test 2: Kalit so'z filtri ✅

**Harakat:** Test guruhiga kalit so'z **yo'q** xabar yuboring:
```
Salom hammaga, qalaysizlar?
```

**Kutilgan:**
- Kanalga hech narsa kelmaydi
- Bosh sahifada "O'tkazib yuborilgan" biroz oshishi mumkin
- Backend logida AI chaqiruvi **yo'q**

### Test 3: E'lon beruvchi (employer) ✅

**Harakat:** Test guruhiga yuboring:
```
Kunlik ish kerak! Bugun 3 ta yukchi kerak, tozalash ishi.
Tel: +998901234567
Manzil: Chilonzor
```

**Kutilgan (30 soniya ichida):**
1. Backend log: `Nashr qilindi: employer — user XXXXX`
2. Bosh sahifa: "Nashr qilingan" +1
3. Bosh sahifa: "E'lon beruvchilar" +1
4. Employer kanalida:
   - Forward qilingan xabar
   - Reply: profil ma'lumotlari (ism, ID, username, telefon)
5. **Baza** sahifasida yangi qator

### Test 4: Ishchi qidiruvchi (seeker) ✅

**Harakat:** Boshqa akkauntdan (yoki do'stingizdan) yuboring:
```
Kunlik ish qidirmoqdaman, bugun va ertaga bo'shman. Tajribam bor.
```

**Kutilgan:**
- `{ isDailyWork: true, type: "seeker" }`
- Seeker kanaliga nashr
- Baza → Ishchilar +1

### Test 5: Takroriy foydalanuvchi ✅

**Harakat:** Test 3 dagi **xuddi shu odam** yana xabar yuborsin.

**Kutilgan:**
- Hech narsa nashr qilinmaydi
- "O'tkazib yuborilgan" oshadi
- Baza soni o'zgarmaydi

### Test 6: Doimiy ish (rad etish) ✅

**Harakat:**
```
Doimiy ishga qabul qilamiz! Ofis xodimi kerak, maosh 5 mln+
```

**Kutilgan:**
- AI `isDailyWork: false` deb rad etadi
- Nashr qilinmaydi
- Backend log: `Rad etildi`

### Test 7: Bot xabari ✅

Agar guruhda bot xabar yuborsa — bot uni e'tiborsiz qoldiradi. Buni to'g'ridan-to'g'ri sinash qiyin; mantiqiy jihatdan bot `isBot: true` filtri orqali o'tkazib yuboriladi.

### Test 8: Navbat yuklamasi (ixtiyoriy)

Tez ketma-ket 10+ xabar yuboring. Bosh sahifada "Navbatda" vaqtincha oshishi, keyin kamayishi kerak. Bot qotmasligi kerak.

---

## 8. Production build sinovi

Render ga yuklashdan oldin **mahalliy production build** ni sinab ko'ring:

```bash
# Loyiha ildizida
bash scripts/build-production.sh
```

**Kutilgan chiqish:**
```
==> Frontend build...
✔ Building...
==> Backend build...
==> Frontend ni backend/public ga nusxalash...
==> Build muvaffaqiyatli!
index.html  main-XXX.js  styles-XXX.css  ...
```

**Production rejimda sinash:**

```bash
cd backend
NODE_ENV=production node dist/main.js
```

Brauzerda: [http://localhost:3000](http://localhost:3000) — admin panel ochilishi kerak (4200 emas!).

```bash
curl http://localhost:3000/api/health
# "frontend": "served" bo'lishi kerak
```

**Avtomatik to'liq tekshiruv:**
```bash
bash scripts/pre-deploy-check.sh
```

Hammasi yashil ✓ bo'lsa — Render ga yuklashga tayyorsiz.

---

## 9. Deploy oldidan checklist

Quyidagilarni bosib o'ting:

```
□ Node.js 18+ o'rnatilgan
□ backend/.env to'ldirilgan
□ TELEGRAM_SESSION olingan va .env da saqlangan
□ GROQ_API_KEY ishlayapti
□ Admin panel ochiladi (localhost:4200)
□ Bosh sahifada Telegram = Ulangan
□ Kamida 1 kalit so'z qo'shilgan
□ Kamida 1 guruh qo'shilgan
□ 2 ta kanal sozlangan
□ Test 3 (employer) muvaffaqiyatli o'tdi
□ Test 4 (seeker) muvaffaqiyatli o'tdi
□ bash scripts/build-production.sh xatosiz
□ bash scripts/pre-deploy-check.sh xatosiz
□ Supabase DATABASE_URL tayyor (Render uchun)
□ ADMIN_API_KEY yaratilgan (Render uchun)
□ GitHub repoga yuklangan
```

Hammasi ✓ bo'lsa → [deployment.md](./deployment.md) ga o'ting.

---

## 10. Muammolar va yechimlar (to'liq)

### ❌ `Telefon raqamingiz` so'rovi chiqmayapti / darhol xato

**Sabab:** `TELEGRAM_API_ID` yoki `TELEGRAM_API_HASH` noto'g'ri.

**Yechim:**
1. my.telegram.org dan qayta tekshiring
2. `.env` da bo'sh joy yo'qligini tekshiring
3. Backend ni qayta ishga tushiring

---

### ❌ `TELEGRAM_SESSION yaroqsiz`

**Sabab:** Session to'liq nusxalanmagan yoki eskirgan.

**Yechim:**
1. `.env` dan `TELEGRAM_SESSION=` qatorini o'chiring (bo'sh qoldiring)
2. Backend ni qayta ishga tushiring, qaytadan kiring
3. Yangi session ni to'liq nusxalang (odatda 300+ belgi)

---

### ❌ Guruh xabarlari kelmayapti

| Tekshirish | Qanday |
|------------|--------|
| Userbot guruhda a'zo mi? | Telegram da guruh a'zolarini ko'ring |
| Guruh ID to'g'ri mi? | `-100` bilan boshlanishi kerak |
| Guruh active mi? | Admin panel → Guruhlar |
| Kalit so'z mos keladimi? | Xabarda kalit so'z bo'lishi shart |

Backend logida `Guruh hal qilinmadi` bo'lsa — userbot guruhda yo'q yoki username noto'g'ri.

---

### ❌ AI ishlamayapti / Groq xato

**429 Too Many Requests:**
- `AI_QUEUE_CONCURRENCY=2` qiling
- 1-2 daqiqa kuting

**401 Unauthorized:**
- `GROQ_API_KEY` noto'g'ri — yangi kalit yarating

**Zaxira — Gemini:**
```env
AI_PROVIDER=gemini
GEMINI_API_KEY=your_key
```
[Google AI Studio](https://aistudio.google.com) dan bepul kalit oling.

---

### ❌ Kanalga xabar bormayapti

1. Userbot kanalda **admin** mi?
2. Sozlamalar → kanal ID to'g'ri mi?
3. Bosh sahifa → **Oxirgi xato** qatorini o'qing
4. Backend log: `employer kanali sozlanmagan` — sozlamalarni saqlang

---

### ❌ Forward ishlamaydi

Ba'zi guruhlar forward ni taqiqlaydi (`noforwards`). Bot avtomatik ravishda:
1. Forward sinab ko'radi
2. Agar ishlamasa — profil + xabar matni/linkini to'g'ridan-to'g'ri yuboradi

Bu normal holat, xato emas.

---

### ❌ Frontend: Backend bilan aloqa yo'q

```bash
# Backend ishlayaptimi?
curl http://localhost:3000/api/ping

# Frontend proxy
# frontend/proxy.conf.json → localhost:3000 ga yo'naltirilgan
```

Frontend ni qayta ishga tushiring: `npm start`

---

### ❌ `npm install` xato (better-sqlite3)

**Mac:**
```bash
xcode-select --install
```

**Linux:**
```bash
sudo apt install build-essential python3
```

---

### ❌ Build xato (Render oldidan mahalliy)

```bash
rm -rf backend/node_modules frontend/node_modules
rm -rf backend/dist frontend/dist
cd backend && npm install && cd ..
cd frontend && npm install && cd ..
bash scripts/build-production.sh
```

---

**Keyingi qadam:** [deployment.md](./deployment.md) — Render ga to'liq deploy qo'llanmasi.
