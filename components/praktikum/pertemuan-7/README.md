# Tugas 7 — Interactive 3D Prototype dengan Three.js

Mata kuliah Grafika Komputer (EF234504), Departemen Teknik Informatika ITS. Prototype persiapan
UTS — Interactive Web 3D Project.

## Identitas kelompok

| Nama | NRP |
| --- | --- |
| Frenaldy Bestabba Hasugian | 5025241156 |
| Himawan Rakha Bhadra | _(NRP menyusul)_ |

## Judul dan deskripsi

**Robot Workshop — Prototype 3D Interaktif**

Sebuah ground berisi robot GLB yang bisa diam, berjalan di tempat, atau melambai; kendaraan
kecil yang memperlihatkan hierarchy parent-child; bola PBR dengan preset roughness × metalness
dan galeri 3 × 3 di belakangnya; serta tata surya kecil yang melayang. Semua object bisa
di-hover dan diklik untuk dipilih. Pilihan ditandai dengan skala, ring di ground, rotasi pelan,
HUD, dan panel informasi. Kamera dijelajahi dengan OrbitControls.

## Cara menjalankan

Seperti Pertemuan 1–6, tugas ini bagian dari portal Next.js kelompok. Dari root repo:

```bash
npm install
npm run dev
```

Lalu buka <http://localhost:3000/pertemuan/pertemuan-7>.

## Struktur berkas

Seluruh isi Pertemuan 7 ada di folder ini, `components/praktikum/pertemuan-7/`:

```
webgl/scene.js             seluruh scene: renderer, environment, kamera + OrbitControls,
                           hierarchy, PBR, GLB + AnimationMixer, raycasting, animation loop
scripts/build-robot-glb.mjs  sumber model robot.glb (dibangun dengan Three.js, diekspor GLTFExporter)
InteractivePlayground.tsx  canvas, HUD di atas canvas, ResizeObserver, jembatan ke panel
PlaygroundControls.tsx     information panel, tombol clip/PBR/environment/kamera, HUD scene
InfoSection.tsx            struktur scene graph, catatan konsep, checklist
Pertemuan7.tsx             menyusun halaman
```

Satu-satunya berkas di luar folder ini adalah model GLB-nya, `public/praktikum-7/robot.glb`,
karena Next.js hanya menyajikan asset statis dari `public/`. Padanan berkas yang diminta modul:
`index.html` → `InteractivePlayground.tsx` (canvas + HUD), `src/main.js` →
`InteractivePlayground.tsx` + `webgl/scene.js`, `src/style.css` → utility Tailwind,
`public/models/model.glb` → `public/praktikum-7/robot.glb`.

## Struktur scene graph

```
Scene
├── AmbientLight, DirectionalLight (castShadow, shadow camera ±9)
├── Ground (receiveShadow)
├── Hierarchy Demo (Group)            selectable
│   └── Body
│       ├── Child Object              local (1, 0, 0), rotation.z 45°
│       └── Wheel ×4
├── PBR Sphere                        selectable
├── PBR Gallery (Group) → 9 sphere    tiap sphere selectable
├── Solar System (Group)              selectable
│   └── Sun → Earth Orbit → Earth → Moon Orbit → Moon
├── Selection Ring                    helper, tidak ikut raycast
└── Imported GLB (gltf.scene)         selectable
```

## Hierarchy parent-child

Hierarchy Group berada di (−3, 0, 0.6) dan diputar 30°, Body di y = 0.8, Child di local
(1, 0, 0) relatif terhadap Body. Group terus berputar 0,25 rad/detik, sehingga HUD selalu
memperlihatkan **Child local** tetap (1, 0, 0) sementara **Child world** berubah. Nilai awalnya
juga dicetak ke Console: local (1, 0, 0), world (−2.13, 0.80, 0.10).

## Model GLB

| | |
| --- | --- |
| Berkas | `public/praktikum-7/robot.glb` (±100 kB) |
| Sumber asset | dibuat sendiri: `scripts/build-robot-glb.mjs`, jalankan ulang dengan `npm run build:model:p7` |
| Hierarchy | 24 node, 16 mesh, kedalaman 5 (Robot → Hips → Torso → Shoulder → Arm → Hand) |
| Material | 4 `MeshStandardMaterial`: Shell (metalness 0.6), Joint (0.8), Visor (emissive), Accent |
| Animation clip | `Idle` (2 s, loop), `Walk` (1 s, loop), `Wave` (1.6 s, sekali jalan) |

Modul menyerahkan GLB kepada mahasiswa. Daripada mengunduh asset dengan lisensi tidak jelas,
robot dibangun dengan Three.js — joint berupa Group kosong di titik pivot sehingga lengan dan
kaki berayun dari bahu dan pinggul — lalu diekspor dengan `GLTFExporter`. Setelah dimuat,
`traverse()` mengaktifkan `castShadow`/`receiveShadow` pada seluruh mesh dan mencatat jumlah
node, mesh, serta kedalaman hierarchy ke Console dan HUD.

## PBR material

| Object | Roughness | Metalness |
| --- | --- | --- |
| PBR Sphere | preset M: Awal 0.25/0.1, A 0.1/0, B 0.8/0, C 0.1/1, D 0.8/1 | sama |
| Galeri 3 × 3 | 0.1, 0.5, 0.9 (sepanjang X) | 0, 0.5, 1 (sepanjang Z) |
| Ground | 0.85 | 0 |
| Robot | 0.15 – 0.55 | 0.2 – 0.8 |

## Interaction

| | Hover | Click |
| --- | --- | --- |
| State | `hoveredObject` | `selectedObject` |
| Feedback | scale 1.06×, kursor pointer, HUD "Hover" | scale 1.12×, ring biru di ground, rotasi pelan, HUD "Selected", information panel |
| Prioritas | selected > hovered > normal (satu fungsi `refreshVisual()`) | |

Pointer diubah ke NDC dengan `getBoundingClientRect()` canvas (bukan ukuran window, karena
canvas tidak memenuhi layar), lalu `raycaster.intersectObjects(interactiveObjects, true)`.
Recursive `true` wajib untuk GLB: `gltf.scene` tidak punya geometry sendiri, jadi yang terkena
selalu child mesh, yang dipetakan kembali ke root lewat `findSelectableRoot()`.

**Click vs drag.** Mengikuti bagian 39.1: posisi `pointerdown` disimpan, gerakan dipantau di
`window` pada fase capture, dan lebih dari 5 piksel menandai gesture sebagai drag — selection
tidak berubah walaupun pointer kembali ke titik awal. `pointercancel` juga menekan selection.

## Environment

`RoomEnvironment` → `PMREMGenerator.fromScene()` → `scene.environment`. `scene.background`
sengaja tetap warna polos `#0b1020`, memperlihatkan bahwa environment menyinari dan memantul
pada material tanpa tampak sebagai latar. Tombol `E` mematikannya: baris metal galeri dan
preset C langsung menjadi hampir hitam.

## OrbitControls

`minDistance` 3, `maxDistance` 25 (perspective), `minZoom` 0.5, `maxZoom` 3 (orthographic),
`maxPolarAngle` π/2 − 0.05, damping aktif dan `controls.update()` dipanggil sebelum render setiap
frame. Tombol `C` menukar kamera: posisi dan target disalin sebelum `dispose()` dan pembuatan
controls baru, dan box orthographic diukur dari frustum perspective di jarak saat itu sehingga
scene tidak melompat. `R` mengembalikan kamera perspective, target, FOV, dan zoom awal.

## Challenge yang dikerjakan (7)

| Challenge | Implementasi | Tombol |
| --- | --- | --- |
| A — Multiple animation clips | Idle / Walk / Wave, crossfade 0,35 s, satu mixer banyak action | `1` `2` `3` |
| B — Click menjalankan animasi | klik robot → pilih + Wave sekali → kembali ke clip loop | klik |
| C — Information panel | name, position local & world, rotation, scale, material type | — |
| D — Hierarchical solar system | Sun → Earth Orbit → Earth → Moon Orbit → Moon | — |
| E — PBR material gallery | 3 × 3 sphere roughness × metalness | — |
| G — Selection rotation | object terpilih berputar 0,6 rad/detik, berhenti saat deselect | — |
| H — Environment toggle | `scene.environment` ON/OFF, status di panel | `E` |

## Kontrol

| Input | Fungsi |
| --- | --- |
| Drag kiri / kanan, scroll | orbit / pan / zoom |
| Klik | pilih object (klik area kosong untuk membatalkan) |
| `1` `2` `3` | clip Idle / Walk / Wave |
| `E` | environment ON/OFF |
| `C` | perspective ↔ orthographic |
| `M` | preset PBR sphere berikutnya |
| `Esc` | batalkan pilihan |
| `R` | reset semua |

Shortcut keyboard hanya aktif saat canvas di-hover atau difokus, supaya tidak bentrok dengan
halaman. Seluruh animasi memakai delta time `THREE.Clock`, dibatasi 0,05 detik.

## Catatan debugging

- **Peringatan shader X4122 / X4008 di Windows.** Compiler shader Direct3D milik ANGLE
  melaporkan peringatan presisi untuk shader PMREM bawaan three, dan three mencetaknya sebagai
  warning Console. Shader itu hanya dipakai sekali saat environment dibuat, jadi
  `renderer.debug.checkShaderErrors` dimatikan hanya selama `fromScene()` lalu dinyalakan lagi;
  material scene tetap diperiksa normal. Hasilnya Console tanpa error dan tanpa warning.
- **Loading asynchronous vs Strict Mode.** React memasang, melepas, dan memasang ulang komponen
  di development, sehingga download GLB pertama bisa selesai setelah scene-nya dibuang. Callback
  memeriksa flag `disposed` dan membuang hasilnya alih-alih menambahkannya ke scene mati.
- **Wave tidak "kembali".** Clip `LoopOnce` berhenti sendiri; listener `finished` pada mixer
  memutar ulang clip loop terakhir dengan crossfade.
- **Klik setelah orbit memilih object.** Diatasi dengan pembeda click/drag di atas.
- **Hover menimpa skala selection.** Diatasi dengan satu fungsi yang membaca kedua state
  sekaligus, bukan restore/apply terpisah seperti contoh dasar modul.
- **Three.js tetap r182** karena alasan yang sama dengan Pertemuan 6 (deprecation warning
  `THREE.Clock` mulai r183).

## Hasil pengujian

Diuji di Chromium lewat `npm run dev`:

- Console tab baru: 0 error, 0 warning; hanya log yang diminta modul (child local/world,
  hierarchy GLB, daftar clip).
- Klik robot: ring muncul, HUD "Imported GLB — Robot", clip berganti ke Wave, panel informasi
  terisi (MeshStandardMaterial ×16).
- Drag orbit yang dimulai di atas PBR Sphere: kamera berputar, selection tetap robot.
- Hover PBR Sphere: HUD "Hover: PBR Sphere", sphere membesar 1.06×.
- Preset C lalu environment OFF: sphere metal dan baris metal galeri menjadi hampir hitam.
- Kamera `C`: orthographic tanpa lompatan ukuran; Reset kembali ke perspective.
