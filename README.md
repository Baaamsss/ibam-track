# IBAM Track — Human Performance

Website statis mobile-first untuk mencatat kalori dan makro makanan, berat badan, tidur, dan latihan gym. **Bisa langsung di-host gratis di GitHub Pages tanpa backend atau langganan AI.**

## Yang sudah berfungsi

- **Profil awal:** nama panggilan, umur 18+, jenis kelamin sebagai parameter Mifflin–St Jeor, tinggi/berat, aktivitas, cutting/maintenance/bulking, defisit/surplus, target kalori manual, protein, dan sesi gym per minggu.
- **Makanan:** daftar makanan dasar dengan angka estimasi per 100 g, cari nama makanan, log per gram dan waktu makan, total kalori/protein/karbo/lemak, edit/hapus log, duplikasi menu hari sebelumnya, dan makanan custom per 100 g.
- **Berat:** catat per tanggal, grafik penimbangan dan moving average 7 hari, tabel rata-rata Senin–Minggu (dengan jumlah data yang tersedia).
- **Tidur:** log jam tidur/bangun dan kualitas opsional, hitung durasi melewati tengah malam, grafik 7 entri terakhir.
- **Gym:** catat exercise dengan jumlah set bebas; beban dan repetisi berbeda per set, edit/hapus; target sesi dan streak **mingguan** yang menghargai hari istirahat.
- **Penyimpanan:** `localStorage` per browser/perangkat, ekspor dan impor backup `.json`.

## Mulai di laptop (tanpa instalasi)

1. Ekstrak ZIP ini.
2. Buka `index.html` memakai browser modern. Jika browser membatasi localStorage untuk file lokal, jalankan server lokal (lihat di bawah).
3. Isi profil awal lalu gunakan menu Makanan, Progres, Gym, dan Pengaturan.

Alternatif server lokal (memerlukan Python):

```bash
python3 -m http.server 8000
```

Lalu buka `http://localhost:8000`.

## Publikasikan lewat GitHub Pages

1. Login ke [GitHub](https://github.com/), klik **New repository**. Contoh nama: `ibam-track`. Pilih **Public** jika ingin memakai GitHub Pages gratis dan membagikan source code.
2. Masuk ke repo → **Add file → Upload files**. Upload **isi folder** ini: `index.html`, `styles.css`, `app.js`, `icon.svg`, dan `README.md` ke **root repo** (bukan folder bersarang).
3. Klik **Commit changes**.
4. Buka **Settings → Pages**. Pada **Build and deployment**, pilih **Deploy from a branch**, branch `main`, folder `/(root)`, lalu **Save**.
5. Tunggu GitHub Pages menyelesaikan deploy. Tautan biasanya berformat `https://USERNAME.github.io/ibam-track/` (ubah USERNAME sesuai akun GitHub).
6. Uji melalui HP. Setiap orang yang membuka link punya catatan **lokal mereka sendiri**, tidak melihat catatan pengguna lain.

Jika desain/fitur diperbarui, upload versi baru dan commit lagi.

## Penting sebelum dibagikan

- **Data tidak sinkron lintas perangkat.** Ekspor backup di perangkat lama lalu impor di perangkat baru. Jika data browser dihapus, histori lokal bisa hilang. Jangan simpan data semua keluarga dalam browser/profil yang sama.
- **Belum ada akun, database cloud, AI, kamera/analisis foto, atau pencarian internet otomatis.** Fitur-fitur ini memerlukan backend/API dan pertimbangan biaya, autentikasi, privasi, serta akurasi.
- **Estimasi nutrisi:** angka makanan bawaan dimaksudkan sebagai nilai generik per 100 g, bukan jaminan presisi. Selalu cocokkan label kemasan, keadaan matang/mentah, minyak dan resep. Input makanan custom tidak dibagikan ke pengunjung lain.
- **Kalori aktivitas:** latihan gym **tidak otomatis menambah** target kalori karena estimasi TDEE telah memakai faktor aktivitas. Mencatat durasi gym bukan pengukur kalori terbakar yang akurat.
- **Streak gym:** berdasarkan berapa **hari berbeda** seseorang latihan dalam satu pekan, bukan jumlah gerakan atau hari berturut-turut.
- **Rumus energi:** Mifflin–St Jeor: laki-laki `10×BB + 6.25×TB − 5×umur + 5`; perempuan `10×BB + 6.25×TB − 5×umur − 161`, kemudian dikali faktor aktivitas. Default modifikasi ±300 kcal (bisa diubah).
- **Penggunaan publik:** ini perangkat pemantauan gaya hidup, bukan diagnosis, terapi, atau rekomendasi medis individual. Karena tidak ada backend, data pengguna tidak dikirim oleh aplikasi ini ke pembuat website.

## Struktur proyek

```
index.html  — layout dan formulir
styles.css — tampilan responsif
app.js     — perhitungan, grafik SVG, log, localStorage, backup
icon.svg   — favicon
README.md  — panduan
```

Dibuat sebagai MVP yang mudah dibaca/diedit. Tidak membutuhkan Node.js, React, npm, atau API key untuk dijalankan.
