# Tugas 9 — Hard-Surface Asset di Blender: Sci-Fi Crate

Mata kuliah Grafika Komputer (EF234504), Departemen Teknik Informatika ITS. Pertemuan 9 —
Blender Fundamental & 3D Modeling.

## Catatan praktikum (bagian 103 modul)

|                                     |                                                                                                                                                                       |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Nama**                            | Frenaldy Bestabba Hasugian · Himawan Rakha Bhadra                                                                                                                     |
| **NRP**                             | 5025241156 · 5025241028                                                                                                                                               |
| **Nama Asset**                      | Sci-Fi Crate (`P09_SciFi_Crate.blend`)                                                                                                                                |
| **Konsep Asset**                    | Peti kargo sci-fi 4 × 3 × 2.4 m: body dengan sudut membulat, panel depan/belakang recessed berisi slat ventilasi, tutup terangkat dengan handle U, panel samping oranye bersudut potong dengan rib di tengah, empat kaki. |
| **Primitive Awal**                  | Cube (body, handle, slat, foot) dan Plane (panel samping)                                                                                                             |
| **Operasi Modeling yang Digunakan** | Shift+A, F2, G/R/S + axis constraint + input numerik, Ctrl+A → Scale, Shift+D, E, I, Ctrl+R, Ctrl+B, K, M → By Distance, Shift+N                                     |
| **Modifier yang Digunakan**         | Bevel, Solidify, Mirror, Array, Subdivision Surface                                                                                                                   |
| **Bagian yang Menggunakan Extrude** | panel depan/belakang (ke dalam 0.12), tutup (naik 0.12, recess turun 0.06), handle U (5 extrude dari satu cube), rib panel samping (0.05)                              |
| **Bagian yang Menggunakan Inset**   | panel depan/belakang 0.18, tutup 0.2 lalu 0.15, strip tengah panel samping 0.06                                                                                        |
| **Bagian yang Menggunakan Loop Cut**| panel samping: 2 loop vertikal, digeser ke y = ±0.35 sehingga plate terbagi tiga strip                                                                                 |
| **Bagian yang Menggunakan Bevel**   | 4 sudut tegak body (Ctrl+B 0.1, 3 segment); Bevel Modifier pada body (0.025, angle 30°), handle (0.02), dan keempat kaki (0.03)                                         |
| **Cleanup yang Dilakukan**          | Merge by Distance 0.0001 dan Recalculate Normal pada semua part; pengecekan scale (1, 1, 1), arah normal per edge, dan non-manifold edge                               |
| **Challenge yang Dikerjakan**       | A, B, C, D, E, F, G (lihat di bawah)                                                                                                                                  |
| **Kendala**                         | lihat bagian _Kendala dan solusi_                                                                                                                                     |
| **Solusi**                          | lihat bagian _Kendala dan solusi_                                                                                                                                     |

## Isi folder

Seperti pertemuan lain, semuanya ada di `components/praktikum/pertemuan-9/`:

```
blender/build_scifi_crate.py   seluruh proses modeling, eksperimen, render, dan ekspor
blender/P09_SciFi_Crate.blend  asset final (modifier belum di-apply, tetap non-destructive)
webgl/viewer.js                viewer Three.js untuk GLB tiap tahap
StageViewer.tsx                canvas + HUD, ResizeObserver
ViewerControls.tsx             pilih tahap, tabel topology, view preset, wireframe / X-Ray
InfoSection.tsx                workflow, screenshot, operasi, modifier, eksperimen, Q&A, checklist
Pertemuan9.tsx                 menyusun halaman
```

Berkas yang harus disajikan Next.js ada di `public/praktikum-9/`: `stage-1…5.png` (screenshot
proses), `stage-1…5.glb` (crate per tahap), `experiments.png`, `topology.png`, `stats.json`.

### Padanan struktur pengumpulan (bagian 104)

```
P09_NRP_Nama/
├── P09_NRP_Nama.blend        ← blender/P09_SciFi_Crate.blend
├── screenshot_blockout.png   ← public/praktikum-9/stage-1.png
├── screenshot_modeling.png   ← public/praktikum-9/stage-3.png (stage-2 dan stage-4 sebagai tambahan)
├── screenshot_final.png      ← public/praktikum-9/stage-5.png
└── README.md                 ← berkas ini
```

## Cara membuat ulang dan menjalankan

Asset dibangun dengan Python API Blender (`bpy` + `bmesh`), memakai operator yang sama dengan
shortcut-nya — setiap langkah di script diberi komentar shortcut padanannya. Dengan Blender 4.2
LTS di PATH:

```bash
npm run build:blender:p9
```

atau langsung `blender -b --factory-startup --python components/praktikum/pertemuan-9/blender/build_scifi_crate.py`.
Script menulis ulang `.blend`, kelima screenshot, GLB, dan `stats.json`. Portal-nya:

```bash
npm run dev
```

lalu buka <http://localhost:3000/pertemuan/pertemuan-9>.

## Tahap workflow

| Tahap               | Isi                                                                                       | Face (base → +modifier) |
| ------------------- | ----------------------------------------------------------------------------------------- | ----------------------- |
| 1 Primitive/Blockout| Cube body S X2 Y1.5 Z1.2 + Apply Scale, Plane panel, cube handle, 1 slat, 1 foot + 3 Shift+D | 43 → 43                 |
| 2 Extrude + Inset   | panel recessed depan/belakang, tutup terangkat + recess, handle U                           | 95 → 95                 |
| 3 Loop Cut + Bevel  | 2 loop + rib + knife di panel samping, bevel 3 segment di 4 sudut body                       | 197 → 197               |
| 4 Modifier          | Bevel, Solidify → Mirror, Array → Mirror, Bevel → Subdivision                               | 197 → 3038              |
| 5 Final             | Merge by Distance + Recalculate Normal, inspeksi                                           | 197 → 3038              |

Sebagian besar face akhir berasal dari Subdivision handle (2336). Base mesh tetap 197 face, jadi
semua detail masih mudah diedit.

## Modifier stack

| Object      | Stack (atas → bawah)         | Pengaturan                                         |
| ----------- | ---------------------------- | -------------------------------------------------- |
| Crate_Body  | Bevel                        | 0.025, 2 segment, limit Angle 30°                  |
| Side_Panel  | Solidify → Mirror            | tebal 0.08 ke arah normal; Mirror X terhadap root  |
| Vent_Slats  | Array → Mirror               | count 6, relative offset Z 2.2; Mirror Y terhadap root |
| Handle      | Bevel → Subdivision Surface  | 0.02 / 2 segment; level 2                          |
| Foot_* (4)  | Bevel                        | 0.03, 2 segment                                    |

## Challenge (7)

| Challenge                      | Implementasi                                                                                   |
| ------------------------------ | ---------------------------------------------------------------------------------------------- |
| A — Symmetric Prop             | panel samping hanya di −X, Mirror terhadap Empty `SciFi_Crate`; slat dicerminkan depan → belakang |
| B — Repeated Mechanical Detail | satu slat + Array (6) = grille ventilasi                                                       |
| C — Thin Panel + Solidify      | panel samping dari Plane, siluet dibentuk di Edit Mode, tebal dari Solidify                     |
| D — Advanced Paneling          | panel recessed depan & belakang, tutup terangkat dengan recess, rib terangkat di panel samping  |
| E — Knife Detail               | 4 sudut panel samping dipotong diagonal; topology diperiksa (2 n-gon datar, normal konsisten)   |
| F — Controlled Curved Form     | handle: Bevel → Subdivision Surface, membulat tapi bentuk U tetap tegas                        |
| G — Modular Asset              | Body, Panel, Handle, Detail (slat), Support (4 foot) di bawah Empty `SciFi_Crate`               |

## 12 eksperimen wajib

Semuanya ada di collection `Eksperimen` di file `.blend` (render: `public/praktikum-9/experiments.png`).

| #  | Eksperimen                  | Hasil                                                                       |
| -- | --------------------------- | --------------------------------------------------------------------------- |
| 1  | Object vs Edit transform    | A scale (2, 1, 1), B scale (1, 1, 1) — bentuk sama, state berbeda            |
| 2  | Apply Scale dan Bevel       | sebelum Apply bevel memanjang di X dan gepeng di Z; sesudahnya rata          |
| 3  | Extrude vs Move             | G: 8 vertex / 6 face; E: 12 vertex / 10 face                                 |
| 4  | Inset + Extrude             | 6 → 10 (Inset) → 14 face (Extrude ke dalam): panel recessed                  |
| 5  | Loop Cut                    | 1 loop: 12 v / 10 f; 3 loop: 20 v / 18 f                                     |
| 6  | Bevel segment               | 1 / 3 / 6 segment: 26 / 98 / 294 face; asset memakai 2–3                     |
| 7  | Modifier stack              | Mirror → Bevel 115 face, satu balok; Bevel → Mirror 195 face, ada alur di tengah |
| 8  | Duplicate vs Array          | Shift+D: 4 object / 4 mesh; Array: 1 object, count 4                         |
| 9  | Snapping                    | dengan mata: celah 30 mm (X) dan 20 mm (Y); snap ke vertex: 0                |
| 10 | Proportional Editing        | O OFF: 1 vertex bergerak; O ON (radius 1.5, Smooth): 109 vertex              |
| 11 | Merge by Distance           | 16 → 8 vertex                                                                |
| 12 | Recalculate Normal          | 3 face terbalik → 0                                                          |

Jawaban pertanyaan pemahaman (50) dan analisis (A–H) ada di halaman portal.

## Kendala dan solusi

- **Slat ventilasi tidak terlihat dan panel depan bergaris.** Slat awalnya diletakkan di depan
  posisi face depan _sebelum_ di-recess, sehingga setelah Extrude ke dalam slat tertanam di
  dalam body dan berimpit dengan face recess (z-fighting). Posisi dihitung ulang dari permukaan
  recess (y = −1.5 + 0.12 − 0.03), sehingga slat duduk tepat di atasnya.
- **Pemeriksaan normal memberi alarm palsu.** Uji "normal menjauhi pusat object" menandai 112
  face dinding recess sebagai terbalik, padahal dinding itu memang menghadap ke dalam. Diganti
  dengan pemeriksaan konsistensi winding per edge (dua face yang berbagi edge harus melaluinya
  dengan arah berlawanan) plus hitungan non-manifold edge: semua part 0 edge terbalik.
- **Non-manifold di Side_Panel (12 edge).** Itu tepi Plane yang memang terbuka; Solidify
  memberinya ketebalan, jadi hasil akhirnya tertutup. Dicatat, bukan diperbaiki.
- **Wireframe di web menampilkan segitiga.** glTF menyimpan face sebagai segitiga, sehingga
  wireframe Three.js tidak menunjukkan topology asli. Ekspor menambahkan salinan `EDGES_<part>`
  berisi edge Blender (quad/n-gon) sebagai garis; viewer menampilkan itu.
- **Eksperimen snapping di mode background.** Snap Blender memakai raycast viewport yang tidak
  ada tanpa layar, jadi script melakukan hal yang sama secara langsung: memindahkan object sejauh
  selisih vertex terdekat ke vertex target (Snap To Vertex, Snap Base Closest).

## Refleksi

Shortcut yang paling membantu adalah input numerik setelah G/S dengan axis constraint, karena
seluruh proporsi crate bisa ditentukan dengan angka yang bisa diulang. Object Mode mengubah
object sebagai satu kesatuan, sedangkan Edit Mode mengubah isi mesh-nya — eksperimen 1
menunjukkan dua kubus yang tampak sama bisa membawa state yang sangat berbeda. Operasi termudah
adalah Inset + Extrude, yang langsung menghasilkan panel recessed yang rapi; yang paling sulit
adalah Knife dan Loop Cut pada panel samping karena posisi potongannya harus direncanakan agar
tidak merusak aliran quad. Modifier membuat desain tetap fleksibel: jumlah slat, tebal panel,
dan lebar bevel bisa diubah kapan saja tanpa menyentuh base mesh 197 face. Masalah topology yang
ditemukan adalah n-gon hasil Knife dan alarm palsu normal, keduanya diperiksa dan dijelaskan.
Apply Scale memastikan bevel body sama lebar di semua sisi, dan geometry yang bersih ini
menjadi dasar UV dan material di Pertemuan 10.
