# Nurse Alert

Dashboard web untuk sistem alert perawat yang terintegrasi dengan Firebase Realtime Database. Fokus pada UI responsif, workflow sederhana, dan data yang aman.

## Fitur
- Dashboard: daftar alert aktif dan alert yang sudah ditangani
- History: tabel riwayat dengan filter tanggal dan hapus per tanggal
- Auto-clean: alert berstatus “Ditangani” otomatis dihapus dari active setelah 24 jam
- UI konsisten: warna indikator per jenis alert, layout rapi untuk mobile/desktop

## Arsitektur singkat
- Front-end: HTML/CSS/JS (tanpa build tools), di-host via GitHub Pages
- Data: Firebase Realtime Database
- Auth (opsional): Firebase Authentication (Email/Password atau Anonymous untuk device)
- Proteksi (opsional): Firebase App Check

## Struktur data (Realtime Database)
- `alerts_active/{roomId}` → objek alert aktif
  - `type`: "kondisi infus" | "pertolongan medis" | "pertolongan non-medis"
  - `status`: "Active" | "Ditangani"
  - `timestamp`: milidetik dari `Date.now()`
  - `message`: string opsional
- `alerts_history/{roomId}/{eventId}` → arsip event dengan struktur sama

## Setup cepat
1. Clone repo:
   ```bash
   git clone https://github.com/ahta05/nurse-alert.git
   cd nurse-alert
2. Buat project Firebase baru → ambil config (apiKey, authDomain, databaseURL, dll).
3. Edit app.js: ganti variabel firebaseConfig dengan milik project kamu.
4. (Opsional) Aktifkan Authentication dan App Check di Firebase Console.
5. Jalankan lokal:
   - Buka index.html langsung di browser, atau gunakan live server.
6. Deploy ke GitHub Pages:
   - Settings → Pages → pilih branch main dan folder /root (atau /docs jika pakai folder itu).
