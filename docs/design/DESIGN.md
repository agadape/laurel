# Laurel landing: alasan desain

Konsep: nama Laurel menyala dari gelap, lalu pengunjung berjalan menyusuri semua model yang dinilai, sampai semuanya masuk ke balok hitam tempat penilaian terjadi. Idenya tetap ide Dave: small models, judged in the dark, paid in the open. Kalimat di halaman memakai teks `web/src/Landing.jsx`.

## Warna
- Hitam matte `#0B0C0F`: dunia utama, ruang penilaian.
- Putih studio: pra-hero, tempat model diamati.
- Biru `#00BFFF`: publik dan juara. Kontras di hitam 9,21:1. Teks di atas biru selalu gelap.
- Jingga `#FF7A4F`: tersegel. Kontras di hitam 7,58:1.

## Huruf
- Zodiak: judul, sama dengan Amplop Balas, punya karakter serif.
- Satoshi: UI dan tombol.
- DM Mono: angka dan data.

## Aset
- GPT lewat Codex: 3 latar kosong (`latar-*.webp`) dan 2 frame loading.
- Latar diam. Yang bergerak adalah komponen: 345 kaca WebGL, 4.386 bintang, teks, papan skor, mahkota.
- Tanpa three.js. Kode landing terpisah dari explorer dan dimuat saat dibutuhkan.

## Arti gerak
- Sapuan bintang: model sedang dicek.
- Biru menetap: juara. Jingga: exhibit terbuka, masih tersegel.
- Lampu padam: kaca hilang, tinggal bintang, lalu semua bintang masuk ke balok. Penilaian terjadi di ruang tertutup.
- 150 titik mengikuti perspektif kaca di gambar latar, dihitung dari empat sudut balok.
- Race di section bukti berputar sendiri selama terlihat: skor publik, segel lewat, skor tersegel, laurel pindah.
- Pohon kanan di section untuk siapa: satu panggilan berjalan dari akar ke daun.

## Kontrak data
- Exhibit terbuka dibaca lewat `leaderboard`, jadi skor B tidak pernah sampai ke halaman.
- `public/aset/snapshot.json` cadangan kalau RPC lambat. Perbarui dengan `aset-sumber/snapshot.py`.
- Kaca jingga mencakup semua exhibit terbuka. Exhibit 05 paling terang, dua exhibit simulasi lebih pudar.

## Aturan Dex 6 Nov
- Tanpa teks kecil di atas judul. Status testnet pindah ke navigasi, sumber data ke footer.
- Tanpa garis antar section. Mono hanya untuk kode dan hash.

## Halaman dalam
`web/src/dex-theme.css` memberi tema, perilaku tidak berubah. Nomor section dan tautan kecil di atas judul dihapus.

## Bagian lemah
- Pohon di kaca asli, tapi bentuk kaca gambar shader, belum sekaya foto di gambar konsep.
- Loading ±5 detik sampai kartu muncul, hanya kunjungan pertama, bisa dilewati dengan klik.
- Kartu di HP tidak diuji di ponsel sungguhan.
- Halaman dalam baru diberi tema, belum punya gerak sendiri.
