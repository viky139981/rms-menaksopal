# MLN Management System — Frontend Vercel

Frontend statis (HTML/CSS/JS) untuk MLN Management System.

## Arsitektur

Browser
→ `/api/gas` (Vercel Function)
→ Google Apps Script Web App
→ Google Sheets

`GAS_API_SECRET` hanya tersedia di Vercel Function dan tidak dikirim ke browser.

## Deploy ke Vercel

1. Push folder ini ke GitHub.
2. Vercel → Add New → Project → import repo.
3. Jika folder ini berada di monorepo, set **Root Directory** ke `frontend-vercel`.
4. Tambahkan Environment Variables:
   - `GAS_API_URL` = URL backend Apps Script yang berakhiran `/exec`
   - `GAS_API_SECRET` = secret yang sama dengan Apps Script
5. Deploy.

Tidak ada build step dan tidak ada framework yang wajib digunakan.

## Local development

Gunakan:

```bash
npx vercel dev
```

Lalu buat `.env.local` berdasarkan `.env.example`.

## Catatan

Jangan letakkan `GAS_API_SECRET` di `app.js`, `index.html`, atau variable frontend publik.
