# Praktikum Grafika Komputer — EF234504

Portal praktikum interaktif mata kuliah Grafika Komputer, Departemen Teknik Informatika ITS.
Setiap pertemuan praktikum dirender sebagai halaman tersendiri, dan daftarnya bertambah
seiring tugas baru dikerjakan.

Dibuat oleh Himawan Rakha Bhadra dan Frenaldy.

## Menjalankan

```bash
npm install
npm run dev
```

Buka <http://localhost:3000>.

Perintah lain:

| Perintah | Kegunaan |
| --- | --- |
| `npm run build` | Build produksi |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | Typecheck |

## Struktur

```
app/
  page.tsx                  dashboard, menampilkan seluruh kartu pertemuan
  pertemuan/[slug]/page.tsx halaman detail satu pertemuan
components/
  layout/Sidebar.tsx        navigasi
  praktikum/registry.tsx    peta slug -> komponen praktikum
  praktikum/pertemuan-1/    implementasi pertemuan 1
  ui/Section.tsx            kartu bersection judul, dipakai ulang
data/
  praktikum.ts              metadata seluruh pertemuan
```

## Pola registry

Metadata dan implementasi sengaja dipisah supaya menambah pertemuan baru tidak perlu
menyentuh routing sama sekali:

```
data/praktikum.ts   ──┐
                      ├──> app/pertemuan/[slug]/page.tsx  ──> halaman jadi
registry.tsx        ──┘
```

`data/praktikum.ts` adalah sumber kebenaran tunggal. Dashboard dan sidebar sama-sama
membacanya, jadi navigasi ikut ter-update sendiri.

### Menambah pertemuan baru

1. Tambahkan entri di `data/praktikum.ts` dengan `slug` baru dan `status: "available"`.
2. Buat komponennya di `components/praktikum/<slug>/`.
3. Daftarkan di `components/praktikum/registry.tsx`.

Selama sebuah entri berstatus `"coming-soon"`, kartunya tampil tetapi tidak bisa diklik,
dan belum perlu didaftarkan di registry.

## Daftar pertemuan

### Pertemuan 1 — Graphics Playground

Mini aplikasi grafika interaktif di atas HTML Canvas 2D.

- **Shapes** — pilih primitive lalu drag di canvas: line, rectangle, circle, triangle, star.
- **Color** — warna dipilih lewat hue slider atau color picker.
- **Actions** — Clear, Random, Animate, Reset.
- **Info** — FPS dan frame time diukur dari selisih timestamp `requestAnimationFrame`,
  plus resolusi canvas.
- **Scene demo** — bola memantul di batas canvas, circle yang mengikuti mouse, beberapa
  objek bergerak independen, player yang digerakkan Arrow keys/WASD, dan koordinat mouse
  real-time di HUD. Aktif saat tool `Demo` dipilih.
- Mode translasi keyboard **state-based** dan **event-based** bisa ditukar untuk
  membandingkan keduanya secara langsung.

Catatan: keyboard hanya mengendalikan canvas ketika pointer berada di atasnya, supaya
tombol panah tetap bisa dipakai men-scroll halaman.

Kode terkait:

- `components/praktikum/pertemuan-1/GraphicsPlayground.tsx` — state, input, animation loop
- `components/praktikum/pertemuan-1/shapes.ts` — fungsi menggambar murni
- `components/praktikum/pertemuan-1/PlaygroundControls.tsx` — panel kontrol
- `components/praktikum/pertemuan-1/InfoSection.tsx` — catatan konsep dan checklist

### Pertemuan 2

Belum tersedia.
