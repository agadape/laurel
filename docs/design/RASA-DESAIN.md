# Rasa desain Laurel: panduan meneruskan tampilan

Untuk Dave dan Claude-nya. Tujuannya: halaman baru tetap satu dunia dengan landing, tanpa menebak selera.

## Cara kita sampai ke sini
1. Claude membedah produk dan membuat tiga arah bergambar lewat GPT.
2. Dex mencampur arahnya: studio putih jadi trailer, ruang hitam jadi hero, papan skor jadi section.
3. Claude menerjemahkan campuran itu jadi urutan adegan dan frame.
4. Dex menilai dari gambar dan dari scroll sungguhan, lewat catatan suara.
5. Satu putaran catatan besar: font kecil, garis antar section, tabel angka, footer, transisi yang berat.

## Yang Dex minta, yang dibaca Claude, yang dikerjakan
| Dex bilang | Dibaca sebagai | Dikerjakan |
|---|---|---|
| "kayak trailer" | Halaman punya urutan seperti film | Satu panggung, satu nilai p 0..1 |
| "kayak TV yang dinyalain" | Merek lahir dari gelap, ada rasa listrik | Huruf tabung kaca menyala tidak serempak |
| "begitu banyak kartu kaca" | Skala harus mengejutkan | 345 kaca, tiap kaca satu pohon asli |
| "titik bintang, yang mana yang oke" | Penilaian harus terlihat | Tiap bintang satu daun, warna menyatakan hasil |
| "main ke website, bukan fully video" | Latar diam, komponen bergerak | WebGL di atas gambar latar |
| "terkesan slop, kata kecil di atas heading" | Hapus pola template | Info pindah ke navigasi, kalimat, footer |
| "gradasi mulus aja" | Tidak ada tepi antar section | Satu warna dasar, cahaya lembut, tanpa garis |

## Selera Dex
- Latar hitam matte `#0B0C0F`, kaca dan cahaya yang terasa nyata.
- Benda fisik lebih kuat daripada kotak UI datar.
- Efek harus membawa arti. Gerak tanpa arti dibuang.
- Rapi, elegan, tidak membosankan. Rasa slide presentasi ditolak.

## Aturan keras
- Tanpa teks kecil di atas judul.
- Tanpa garis antar section.
- Huruf mono hanya untuk kode dan hash.
- Deret kotak angka diganti komponen yang menjelaskan atau satu kalimat.
- Angka selalu dari kontrak. Tidak ada data contoh.
- Teks di atas biru selalu gelap.

## Bahasa visual
- Biru `#00BFFF`: publik dan juara. Jingga `#FF7A4F`: tersegel.
- Zodiak untuk judul, Satoshi untuk isi dan tombol, DM Mono untuk kode.
- Tombol: kaca saat diam, biru naik dari bawah saat disentuh, panah bergeser.
- Tiap halaman punya satu objek yang menjelaskan isinya.

## Rasa Claude yang mencoba mengikuti
Claude cenderung aman dan merekomendasikan arah A, Dex justru tertarik C. Rekomendasi Claude adalah titik awal. Claude menjaga kontras, data asli, HP, dan performa. Dex menjaga rasa.

## Meneruskan halaman dalam
Mulai dari `web/src/dex-theme.css`. Halaman dalam baru sampai tema, jadi tiap halaman masih bisa diberi satu objek bergerak: Exhibit dengan race seperti landing, Specimen dengan pohon yang bisa ditelusuri.
