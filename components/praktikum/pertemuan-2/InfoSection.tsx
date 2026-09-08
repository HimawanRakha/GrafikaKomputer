import Section from "@/components/ui/Section";

// Every object drawn in the scene, with the pipeline detail worth pointing at.
const OBJECTS: [string, string, string][] = [
  ["Gradient triangle", "gl.TRIANGLES", "3 vertex, 3 warna berbeda (merah, hijau, biru)"],
  ["Gradient rectangle", "mengikuti selector", "2 triangle, 6 vertex, 4 warna sudut"],
  ["Star", "gl.LINE_LOOP", "10 vertex prosedural, hue disapu keliling"],
  ["Point grid", "gl.POINTS", "7×5 vertex dari nested loop, gl_PointSize = 10"],
  ["Bouncing triangle", "gl.TRIANGLES", "DYNAMIC_DRAW, horizontal, tercepat (0,007/frame)"],
  ["Vertical triangle", "gl.TRIANGLES", "DYNAMIC_DRAW, vertikal, terlambat (0,005/frame)"],
  ["Diagonal hexagon", "gl.LINE_LOOP", "DYNAMIC_DRAW, diagonal, memantul di dua sumbu"],
  ["Player triangle", "gl.TRIANGLES", "DYNAMIC_DRAW, digerakkan keyboard state-based"],
  ["Primitive hasil klik", "mengikuti selector", "dibuat dari koordinat mouse yang dikonversi ke NDC"],
];

const PIPELINE = [
  ["Vertex Data", "Float32Array berisi koordinat NDC dan warna per vertex"],
  ["Buffer", "createBuffer() + bufferData() menyalin data ke memori GPU"],
  ["Attribute", "vertexAttribPointer() menjelaskan cara membaca buffer itu"],
  ["Vertex Shader", "dijalankan sekali per vertex, mengisi gl_Position"],
  ["Primitive Assembly", "vertex dirangkai jadi triangle / line / point"],
  ["Rasterization", "primitive dipecah jadi fragment, v_color diinterpolasi"],
  ["Fragment Shader", "dijalankan per fragment, menghasilkan warna akhir"],
  ["Framebuffer → Canvas", "hasil rasterisasi ditampilkan di layar"],
];

const CHECKLIST = [
  "Minimal 3 primitive — triangle, rectangle, star, point grid, tiga object bergerak, player",
  "Minimal 2 draw mode — TRIANGLES, LINE_LOOP, dan POINTS (tiga-tiganya dipakai)",
  "Vertex color dengan interpolasi pada triangle dan rectangle",
  "Minimal 3 warna — palet enam warna, plus hue sweep prosedural",
  "Satu object bergerak dan memantul di batas NDC (tiga object, sebenarnya)",
  "Interaksi keyboard state-based (Arrow/WASD) dan event-based (R, C, P)",
  "Interaksi mouse — klik membuat primitive baru, posisi mouse tampil dalam NDC",
  "Rendering loop dengan requestAnimationFrame",
  "Background non-default melalui gl.clearColor(0.04, 0.06, 0.12, 1.0)",
  "Challenge A — selector draw mode Triangle / Lines / Points",
  "Challenge B — kontrol warna merah, hijau, biru, cyan, dan Random lewat button HTML",
  "Challenge C — spawn primitive di posisi klik",
  "Challenge D — tiga object bergerak dengan posisi, kecepatan, dan arah berbeda",
  "Challenge E — pola prosedural: point grid nested loop dan star dari loop trigonometri",
  "Challenge F — HUD FPS, jumlah primitive, draw mode aktif, dan mouse NDC",
];

const NOTES: [string, string][] = [
  [
    "Mengapa rectangle dibuat dari dua triangle?",
    "GPU hanya merasterisasi point, line, dan triangle. Quad tidak ada di daftar itu, jadi persegi panjang dipecah sepanjang satu diagonal menjadi 6 vertex. Karena dua vertex diagonal memakai warna yang sama di kedua triangle, interpolasinya menyambung tanpa garis jahitan yang terlihat.",
  ],
  [
    "Dari mana gradien di dalam triangle berasal?",
    "Vertex shader hanya menulis 3 nilai warna — satu per vertex. Rasterizer-lah yang menghitung nilai antara untuk setiap fragment di dalam segitiga. Jadi gradien bukan sesuatu yang digambar, melainkan efek samping dari interpolasi variabel out/in antara vertex shader dan fragment shader.",
  ],
  [
    "Mengapa bentuk bulat perlu dibagi aspect ratio?",
    "NDC selalu -1..1 di kedua sumbu, apa pun ukuran canvas. Pada canvas 960×600, satu unit NDC horizontal setara 1,6× lebih banyak pixel daripada vertikal, sehingga lingkaran murni akan tampil sebagai elips melebar. Builder prosedural (star, polygon, point ring) membagi komponen x dengan 960/600 supaya bentuknya kembali proporsional di layar.",
  ],
  [
    "Mengapa hanya sebagian object di-upload ulang tiap frame?",
    "Pertemuan ini belum memakai transformation matrix, jadi translasi berarti menulis ulang koordinat vertex lalu mengirimnya lagi ke GPU. Itu mahal kalau dilakukan untuk semua object. Hanya object yang benar-benar bergerak yang dibuat dengan DYNAMIC_DRAW dan di-upload ulang; sisanya cukup sekali dengan STATIC_DRAW saat inisialisasi.",
  ],
  [
    "Mengapa translasi tidak memakai satu Float32Array baru tiap frame?",
    "Mengalokasikan array baru 60× per detik membebani garbage collector dan bisa memunculkan stutter. Setiap object menyimpan satu scratch array yang ukurannya tetap, lalu hasil basePositions + offset ditulis ulang ke sana sebelum di-upload.",
  ],
  [
    "Kenapa state-based, bukan event-based, untuk pergerakan?",
    "Event keydown mengikuti pengaturan key repeat sistem operasi: ada jeda sebelum pengulangan pertama, dan lajunya tidak sinkron dengan frame. Dengan state-based, keydown/keyup hanya mencatat tombol mana yang sedang ditahan, lalu pergerakan dihitung sekali per frame di updateKeyboard(). Hasilnya mulus, mendukung dua tombol sekaligus (diagonal), dan tidak bergantung setelan OS. Aksi diskrit seperti R, C, dan P justru cocok event-based karena hanya perlu bereaksi sekali per penekanan.",
  ],
  [
    "Kenapa attribute perlu di-set ulang sebelum tiap draw call?",
    "Attribute tidak menyimpan referensi ke buffer. vertexAttribPointer() merekam buffer mana pun yang sedang ter-bind ke ARRAY_BUFFER pada saat itu juga. Karena setiap object punya pasangan buffer sendiri, bind dan pointer harus diulang sebelum draw call-nya. WebGL2 punya Vertex Array Object untuk menyimpan konfigurasi ini sekali saja — sengaja tidak dipakai di sini agar urutan buffer → attribute tetap terlihat eksplisit.",
  ],
  [
    "Apa yang sebenarnya berubah saat draw mode diganti?",
    "Selector draw mode menggambar ulang gradient rectangle tanpa menyentuh isi buffer sama sekali — 6 vertex yang sama tetap ada di GPU. Dengan TRIANGLES, GPU membaca vertex tiga-tiga menjadi 2 segitiga penuh. Dengan LINE_LOOP, keenamnya disambung berurutan lalu ditutup kembali ke vertex pertama, sehingga urutan penyusunan quad-nya justru terlihat sebagai zigzag melintasi diagonal. Dengan POINTS, tampak hanya 4 titik, bukan 6, karena dua vertex diagonal memang duplikat dan saling menimpa. Jadi draw mode mengubah aturan primitive assembly, bukan datanya.",
  ],
  [
    "Kenapa object bergerak memantul di tepinya, bukan di titik tengahnya?",
    "Offset yang dianimasikan menggeser seluruh vertex, sedangkan batas NDC berlaku pada vertex terluar. Kalau pantulan diuji pada offset saja, separuh bentuk sudah keluar layar sebelum berbalik. measureBounds() menghitung kotak pembatas tiap object sekali di awal, lalu pengujian dilakukan pada offset + tepi. Posisinya juga dikunci kembali ke batas saat memantul, supaya frame delta yang besar tidak menanam object di luar layar dan membuatnya berbalik arah setiap frame.",
  ],
  [
    "Kenapa garis star selalu setipis 1 pixel?",
    "gl.lineWidth() ada di spesifikasi, tetapi hampir semua implementasi WebGL modern mengabaikan nilai selain 1. Garis yang lebih tebal biasanya dibuat dengan menyusunnya sebagai triangle, bukan lewat parameter line width.",
  ],
];

export default function InfoSection() {
  return (
    <div className="space-y-6">
      <Section
        title="Pipeline yang dijalankan"
        description="Urutan tahap yang dilalui setiap object sebelum muncul di canvas."
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
        title="Object di dalam scene"
        description="Setiap object punya pasangan buffer sendiri untuk posisi dan warna."
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-4 font-medium">Object</th>
                <th className="py-2 pr-4 font-medium">Draw mode</th>
                <th className="py-2 font-medium">Vertex data</th>
              </tr>
            </thead>
            <tbody>
              {OBJECTS.map(([name, mode, data]) => (
                <tr key={name} className="border-b border-slate-800/60 last:border-0">
                  <td className="py-2 pr-4 text-slate-100">{name}</td>
                  <td className="py-2 pr-4 font-mono text-xs text-indigo-300">{mode}</td>
                  <td className="py-2 text-slate-400">{data}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Catatan konsep" description="Alasan di balik keputusan implementasi.">
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
