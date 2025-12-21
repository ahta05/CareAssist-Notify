# CareAssist Notify

Sistem Manajemen Panggilan Pasien Real-Time berbasis web yang dirancang untuk fasilitas kesehatan. Sistem ini terintegrasi dengan Firebase Realtime Database untuk memberikan notifikasi instan kepada perawat, memungkinkan respons yang cepat terhadap permintaan pasien. Fokus pada antarmuka yang responsif, alur kerja yang sederhana, dan keamanan data.

## Fitur

*   **Dashboard Real-Time:** Menampilkan daftar panggilan aktif dan yang sudah ditangani dengan pembaruan langsung tanpa perlu refresh halaman.
*   **Indikator Prioritas Berwarna:** Setiap panggilan memiliki warna berbeda (Merah untuk Medis, Kuning untuk Infus, Hijau untuk Non-Medis) untuk memudahkan identifikasi prioritas.
*   **Riwayat Panggilan (History):** Tabel arsip lengkap untuk semua panggilan yang sudah ditangani, dilengkapi fitur filter berdasarkan tanggal dan hapus data per tanggal.
*   **Pengaturan yang Dapat Disesuaikan:** Pengguna dapat mengaktifkan/menonaktifkan notifikasi suara, notifikasi browser, dan memilih antara Light Mode dan Dark Mode.
*   **Manajemen Pengguna:** Sistem dilengkapi dengan halaman login dan logout untuk memastikan hanya petugas yang berwenang yang dapat mengakses dashboard.
*   **Bersihkan Status:** Tombol untuk membersihkan semua panggilan yang sudah ditangani dari tampilan aktif.
*   **Antarmuka Responsif:** Layout yang dioptimalkan untuk pengalaman yang baik di desktop, tablet, dan perangkat mobile.

## Arsitektur

*   **Front-end:** Murni menggunakan HTML, CSS, dan JavaScript (ES6 Modules) tanpa alat build (build tools).
*   **Hosting:** Di-host secara statis melalui GitHub Pages.
*   **Database & Backend:** Menggunakan Firebase sebagai Backend-as-a-Service (BaaS).
    *   **Firebase Realtime Database:** Untuk sinkronisasi data real-time.
    *   **Firebase Authentication:** Untuk sistem autentikasi pengguna (Login/Logout).

## Struktur Data (Firebase Realtime Database)

*   `alerts_active/{roomId}/{alertId}`: Menyimpan objek panggilan yang sedang aktif.
    *   `type`: `"medis"` | `"infus"` | `"nonmedis"`
    *   `status`: `"Aktif"` | `"Ditangani"`
    *   `createdAt`: Timestamp (milidetik) saat panggilan dibuat.
    *   `handledAt`: Timestamp (milidetik) saat panggilan ditangani.
    *   `message`: Pesan tambahan (opsional).
*   `alerts_history/{roomId}/{eventId}`: Arsip untuk panggilan yang sudah selesai/ditangani. Struktur datanya sama dengan `alerts_active`.

## Setup Cepat

1.  **Clone repositori:**
    ```bash
    git clone https://github.com/USERNAME_ANDA/CAREASSIST-REPO-ANDA.git
    cd CAREASSIST-REPO-ANDA
    ```
2.  **Buat Proyek Firebase:**
    *   Buka [Firebase Console](https://console.firebase.google.com/).
    *   Buat proyek baru.
    *   Aktifkan **Realtime Database** dan **Authentication**.
    *   Di menu Authentication, aktifkan metode sign-in **Email/Password**.
    *   Ambil konfigurasi proyek Anda (apiKey, authDomain, databaseURL, dll.) dari menu Project Settings.
3.  **Konfigurasi Aplikasi:**
    *   Buka file `app.js`.
    *   Ganti nilai variabel `firebaseConfig` dengan konfigurasi dari proyek Firebase Anda.
4.  **Jalankan Secara Lokal:**
    *   Anda bisa menggunakan ekstensi Live Server di Visual Studio Code, atau
    *   Buka file `index.html` langsung di browser Anda.
5.  **Deploy ke GitHub Pages:**
    *   Push semua perubahan ke repositori GitHub Anda.
    *   Buka repositori Anda, lalu pergi ke **Settings > Pages**.
    *   Di bagian "Build and deployment", pilih sumber **Deploy from a branch**.
    *   Pilih branch `main` (atau `master`) dan folder `/ (root)`.
    *   Klik **Save**. Situs Anda akan tersedia di `https://USERNAME_ANDA.github.io/CAREASSIST-REPO-ANDA`.
