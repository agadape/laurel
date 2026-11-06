# Laurel front-end: serah terima

Dasar: commit `91ffdc3` di `main`. Isi: landing baru dan tema halaman dalam. Kontrak, `rpc.js`, `wallet.js`, `web/api`, dan semua rute tidak berubah.

## Cara pasang
Salin isi folder ini ke root repo Laurel, timpa berkas yang sama, lalu:

```bash
cd web
npm install
npm run dev
```

Buka `/`. Kalau `main` sudah bergerak, cek dulu `web/src/App.jsx`, `web/src/components.jsx`, dan `web/index.html`, karena hanya ketiganya yang berisi suntingan kecil di berkas lama.

## Yang berubah
- `web/src/Landing.jsx`: sekarang hanya pemuat. Halaman ada di `web/src/landing/`, dimuat saat dibutuhkan.
- `web/src/landing/`: panggung WebGL (`world.js`), satu garis waktu scroll (`mount.js`), section (`sections.js`), data (`data.js`), gaya (`style.css`).
- `web/src/dex-theme.css`: tema halaman dalam, dimuat setelah `style.css`.
- `web/src/main.jsx`: memuat tema.
- `web/src/App.jsx`: nomor "03" dan tautan kecil di atas judul dihapus.
- `web/src/components.jsx`: `Sec` hanya menulis judul.
- `web/index.html`: font memakai DM Mono, Zodiak dan Satoshi ada di `public/aset`.
- `web/package.json`: tambah `lenis` untuk scroll halus.
- `web/public/aset/`: latar, frame loading, font, `snapshot.json`.

## Sudah diperiksa di syarat handoff
- Tanpa data palsu. Exhibit terbuka dibaca lewat `leaderboard`, jadi skor B tidak masuk halaman.
- Rute `#/`, `#/task/:id`, `#/model/:id`, `#/costs`, `#/connect`, `?contract=` tetap.
- Alur wallet membuka modal, mode tamu masuk explorer, deep link jalan.
- Bahasa Inggris, footer menyebut Undo, tanpa rahasia.
- Satu pengecualian: **tema terang dihapus**, situs hitam saja. Ini keputusan desain, batalkan kalau kamu butuh dua tema.

## Sebelum submit
1. Perbarui `web/public/aset/snapshot.json`: `python tools/landing_snapshot.py`. Berkas ini cadangan kalau RPC lambat.
2. Perbarui CLAIMS 16 kalau kalimatnya menyebut layar lama, dan screenshot README.
3. Tulis peran Dex di README: "Landing page and visual design by Dex Bennett."
4. Setelah Exhibit 05 tutup, landing berpindah sendiri ke exhibit terbuka berikutnya dan race memakai hasil Exhibit 05. Cek sekali setelah `close_task`.

## Belum dikerjakan
- Halaman dalam baru sampai tema, belum punya gerak sendiri.
- Belum diuji di ponsel sungguhan, hanya ukuran 390 px.
- Lisensi Zodiak dan Satoshi dari Fontshare perlu kamu cek sekali.

Panduan: `docs/design/RASA-DESAIN.md`, alasan: `docs/design/DESIGN.md`.
