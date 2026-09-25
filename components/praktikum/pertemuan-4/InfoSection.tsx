import Section from "@/components/ui/Section";

const PIPELINE = [
  ["Local Vertex", "CUBE_VERTICES — 36 posisi vec3 relatif ke origin cube, tidak pernah berubah"],
  ["GPU Buffer", "createMesh() meng-upload posisi dan warna sekali dengan STATIC_DRAW"],
  ["Model Matrix", "T × Ry × Rx × S per cube — menempatkan dan memutar cube di world space"],
  ["View Matrix", "Mat4.lookAt(position, target, up) — menyatakan ulang world space relatif terhadap kamera"],
  ["Projection Matrix", "perspective(fov, aspect, near, far) atau orthographic(...) — camera space menjadi clip space"],
  ["Vertex Shader", "u_projection * u_view * u_model * vec4(a_position, 1.0)"],
  ["Perspective Divide", "GPU membagi xyz dengan w — tahap yang membuat object jauh mengecil"],
  ["Clipping", "fragment di luar kubus NDC −1..1 dibuang, termasuk yang melewati near/far plane"],
  ["Viewport Transform", "gl.viewport() memetakan NDC ke pixel drawing buffer"],
  ["Depth Test", "membandingkan kedalaman fragment dengan depth buffer sebelum menulis warna"],
  ["Fragment Shader", "v_color yang diinterpolasi dikalikan u_tint"],
  ["Canvas", "hasil akhir yang tampil ke pengguna"],
];

const OBJECTS: [string, string, string][] = [
  ["Cube depan", "z = +0.9, tint putih", "Digambar PERTAMA. Paling dekat ke kamera pada posisi awal"],
  ["Cube tengah", "z = −1.7, tint kebiruan", "Digambar kedua, berputar berlawanan arah"],
  ["Cube belakang", "z = −4.1, tint hangat", "Digambar TERAKHIR — yang menimpa dua cube lain saat depth test mati"],
];

const PROJECTION_COMPARISON: [string, string, string][] = [
  ["Bentuk volume", "Frustum (piramida terpotong)", "Box (balok)"],
  ["Nilai w setelah proyeksi", "w = −z (bergantung kedalaman)", "w = 1 (tetap)"],
  ["Efek perspective divide", "Object jauh mengecil", "Tidak ada perubahan ukuran"],
  ["Garis sejajar", "Berkumpul menuju titik hilang", "Tetap sejajar"],
  ["Dipakai untuk", "Kamera realistis, game first/third person", "CAD, denah, tampilan isometrik"],
];

const CHECKLIST = [
  "Cube 3D dari 36 vertex vec3 dengan warna berbeda per sisi",
  "Rotasi otomatis lewat Model Matrix 4×4 (T × Ry × Rx × S)",
  "Kamera dengan position, target, dan up vector",
  "View Matrix dibangun sendiri lewat lookAt (basis kamera + inversnya)",
  "Kamera digerakkan kontinu dengan state-based keyboard input dan deltaTime",
  "Perspective projection dan orthographic projection keduanya diimplementasikan",
  "Tombol P mengganti proyeksi saat runtime",
  "Aspect ratio dibaca ulang dari drawing buffer tiap frame, tetap benar saat canvas berubah ukuran",
  "Kontrol FOV kontinu ([ dan ]) dengan clamp 15°–120°",
  "Pilihan near/far plane lewat tiga preset, termasuk satu yang sengaja memotong cube",
  "Tombol Depth Test ON/OFF, dan depth buffer dibersihkan setiap frame",
  "HUD menampilkan posisi kamera, proyeksi aktif, FOV, near/far, dan status depth test",
  "Tombol reset mengembalikan kamera, proyeksi, FOV, near/far, dan depth test sekaligus",
  "Console tidak menunjukkan error pada penggunaan normal",
  "Challenge — Orbit camera (tombol O): azimuth, elevation, dan radius",
  "Challenge — Preset FOV 35° / 60° / 90° (tombol 1 / 2 / 3)",
  "Challenge — Tiga cube pada depth berbeda, digambar dekat ke jauh",
];

const NOTES: [string, string][] = [
  [
    "Apa sebenarnya yang dilakukan View Matrix?",
    "View Matrix tidak 'menggerakkan kamera' — kamera di OpenGL/WebGL tidak pernah benar-benar ada. Yang dilakukannya adalah menyatakan ulang seluruh dunia relatif terhadap kamera, yaitu kebalikan (invers) dari transformasi kamera itu sendiri. Kalau kamera bergeser ke kanan 5 unit, View Matrix menggeser seluruh dunia ke kiri 5 unit — hasil di layar sama saja, tapi GPU hanya perlu satu konvensi: object selalu dilihat dari origin, menghadap −Z.",
  ],
  [
    "Bagaimana lookAt membangun matrix itu tanpa menghitung invers?",
    "lookAt membentuk basis kamera dari tiga vektor: zAxis = normalize(eye − target) yang menunjuk ke BELAKANG kamera (karena kamera memandang ke −Z-nya sendiri), xAxis = normalize(cross(up, zAxis)) sebagai arah kanan, dan yAxis = cross(zAxis, xAxis) sebagai up yang sudah dikoreksi. Karena ketiganya saling tegak lurus dan panjangnya 1 (orthonormal), inversnya cukup transpose — itulah kenapa ketiga sumbu tersusun sebagai BARIS pada matrix, bukan kolom. Bagian translasinya diganti −dot(sumbu, eye), yang efeknya memindahkan eye ke origin.",
  ],
  [
    "Mengapa up vector perlu diberikan kalau sudah ada position dan target?",
    "position dan target hanya menentukan arah pandang, belum menentukan rotasi kamera pada sumbu pandang itu (roll). Dua kamera bisa melihat titik yang sama tapi satu terbalik. up memberi petunjuk 'arah mana yang dianggap atas', dan lookAt mengoreksinya menjadi benar-benar tegak lurus lewat dua kali cross product. Kalau up kebetulan sejajar dengan arah pandang — misalnya kamera tepat di atas target — cross product-nya nol dan matrix-nya menjadi NaN; implementasi ini menggantinya dengan up cadangan supaya layar tidak menghitam.",
  ],
  [
    "Apa yang membuat perspective terasa 'perspektif'?",
    "Angka −1 pada baris w kolom ketiga di perspective matrix. Angka itu menyalin −z (kedalaman) ke komponen w hasil proyeksi. Setelah vertex shader selesai, GPU melakukan perspective divide: xyz dibagi w. Karena w sekarang berisi kedalaman, object yang jauh dibagi angka yang lebih besar sehingga mengecil. Orthographic matrix tidak punya angka itu — w tetap 1, pembagian tidak mengubah apa pun, dan ukuran object jadi tidak bergantung jarak.",
  ],
  [
    "Mengapa aspect ratio harus ikut masuk ke projection matrix?",
    "Clip space selalu berbentuk kubus −1..1, lalu viewport transform meregangkannya ke drawing buffer yang biasanya tidak persegi. Tanpa koreksi, regangan itu membuat cube tampak gepeng. Membagi suku X dengan aspect (f/aspect) mengempiskan X lebih dulu, tepat sebesar regangan yang akan terjadi, sehingga keduanya saling meniadakan. Karena itu aspect harus dibaca dari drawing buffer — bukan dari ukuran CSS — dan dihitung ulang setiap kali canvas berubah ukuran.",
  ],
  [
    "Apa beda near/far plane dengan sekadar 'jarak pandang'?",
    "Keduanya bidang datar tegak lurus arah pandang, bukan bola berjari-jari tertentu. Karena itu cube yang terpotong near plane terpotong RATA, bukan melengkung. Selain memotong, keduanya juga menentukan pemetaan kedalaman ke depth buffer: near dipetakan ke −1 dan far ke +1. Rentang yang terlalu lebar (misalnya 0.0001 sampai 10000) membuat presisi depth buffer terkuras di dekat kamera dan memunculkan z-fighting — permukaan yang berkedip karena GPU tidak bisa memutuskan mana yang lebih depan.",
  ],
  [
    "Apa yang sebenarnya dilakukan depth test?",
    "Setiap fragment membawa nilai kedalaman. Sebelum warnanya ditulis, GPU membandingkan kedalaman itu dengan nilai yang sudah tersimpan di depth buffer pada pixel yang sama; kalau lebih jauh, fragment dibuang. Tanpa depth test, yang menang adalah yang digambar paling akhir — urutan draw call menentukan segalanya. Scene ini menggambar cube dari yang terdekat ke terjauh justru supaya kelemahan itu terlihat: tekan D, dan cube belakang langsung menimpa cube depan.",
  ],
  [
    "Mengapa depth buffer harus dibersihkan tiap frame?",
    "Depth buffer menyimpan kedalaman dari frame sebelumnya. Kalau tidak dibersihkan, fragment frame baru dibandingkan dengan kedalaman frame lama dan banyak yang tertolak tanpa alasan — biasanya terlihat sebagai object yang hilang sebagian atau scene yang membeku. Karena itu gl.clear dipanggil dengan COLOR_BUFFER_BIT | DEPTH_BUFFER_BIT sekaligus, dan tetap dipanggil walaupun depth test sedang dimatikan.",
  ],
  [
    "Mengapa cube butuh 36 vertex, bukan 8?",
    "Secara geometri cube memang hanya punya 8 sudut, dan dengan index buffer (gl.drawElements) 8 vertex sudah cukup. Tapi di sini tiap sisi punya warna sendiri, sementara satu vertex hanya bisa membawa satu warna. Sudut yang dipakai bersama tiga sisi harus memilih salah satu warna, dan dua sisi lainnya akan ikut ternoda oleh interpolasi. Menduplikasi sudut menjadi 6 sisi × 2 triangle × 3 vertex = 36 membuat tiap sisi punya set vertex sendiri dengan warna seragam.",
  ],
  [
    "Mengapa Model, View, dan Projection dikirim terpisah, bukan digabung jadi satu MVP?",
    "Menggabungkannya di CPU sebenarnya sedikit lebih murah — satu uniform, bukan tiga. Dipisah di sini karena tujuannya pedagogis: tiap tahap pipeline bisa ditunjuk pada satu baris shader, dan satu matrix bisa diganti tanpa menyentuh dua lainnya (menekan P hanya mengganti Projection, menggerakkan kamera hanya mengganti View). Pada aplikasi nyata dengan ribuan object, MVP biasanya digabung di CPU, atau View dan Projection disimpan dalam uniform buffer object yang dibagi seluruh object.",
  ],
  [
    "Bagaimana orbit camera bekerja?",
    "Alih-alih menyimpan posisi kamera sebagai x/y/z, orbit menyimpan azimuth (sudut memutar horizontal), elevation (sudut naik), dan radius (jarak ke target). Posisi dihitung ulang tiap frame sebagai titik pada permukaan bola di sekitar target: x = r·cos(el)·sin(az), y = r·sin(el), z = r·cos(el)·cos(az). Karena target tidak berubah, kamera selalu menghadapnya. Elevation dibatasi ±85° supaya up tidak pernah sejajar dengan arah pandang. Ini persis gagasan Order B pada Pertemuan 3 — mengorbit sebuah titik — hanya saja kini diterapkan pada kamera, bukan pada object.",
  ],
  [
    "Di mana posisi praktikum ini pada rangkaian pipeline?",
    "Pertemuan 2 berhenti di NDC: vertex ditulis langsung dalam koordinat −1..1. Pertemuan 3 menambahkan Model Matrix, sehingga geometry bisa tetap di local space. Pertemuan 4 melengkapi rantainya dengan View dan Projection, jadi sekarang seluruh transformasi Local → World → Camera → Clip → NDC → Screen benar-benar ada. Yang belum disentuh adalah lighting, normal vector, dan texture — semuanya bekerja di atas kerangka matrix yang sudah berdiri sekarang.",
  ],
];

export default function InfoSection() {
  return (
    <div className="space-y-6">
      <Section
        title="Pipeline yang dijalankan"
        description="Tahap yang dilalui setiap vertex cube, dari data lokal sampai piksel di layar."
      >
        <ol className="space-y-2">
          {PIPELINE.map(([stage, detail], index) => (
            <li key={stage} className="flex gap-3 text-sm">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-500/20 text-[11px] font-semibold text-indigo-300">
                {index + 1}
              </span>
              <span>
                <span className="font-medium text-slate-100">{stage}</span>
                <span className="text-slate-400"> — {detail}</span>
              </span>
            </li>
          ))}
        </ol>
      </Section>

      <Section
        title="Tiga cube, satu buffer"
        description="Ketiganya memakai 36 vertex yang sama persis di GPU; yang berbeda hanya Model Matrix dan tint-nya."
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-4 font-medium">Object</th>
                <th className="py-2 pr-4 font-medium">Penempatan</th>
                <th className="py-2 font-medium">Keterangan</th>
              </tr>
            </thead>
            <tbody>
              {OBJECTS.map(([name, placement, detail]) => (
                <tr key={name} className="border-b border-slate-800/60 last:border-0">
                  <td className="py-2 pr-4 text-slate-100">{name}</td>
                  <td className="py-2 pr-4 font-mono text-xs text-indigo-300">{placement}</td>
                  <td className="py-2 text-slate-400">{detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-slate-500">
          Urutan gambar sengaja dibuat dekat &rarr; jauh. Dengan depth test aktif hasilnya benar
          apa pun urutannya, tetapi begitu depth test dimatikan, cube yang digambar terakhir
          memenangkan setiap pixel yang bertumpuk — kegagalan painter&rsquo;s algorithm yang
          menjadi alasan depth buffer ada.
        </p>
      </Section>

      <Section
        title="Perspective vs orthographic"
        description="Scene, kamera, dan FOV-nya sama persis — yang berbeda hanya bentuk volume yang dipetakan ke clip space."
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-4 font-medium">Aspek</th>
                <th className="py-2 pr-4 font-medium">Perspective</th>
                <th className="py-2 font-medium">Orthographic</th>
              </tr>
            </thead>
            <tbody>
              {PROJECTION_COMPARISON.map(([aspect, a, b]) => (
                <tr key={aspect} className="border-b border-slate-800/60 last:border-0">
                  <td className="py-2 pr-4 text-slate-100">{aspect}</td>
                  <td className="py-2 pr-4 text-slate-400">{a}</td>
                  <td className="py-2 text-slate-400">{b}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-slate-500">
          Catatan implementasi: tinggi box orthographic dihitung dari tinggi frustum perspective
          pada jarak target, yaitu <code className="text-slate-300">tan(fov/2) × jarak</code>.
          Tanpa penyamaan itu, menekan <kbd className="font-mono text-slate-300">P</kbd> akan
          membuat scene melompat besar-kecil dan perbedaan yang sebenarnya — hilangnya konvergensi
          perspektif — jadi tertutupi oleh perubahan skala.
        </p>
      </Section>

      <Section title="Catatan konsep" description="Jawaban ringkas untuk pertanyaan pemahaman pada modul.">
        <dl className="space-y-4">
          {NOTES.map(([question, answer]) => (
            <div key={question}>
              <dt className="text-sm font-medium text-slate-100">{question}</dt>
              <dd className="mt-1 text-sm leading-relaxed text-slate-400">{answer}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section title="Checklist tugas" description="Syarat pada modul dan pemenuhannya.">
        <ul className="space-y-1.5">
          {CHECKLIST.map((item) => (
            <li key={item} className="flex gap-2 text-sm text-slate-300">
              <span className="text-emerald-400">✓</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
