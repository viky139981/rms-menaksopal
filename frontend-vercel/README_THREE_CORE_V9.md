# MLN Management System — Three Core V9

Frontend Vercel dengan visual **Dark Core Network 3D** berbasis Three.js.

## Yang ditambahkan

- Three.js r187 via ES module/import map.
- Login: globe/network sphere 3D.
- Dashboard: network mesh + moving data-flow particles.
- Cyan/violet glowing nodes dan backbone lines.
- Parallax ringan mengikuti pointer.
- Dashboard metrics memengaruhi kecepatan data-flow.
- Visual otomatis lebih redup pada halaman tabel/form.
- Mobile: jumlah node/particle dikurangi, app background 3D dimatikan.
- `prefers-reduced-motion`: animasi dikurangi secara otomatis.
- Canvas `pointer-events:none`, sehingga tidak mengganggu klik/input.
- Backend Apps Script tidak berubah.

## File baru

```text
three-core.js
```

## File yang berubah

```text
index.html
styles.css
app.js
```

## Deploy

Replace isi folder `frontend-vercel` di repository GitHub dengan isi paket V9 ini.

Kemudian:

1. Commit & push ke `main`.
2. Tunggu Vercel Production Deployment menjadi `Ready`.
3. Buka aplikasi.
4. Hard refresh `Ctrl + Shift + R`.

Tidak perlu mengubah:

- Google Apps Script backend.
- `GAS_API_URL`.
- `GAS_API_SECRET`.
- Google Sheets.

## Three.js

Versi yang digunakan:

```text
0.187.0 / r187
```

Diload dari jsDelivr melalui import map, sehingga project tetap tidak membutuhkan build step.
