# Analisis & Refleksi — Praktikum Pertemuan 2

**Nama:** Frenaldy Bestabba Hasugian
**NRP:** 5025241156
**Mata Kuliah:** EF234504 — Grafika Komputer
**Topik:** WebGL Fundamental

Implementasi yang dibahas ada di `components/praktikum/pertemuan-2/`.

---

## Pertanyaan Analisis

### 1. Mengapa WebGL menggunakan NDC?

Karena GPU harus bisa merasterisasi tanpa tahu berapa ukuran canvas. NDC (−1..1 pada
kedua sumbu) adalah ruang koordinat yang sudah dinormalisasi, sehingga geometry yang sama
bisa dipetakan ke resolusi berapa pun hanya dengan mengganti `gl.viewport()`. Pemisahan
ini juga membuat clipping mudah: apa pun di luar rentang −1..1 langsung dibuang sebelum
rasterisasi.

Efek sampingnya terlihat di praktikum ini — pada canvas 960×600, satu unit NDC horizontal
mencakup 1,6× lebih banyak pixel daripada vertikal, jadi bentuk yang dibangun dari
lingkaran akan tampil melebar kalau komponen x-nya tidak dibagi aspect ratio.

### 2. Apa fungsi `Float32Array`?

`Float32Array` adalah typed array: blok memori kontigu berisi float 32-bit, bukan array
JavaScript biasa yang isinya referensi ke objek Number. GPU mengharapkan data mentah
dengan layout persis seperti itu, jadi typed array bisa disalin ke buffer apa adanya tanpa
konversi per elemen. Presisinya juga sudah cocok — `GL_FLOAT` pada WebGL memang 32-bit.

### 3. Mengapa vertex data perlu masuk buffer?

Karena shader berjalan di GPU dan tidak bisa membaca memori JavaScript. Buffer adalah
alokasi memori di sisi GPU; `bufferData()` menyalin isi `Float32Array` ke sana. Setelah
tersalin, draw call tidak perlu memindahkan data lagi — data yang sama bisa dipakai ribuan
kali tanpa menyeberangi batas CPU–GPU, dan itulah alasan utama buffer ada.

### 4. Apa fungsi `gl.bindBuffer()`?

WebGL memakai model state machine dengan binding point. `bindBuffer(gl.ARRAY_BUFFER, buf)`
menjadikan `buf` sebagai buffer aktif pada slot `ARRAY_BUFFER`. Perintah berikutnya seperti
`bufferData()` dan `vertexAttribPointer()` tidak menerima buffer sebagai argumen — keduanya
bekerja pada apa pun yang sedang ter-bind. Jadi `bindBuffer()` menentukan "buffer mana yang
sedang dibicarakan".

### 5. Apa fungsi `gl.bufferData()`?

Mengalokasikan memori pada buffer yang sedang ter-bind sekaligus mengisinya dengan data.
Argumen ketiga adalah hint penggunaan: `STATIC_DRAW` berarti data ditulis sekali dan dibaca
berkali-kali, `DYNAMIC_DRAW` berarti sering ditulis ulang. Hint ini tidak mengubah hasil
gambar, hanya membantu driver memilih penempatan memori.

Di proyek ini pembedaannya nyata — object diam memakai `STATIC_DRAW` dan hanya di-upload
sekali saat inisialisasi, sedangkan ketiga object yang memantul dan segitiga player memakai
`DYNAMIC_DRAW` karena vertex-nya ditulis ulang setiap frame.

### 6. Apa perbedaan vertex shader dan fragment shader?

Vertex shader berjalan sekali per vertex dan tugas utamanya menentukan `gl_Position`, yaitu
posisi vertex dalam clip space. Fragment shader berjalan sekali per fragment (kira-kira per
pixel yang tertutup primitive) dan tugasnya menghasilkan warna akhir.

Keduanya dihubungkan oleh variabel `out`/`in`. Pada `shaders.ts`, vertex shader menulis
`v_color`, dan fragment shader menerimanya sudah dalam bentuk terinterpolasi.

### 7. Mengapa fragment dapat lebih banyak daripada vertex?

Karena rasterisasi mengubah bentuk geometris menjadi pixel. Satu triangle hanya punya 3
vertex, tetapi bisa menutupi puluhan ribu pixel di layar, dan setiap pixel itu menjadi satu
fragment. Perbandingannya bergantung pada luas primitive di layar, bukan pada jumlah
vertex-nya. Itu sebabnya optimasi berat biasanya diarahkan ke fragment shader.

### 8. Apa fungsi `vertexAttribPointer()`?

Menjelaskan cara membaca buffer yang sedang ter-bind. Parameternya menyatakan berapa
komponen per vertex, tipe datanya, apakah dinormalisasi, `stride` (jarak antar vertex dalam
byte), dan `offset` (dari mana mulai membaca). Pada praktikum ini `a_position` memakai 2
komponen `FLOAT` dan `a_color` memakai 3 — `stride` dan `offset` bernilai 0 karena posisi
dan warna disimpan di buffer terpisah, bukan di-interleave.

Yang penting: fungsi ini merekam buffer yang sedang aktif **pada saat dipanggil**, jadi
`bindBuffer()` harus selalu didahulukan.

### 9. Apa arti `gl.TRIANGLES`?

Mode primitive assembly yang memerintahkan GPU membaca vertex tiga-tiga dan
memperlakukan setiap kelompok sebagai satu segitiga independen. Dengan 6 vertex,
`gl.TRIANGLES` menghasilkan 2 segitiga terpisah — berbeda dari `TRIANGLE_STRIP` yang akan
menghasilkan 4 segitiga saling berbagi sisi. Alternatif lain yang dipakai di sini adalah
`LINE_LOOP` (menyambung semua vertex lalu menutupnya kembali ke vertex pertama) dan
`POINTS` (setiap vertex jadi titik seukuran `gl_PointSize`).

### 10. Mengapa rectangle direpresentasikan oleh triangle?

Karena hardware rasterisasi hanya mengenal point, line, dan triangle — quad bukan primitive
native. Triangle dipilih sebagai satuan dasar karena tiga titik selalu koplanar dan selalu
cembung, sehingga aturan interpolasi dan uji dalam/luarnya sederhana dan konsisten. Quad
dengan empat titik tidak menjamin keduanya. Maka persegi panjang dipecah sepanjang satu
diagonal menjadi 2 triangle, total 6 vertex dengan 2 vertex terduplikasi.

### 11. Apa manfaat rendering loop?

Rendering loop memisahkan "keadaan scene" dari "gambar di layar": tiap frame, state
diperbarui lalu seluruh scene digambar ulang. Tanpa loop, gambar hanya statis dan
perubahan state tidak pernah terlihat.

`requestAnimationFrame()` dipakai alih-alih `setInterval()` karena disinkronkan dengan
refresh rate monitor, otomatis berhenti saat tab tidak aktif, dan memberi timestamp yang
bisa dipakai menghitung frame delta. Di proyek ini delta itu dipakai untuk menskalakan
pergerakan supaya kecepatannya sama di layar 60Hz maupun 144Hz.

### 12. Mengapa mouse pixel perlu dikonversi ke NDC?

Karena keduanya memakai sistem koordinat yang berbeda dalam dua hal: rentang (pixel
`0..width` versus NDC `−1..1`) dan arah sumbu Y (pixel bertambah ke bawah, NDC ke atas).
Tanpa konversi, primitive akan muncul di tempat yang salah dan terbalik secara vertikal.

Ada satu jebakan tambahan: canvas ditampilkan responsif, jadi ukuran CSS-nya berbeda dari
ukuran drawing buffer. Koordinat event karena itu harus diskalakan dulu dengan
`canvas.width / rect.width` sebelum dipetakan ke NDC — kalau tidak, primitive akan meleset
makin jauh ke arah tepi canvas.

### 13. Apa hubungan buffer dan attribute?

Buffer adalah datanya; attribute adalah pintu masuk data itu ke vertex shader. Hubungan
antara keduanya tidak otomatis — dibentuk oleh tiga langkah berurutan:

```
bindBuffer()             pilih buffer yang aktif
enableVertexAttribArray()  aktifkan attribute agar membaca dari buffer, bukan nilai konstan
vertexAttribPointer()      jelaskan format pembacaannya, dan kunci ke buffer yang aktif tadi
```

Attribute tidak menyimpan referensi ke buffer secara permanen di luar konfigurasi ini,
sehingga tiap object dengan buffer sendiri perlu mengulang urutan tersebut sebelum draw
call-nya — persis yang dilakukan `setupAttributes()` di `glUtils.ts`.

### 14. Apa yang terjadi ketika draw call dijalankan?

`gl.drawArrays(mode, first, count)` memicu seluruh pipeline sekaligus:

1. GPU membaca `count` vertex dari buffer, mengikuti format yang ditetapkan
   `vertexAttribPointer()`.
2. Vertex shader dijalankan untuk setiap vertex, menghasilkan `gl_Position` dan nilai `out`.
3. Vertex dirangkai menjadi primitive sesuai `mode`.
4. Primitive di luar clip space dipotong, lalu dipetakan ke viewport.
5. Rasterizer memecah tiap primitive menjadi fragment, sambil menginterpolasi variabel
   varying seperti `v_color`.
6. Fragment shader dijalankan per fragment untuk menentukan warna.
7. Hasilnya ditulis ke framebuffer dan ditampilkan di canvas.

Perintah ini asinkron — pemanggilannya kembali ke JavaScript sebelum GPU selesai bekerja.

---

## Refleksi

Bagian tersulit justru bukan menulis shader-nya, melainkan menyadari bahwa WebGL adalah
state machine: `vertexAttribPointer()` diam-diam mengunci buffer yang kebetulan sedang
ter-bind, sehingga satu `bindBuffer()` yang tertukar urutannya membuat sebuah object
menggambar posisi milik object lain tanpa memunculkan error apa pun. Konsep baru yang
paling membekas adalah interpolasi varying — gradien di dalam segitiga ternyata tidak
digambar oleh siapa pun, melainkan muncul sendiri karena rasterizer menghitung nilai antara
`v_color` untuk setiap fragment. Rangkaiannya jadi masuk akal setelah dilihat sebagai satu
rantai: buffer menyimpan data di GPU, attribute menjelaskan cara membacanya, vertex shader
memakainya untuk menempatkan vertex, dan draw call yang menyalakan seluruh rantai itu
sekaligus.

Kesalahan yang paling banyak menyita waktu saat debugging ada dua. Pertama, canvas kosong
karena `#version 300 es` tidak berada di baris pertama — GLSL ES 3.00 menolak apa pun
sebelum direktif itu, termasuk baris kosong. Kedua, primitive hasil klik selalu meleset
makin jauh ke arah tepi, yang ternyata karena ukuran CSS canvas berbeda dari ukuran drawing
buffer-nya sehingga koordinat mouse perlu diskalakan lebih dulu. Keduanya baru ketemu
setelah membiasakan diri membaca `getShaderInfoLog()` dan mengecek nilai NDC di HUD alih-alih
menebak. Yang ingin dicoba lebih lanjut adalah mengganti translasi berbasis penulisan ulang
vertex dengan transformation matrix di vertex shader, serta memakai Vertex Array Object agar
konfigurasi buffer–attribute cukup disiapkan sekali per object.
