# MLN Management System — Separated Backend / Frontend

## Struktur

```text
MLN_Management_Separated_Vercel/
├── backend-gas/
│   ├── Code.gs
│   ├── Config.gs
│   ├── Database.gs
│   ├── Auth.gs
│   ├── DeviceService.gs
│   ├── SiteService.gs
│   ├── TicketService.gs
│   ├── PasswordResetService.gs
│   ├── ... service lainnya
│   └── appsscript.json
│
└── frontend-vercel/
    ├── index.html
    ├── styles.css
    ├── app.js
    ├── api/
    │   └── gas.js
    ├── vercel.json
    └── .env.example
```

## Arsitektur

```text
Browser
   ↓ HTTPS
Vercel Frontend
   ↓ same-origin /api/gas
Vercel Function (proxy)
   ↓ HTTPS + shared secret
Google Apps Script API
   ↓
Google Sheets
```

### Kenapa memakai proxy Vercel?

- Frontend tidak lagi bergantung pada `google.script.run`.
- Secret backend tidak ada di browser.
- Tidak perlu expose API secret di GitHub.
- Menghindari masalah CORS browser terhadap Apps Script Web App.
- Backend Google Sheets dan seluruh logic existing tetap dipertahankan.

## Urutan migrasi

1. Deploy / update `backend-gas` di Google Apps Script.
2. Jalankan `setupApplication()`.
3. Jalankan `setupApiSharedSecret()`.
4. Deploy Apps Script sebagai Web App dan copy URL `/exec`.
5. Push folder repo ini ke GitHub.
6. Import **frontend-vercel** ke Vercel.
7. Set `GAS_API_URL` dan `GAS_API_SECRET`.
8. Deploy.
9. Test Login, Dashboard, Device, Site, Permit, Forgot Password, dan Tiket Gangguan.

## Penting

Setelah frontend pindah ke Vercel, URL Apps Script `/exec` adalah **backend API**, bukan lagi halaman aplikasi.
