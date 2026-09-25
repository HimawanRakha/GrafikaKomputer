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
  praktikum/pertemuan-2/    implementasi pertemuan 2
  praktikum/pertemuan-3/    implementasi pertemuan 3
  praktikum/pertemuan-4/    implementasi pertemuan 4
  ui/Section.tsx            kartu bersection judul, dipakai ulang
  ui/controls.tsx           ControlCard & style tombol panel, dipakai ulang
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

### Pertemuan 2 — WebGL Primitive Playground

**Frenaldy Bestabba Hasugian — 5025241156**

Pipeline WebGL2 dibangun dari nol di atas satu canvas 960×600: vertex data disiapkan
sebagai `Float32Array` dalam koordinat NDC, diunggah ke buffer GPU, dihubungkan ke
attribute, lalu digambar dengan vertex dan fragment shader yang ditulis sendiri.

#### Primitive dan draw mode

| Object | Draw mode | Vertex data |
| --- | --- | --- |
| Gradient triangle | `gl.TRIANGLES` | 3 vertex, 3 warna berbeda |
| Gradient rectangle | mengikuti selector | 2 triangle, 6 vertex, 4 warna sudut |
| Star | `gl.LINE_LOOP` | 10 vertex prosedural, hue disapu keliling |
| Point grid | `gl.POINTS` | 7×5 vertex dari nested loop |
| Bouncing triangle | `gl.TRIANGLES` | `DYNAMIC_DRAW`, horizontal, tercepat |
| Vertical triangle | `gl.TRIANGLES` | `DYNAMIC_DRAW`, vertikal, terlambat |
| Diagonal hexagon | `gl.LINE_LOOP` | `DYNAMIC_DRAW`, diagonal, memantul di dua sumbu |
| Player triangle | `gl.TRIANGLES` | `DYNAMIC_DRAW`, digerakkan keyboard |
| Primitive hasil klik | mengikuti selector | dibuat dari mouse yang dikonversi ke NDC |

Ketiga draw mode dipakai sekaligus, dan posisi object statis diatur agar tidak saling
menutupi — object yang bergerak horizontal diberi koridor kosong di tengah canvas, dan
yang bergerak vertikal menempati jalur kosong di tepi kiri.

#### Animasi dan interaksi

- **Animasi** — tiga object bergerak dengan posisi awal, kecepatan, dan arah berbeda
  (horizontal, vertikal, diagonal), masing-masing memantul saat tepinya — bukan titik
  tengahnya — menyentuh batas NDC. Yang diagonal memantul pada kedua sumbu secara
  terpisah. Loop-nya `requestAnimationFrame`, dengan pergerakan diskalakan terhadap frame
  delta supaya kecepatannya sama di layar 60Hz maupun 144Hz.
- **Keyboard state-based** — Arrow keys / WASD menggerakkan player. `keydown`/`keyup`
  hanya mencatat tombol yang sedang ditahan; perpindahan dihitung sekali per frame.
- **Keyboard event-based** — `R` reset posisi, `C` ganti warna player, `P` pause/resume.
- **Mouse** — klik canvas membuat primitive baru tepat di titik klik; posisi pointer
  ditampilkan dalam NDC.

Keyboard hanya mengendalikan canvas ketika canvas di-hover **atau** difokus dengan Tab,
supaya tombol panah tetap bisa men-scroll halaman di tempat lain sekaligus kontrolnya tetap
bisa dipakai tanpa mouse. State tombol disimpan berdasarkan `event.code`, bukan
`event.key`, agar Shift atau CapsLock yang ditekan di tengah-tengah tidak membuat tombol
tersangkut dalam keadaan tertekan.

#### Challenge yang dikerjakan

- **A — Primitive Selector**: segmented control `Triangles / Lines / Points` menentukan
  draw mode primitive yang dibuat lewat klik, sekaligus menggambar ulang gradient rectangle
  dengan 6 vertex yang sama — memperlihatkan langsung bahwa draw mode mengubah primitive
  assembly, bukan isi buffer.
- **B — Color Control**: palet merah, hijau, biru, cyan, pink, kuning, plus tombol Random,
  seluruhnya button HTML di panel kontrol.
- **C — Spawn Primitive**: pixel mouse dikonversi ke NDC, lalu geometry baru dibangun dan
  di-upload ke sepasang buffer sendiri.
- **D — Multiple Moving Objects**: tiga object dengan posisi awal, kecepatan, dan arah
  berbeda, semuanya memantul pada batas NDC.
- **E — Procedural Pattern**: point grid 7×5 dibangun dengan nested loop, dan star dibangun
  dari loop trigonometri yang menyapu hue keliling bentuknya.
- **F — Simple HUD**: FPS, frame time, jumlah primitive, total vertex, draw mode aktif,
  dan mouse NDC — seluruhnya teks HTML di luar canvas, tanpa text rendering WebGL.

#### Kode terkait

| File | Isi |
| --- | --- |
| `components/praktikum/pertemuan-2/webgl/shaders.ts` | source GLSL `#version 300 es` |
| `components/praktikum/pertemuan-2/webgl/glUtils.ts` | compile, link, buffer, attribute, draw call |
| `components/praktikum/pertemuan-2/webgl/scene.ts` | builder vertex data & palet warna |
| `components/praktikum/pertemuan-2/WebGLPlayground.tsx` | context, input, rendering loop |
| `components/praktikum/pertemuan-2/PlaygroundControls.tsx` | panel kontrol dan HUD |
| `components/praktikum/pertemuan-2/InfoSection.tsx` | catatan konsep dan checklist |

Isi `webgl/` sengaja tidak menyentuh React sama sekali, jadi bagian murni WebGL-nya bisa
dibaca terpisah dari kode antarmuka.

Jawaban Pertanyaan Analisis dan refleksi ada di [ANALISIS-pertemuan-2.md](ANALISIS-pertemuan-2.md).

#### Catatan tentang struktur pengumpulan

Modul meminta struktur `index.html` / `main.js` / `style.css`. Karena praktikum ini
digabungkan ke portal Next.js yang sudah dipakai sejak pertemuan 1, perannya terbagi
seperti ini:

| Berkas pada modul | Padanan di portal |
| --- | --- |
| `index.html` | `app/pertemuan/[slug]/page.tsx` + `WebGLPlayground.tsx` (elemen `<canvas>`) |
| `main.js` | `webgl/glUtils.ts`, `webgl/scene.ts`, `webgl/shaders.ts`, `WebGLPlayground.tsx` |
| `style.css` | `app/globals.css` dan utility Tailwind pada komponen |

Seluruh tahap pipeline pada modul tetap ada dan dapat ditelusuri satu per satu; hanya
pembagian berkasnya yang mengikuti konvensi portal.

### Pertemuan 4 — Rotating 3D Cube Camera Playground

**Frenaldy Bestabba Hasugian — 5025241156**
**Himawan Rakha Bhadra — _(NRP menyusul)_**

Rantai transformasi dilengkapi sampai ujung: Pertemuan 3 berhenti di Model Matrix, di sini
View Matrix dan Projection Matrix ditambahkan sehingga urutan Local → World → Camera →
Clip → NDC → Screen lengkap seluruhnya.

#### Scene

Tiga cube 3D, masing-masing 36 vertex `vec3` dengan warna berbeda per sisi. Ketiganya
berbagi **satu** buffer GPU dan hanya dibedakan oleh Model Matrix serta `u_tint`, meneruskan
gagasan reuse geometry dari Pertemuan 3.

| Cube | Posisi Z | Urutan gambar |
| --- | --- | --- |
| Cube depan | +1.0 | pertama (terdekat) |
| Cube tengah | −1.5 | kedua |
| Cube belakang | −4.0 | terakhir (terjauh) |

Urutan dekat → jauh itu disengaja. Dengan depth test aktif hasilnya benar apa pun urutannya,
tetapi begitu depth test dimatikan, cube yang digambar terakhir memenangkan setiap pixel yang
bertumpuk — kegagalan painter's algorithm yang justru ingin diperlihatkan.

#### Kontrol

| Tombol | Fungsi |
| --- | --- |
| `Arrow` | Kamera X/Y (mode bebas) atau azimuth/elevation (mode orbit) |
| `W` / `S` | Kamera Z (mode bebas) atau radius orbit |
| `P` | Ganti proyeksi perspective ↔ orthographic |
| `[` / `]` | FOV turun / naik, kontinu, dibatasi 15°–120° |
| `1` / `2` / `3` | Preset FOV 35° / 60° / 90° |
| `N` | Siklus preset near/far plane |
| `D` | Depth test ON/OFF |
| `O` | Orbit camera ON/OFF |
| `Space` | Pause rotasi cube (kamera tetap bisa digerakkan) |
| `R` | Reset kamera, proyeksi, FOV, near/far, dan depth test |

Keyboard hanya aktif saat canvas di-hover atau difokus dengan Tab, supaya tombol panah tetap
bisa men-scroll halaman di tempat lain. Seluruh gerakan kamera bersifat **state-based** dan
diskalakan `deltaTime`, jadi kecepatannya sama di layar 60Hz maupun 144Hz.

#### Proyeksi dan preset

Tinggi box orthographic dihitung dari tinggi frustum perspective pada jarak target
(`tan(fov/2) × jarak`). Tanpa penyamaan itu, menekan `P` membuat scene melompat besar-kecil
dan perbedaan yang sebenarnya — hilangnya konvergensi perspektif — tertutupi perubahan skala.

| Preset near/far | Nilai | Tujuan |
| --- | --- | --- |
| Longgar | 0.1 / 100 | Semua cube terlihat utuh |
| Sedang | 1 / 12 | Rentang wajar, depth buffer lebih presisi |
| Memotong | 3.5 / 7.5 | Cube depan teriris near plane, cube belakang hilang di far plane |

Aspect ratio dibaca ulang dari **drawing buffer** setiap frame, bukan dari ukuran CSS, lalu
dimasukkan ke projection matrix. Panel kanan menyediakan preset 21:9 / 16:10 / 4:3 / 1:1 untuk
membuktikan cube tetap proporsional saat canvas berubah bentuk.

#### Challenge yang dikerjakan

- **Orbit camera** (`O`) — posisi kamera dihitung sebagai titik pada bola di sekitar target:
  `x = r·cos(el)·sin(az)`, `y = r·sin(el)`, `z = r·cos(el)·cos(az)`. Saat mode dinyalakan,
  azimuth/elevation/radius dibaca balik dari posisi kamera bebas sehingga sudut pandang tidak
  melompat. Elevation dibatasi ±85° supaya `up` tidak pernah sejajar arah pandang.
- **Preset FOV 35° / 60° / 90°** (`1` / `2` / `3`).
- **Tiga cube pada depth berbeda** — lihat tabel scene di atas.

#### Kode terkait

| File | Isi |
| --- | --- |
| `components/praktikum/pertemuan-4/webgl/math3d.ts` | Mat4 column-major, `perspective`, `orthographic`, `lookAt`, helper Vec3 |
| `components/praktikum/pertemuan-4/webgl/scene.ts` | 36 vertex cube, warna per sisi, tiga instance, state kamera, preset |
| `components/praktikum/pertemuan-4/webgl/shaders.ts` | GLSL dengan `u_model`, `u_view`, `u_projection` terpisah |
| `components/praktikum/pertemuan-4/webgl/glUtils.ts` | compile, link, mesh dua buffer, draw call |
| `components/praktikum/pertemuan-4/CameraPlayground.tsx` | context, input, resize, rendering loop |
| `components/praktikum/pertemuan-4/PlaygroundControls.tsx` | panel kontrol dan HUD |
| `components/praktikum/pertemuan-4/InfoSection.tsx` | catatan konsep dan checklist |

Padanan berkas yang diminta modul: `math3d.js` → `webgl/math3d.ts`, `main.js` → sisa isi
`webgl/` dan `CameraPlayground.tsx`, `index.html` → `app/pertemuan/[slug]/page.tsx`,
`style.css` → `app/globals.css` dan utility Tailwind.

#### Catatan hasil pengujian

Diuji di Chromium lewat dev server, seluruh kontrol ditekan satu per satu:

- Perspective → orthographic: ketiga cube berubah menjadi berukuran sama persis meski
  kedalamannya berbeda, dan skalanya tidak melompat saat pergantian.
- Depth test OFF: selain cube belakang menimpa cube depan, sisi belakang tiap cube juga
  menimpa sisi depannya sendiri — bukti bahwa tanpa depth buffer urutan draw menentukan
  segalanya, bahkan di dalam satu object.
- Preset near/far "memotong": cube depan teriris rata oleh near plane sampai bagian dalamnya
  terlihat, cube belakang hilang sepenuhnya di far plane.
- Orbit camera: menahan `ArrowRight` 1,2 detik menambah azimuth 66° (≈ 55°/detik sesuai
  konstanta), radius tetap di 6.11 — sama dengan jarak kamera bebas sebelumnya, jadi
  pergantian mode tidak memindahkan sudut pandang.
- Aspect ratio 1:1: canvas menjadi persegi, cube tetap proporsional, yang menyempit hanya
  bidang pandang horizontal.
- Matematika matrix diverifikasi numerik terpisah: near/far dipetakan ke NDC ∓1, `w` membawa
  −z pada perspective tetapi tetap 1 pada orthographic, `lookAt` menempatkan eye di origin
  camera space, dan kasus degenerate (kamera tepat di atas target) tidak menghasilkan NaN.
- Console tidak menunjukkan error maupun warning WebGL pada seluruh pengujian.

Screenshot tampilan aplikasi ada di [`docs/pertemuan-4/`](docs/pertemuan-4/).
