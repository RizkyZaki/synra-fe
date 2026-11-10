# SYNRA → shadcn/ui Migration Notes

## Status: SELESAI (Tahap 0 s/d Tahap 6)

---

## Ringkasan Eksekusi

| Item | Hasil Akhir |
|---|---|
| Branch kerja | `feat/shadcn-ui` |
| `npm run lint` | ✅ **Lulus (0 error, clean)** |
| `npm run build` | ✅ **Lulus (0 error)** |
| Ukuran bundle CSS | Awal ~128 kB -> Akhir 115.58 kB (gzip: 21.52 kB) |
| Baris `src/index.css` | Awal: 5.015 baris -> Akhir: 5.071 baris (termasuk variabel tema shadcn & pembersihan blok usang) |
| Backend & `lib/` | **100% tidak disentuh** (tidak ada perubahan API, auth, store, seed, tokens) |
| Proxy Vite | **100% dipertahankan** (`/api` -> NestJS backend) |
| Bahasa & Teks | **100% teks & bahasa Indonesia dipertahankan** |

---

## 1. Daftar Komponen yang Diganti

### Komponen Bersama (`src/components/ui.tsx`)
Semua nama export dan kontrak props publik dipertahankan 100%:

| Komponen SYNRA | Implementasi Baru | Keterangan Aksesibilitas & Perilaku |
|---|---|---|
| `GlassCard` | `Card` primitive + `.glass-card` | Tetap mempertahankan efek glass blur, border, dan gradient |
| `DataTable` | `Table`, `TableHeader`, `TableRow`, `TableHead`, `TableBody`, `TableCell` | Tetap mendukung `rowSeverity`, styling zebra/hover, dan keyboard navigation (`onRowClick`) |
| `FormField` | `Label` + child slot + hint/error message | Struktur form terjaga, error message tetap dengan warna bahaya |
| `ConfirmDialog` | shadcn `AlertDialog` (`@base-ui/react/alert-dialog`) | Focus trap otomatis, tombol `Esc` menutup dialog, klik overlay ditangani |
| `Drawer` | shadcn `Sheet` (`@base-ui/react/dialog`, side="right") | Tombol `Esc` menutup panel, backdrop blur, fokus otomatis, scrollable body |
| `Toast` | `sonner` via `<Toaster />` di root `App.tsx` | Adapter tipis tetap menerima props `visible`, `message`, `onClose` |
| `SeverityBadge` | shadcn `Badge` varian warna SYNRA | 7 level: Normal, Info, Low, Medium, High, Critical, Expired |
| `StatusBadge` | shadcn `Badge` varian tone SYNRA | 4 tone: success, warning, danger, neutral |
| `EmptyState` | Layout card + shadcn `Button` | Teks Bahasa Indonesia tetap |
| `LoadingState` | shadcn `Skeleton` | 3 baris skeleton loading animasi pulsa |
| `ErrorState` | Layout card + shadcn `Button variant="outline"` | Tombol "Coba lagi" tetap |
| `ScopeNotice` | shadcn `Alert` | Menampilkan catatan luar cakupan pilot |
| `ApiErrorBanner`| shadcn `Alert` (destructive) | Menampilkan pesan error backend |
| `KpiCard` | `GlassCard` + shadcn `Button variant="ghost"` | Interaktif, klik card & tombol "Lihat" berfungsi |
| `PageHeader` | Pertahankan layout + `ArrowLeft` | Navigasi kembali tetap sama |
| `PageLayout` | Wrapper layout tetap | Menggunakan `PageHeader` |

### Halaman Prioritas & Halaman Lainnya
Semua `<button className="button button--*">` telah diganti dengan `<Button>`:

| File | Elemen yang Dimigrasi |
|---|---|
| `src/components/LoginPage.tsx` | - Tombol submit form login (`<Button className="w-full">`)<br>- Tombol SSO AD/LDAP (`<Button variant="outline" className="w-full">`) |
| `src/components/AssetInventory.tsx` | - Form Tambah/Ubah Aset: Drawer memakai shadcn `Sheet`, Host/Kategori/Supervisor menggunakan shadcn `Select`<br>- Filter toolbar: Komponen, Kategori, Host, Status, Severity, dan Urutkan menggunakan shadcn `Select`<br>- Tombol Ekspor CSV (`<Button variant="outline">`)<br>- Tombol Tambah Aset (`<Button>`)<br>- Tombol Ubah Data Aset (`<Button>`) |
| `src/components/AdministrationPage.tsx` | - Tambah Pengguna: Role select menggunakan shadcn `Select`, tombol simpan & batal menggunakan `<Button>`<br>- Parameter EWS: Tombol Simpan Parameter (`<Button>`)<br>- Profil: Tombol Simpan Nama & Ganti Sandi (`<Button>`)<br>- Tombol Tambah Pengguna (`<Button>`) |
| `src/components/AlertIncidentPage.tsx` | - Tombol Workflow Form (`<Button>`)<br>- Tombol Akui Alert (`<Button>`)<br>- Tombol Evaluasi EWS (`<Button>`)<br>- Filter Severity & Status menggunakan shadcn `Select` |
| `src/components/LifecyclePage.tsx` | - Drawer status select menggunakan shadcn `Select`<br>- Tombol Batal & Simpan Perubahan (`<Button>`)<br>- Tombol Ubah Siklus Hidup (`<Button>`)<br>- Tombol Ajukan Perpanjangan (`<Button variant="outline">`)<br>- Tombol Setujui Pengajuan (`<Button>`) |
| `src/components/ReportsPage.tsx` | - Filter Host menggunakan shadcn `Select`<br>- Tombol Ekspor XLSX & PDF (`<Button variant="outline">`)<br>- Tombol Cetak (`<Button>`) |
| `src/components/NotificationEscalationPage.tsx` | - Tombol Kirim Pesan Uji Telegram (`<Button>`) |
| `src/components/AuditTrailPage.tsx` | - Filter Tindakan & Pengguna menggunakan shadcn `Select`<br>- Tombol Ekspor CSV (`<Button>`) |
| `src/App.tsx` | - Pemasangan `<Toaster />` sonner global<br>- Tombol Keluar pada drawer profil (`<Button variant="outline">`) |

---

## 2. Kelas CSS yang Dihapus / Dibersihkan dari `src/index.css`

Blok class berikut telah diverifikasi tidak digunakan lagi di seluruh komponen (`src/**/*.tsx`) dan aman dihapus:

1. `.button--primary` dan `.button--secondary` (digantikan oleh varian `default` dan `outline` pada `<Button>`).
2. `.modal-backdrop`, `.dialog`, `.dialog__icon`, `.dialog__actions` (digantikan oleh komponen shadcn `AlertDialog`).
3. `.toast`, `.toast--visible`, `.toast__icon` (digantikan oleh `sonner` Toaster).
4. `.drawer-layer`, `.drawer-layer--open`, `.drawer-backdrop` (digantikan oleh portal shadcn `Sheet`).
5. Overrides media query untuk `.dialog` dan `.toast` lama.

---

## 3. Hal yang Sengaja Tidak Diubah (dan Alasannya)

| Item | Alasan |
|---|---|
| `src/lib/` (api.ts, useSynraStore.ts, auth.ts, useAccess.ts, synraDomain.ts, backend.ts) | **Aturan Keras #1**: Logika bisnis, state store, session, dan integrasi backend tidak boleh terganggu. |
| `src/tokens.ts`, `src/seed.ts` | **Aturan Keras #1**: Berisi data awal dan definisi token yang menjadi sumber data. |
| `vite.config.ts` bagian server proxy `/api` | **Aturan Keras #2**: Menjamin koneksi ke backend NestJS tetap berjalan ke port 3000. Hanya alias path `@` yang distandarkan ke `fileURLToPath` agar kompatibel di Windows. |
| Semua label, placeholder, hint, pesan error bahasa Indonesia | **Aturan Keras #3**: Pengalaman pengguna tetap ramah lokal. |
| Helper `restrictedAction(canEdit)` | **Aturan Keras #5**: Role-based access control (RBAC) tetap diterapkan pada tombol yang dimigrasi. |
| Input datalist pada Komponen & Tipe Aset | Browser native `<input list="...">` memberikan UX auto-complete yang lebih baik untuk dataset dinamis tanpa kompleksitas popover radix combobox. |
| Grafik / visualisasi custom (SVG, chart utilisasi, chart-legend, period-filter) | Sesuai petunjuk tahap 5: Grafik & chart SVG dibiarkan seperti desain aslinya. |
| Struktur navigasi sidebar di `App.tsx` | Mempertahankan routing berbasis state dan tab mobile tanpa risiko regresi navigasi. |
| Desain visual glassmorphism (`glass-card`, ambient blob, tipografi Geist) | Menjaga identitas visual khas SYNRA. |
