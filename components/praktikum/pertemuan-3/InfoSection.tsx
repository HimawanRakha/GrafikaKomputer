import Section from "@/components/ui/Section";

const PIPELINE = [
  ["Local Vertex", "TRIANGLE_VERTICES / DOOR_VERTICES — koordinat tetap relatif ke origin object"],
  ["GPU Buffer", "createStaticMesh() meng-upload posisi sekali dengan STATIC_DRAW, tidak pernah ditulis ulang"],
  ["Model Matrix", "translation × rotation × scaling digabung jadi satu matrix 3×3 di CPU"],
  ["Uniform", "gl.uniformMatrix3fv(u_matrix, false, matrix) — satu matrix per draw call"],
  ["Vertex Shader", "u_matrix * vec3(a_position, 1.0) menerapkan transform pada tiap vertex"],
  ["World Position", "hasil kali matrix × vertex — posisi object yang sebenarnya di layar"],
  ["Rasterization", "triangle/line/point dipecah jadi fragment"],
  ["Fragment Shader", "mengisi tiap fragment dengan u_color"],
  ["Canvas", "hasil akhir yang tampil ke pengguna"],
];

const OBJECTS: [string, string, string][] = [
  ["Object A", "composeTransform (Order A atau B)", "Dikendalikan keyboard & klik mouse — translate, rotate, uniform/non-uniform scale, deltaTime"],
  ["Object B", "composeOrderA, otomatis", "Geometry triangle yang sama dengan Object A; rotasi kontinu + scale berosilasi (sin), posisi tetap"],
  ["Door", "composeOrderA, otomatis", "Rectangle dengan local origin di tepi (bukan tengah) — berayun seperti pintu berengsel"],
  ["Pivot marker", "matrix Door yang sama", "gl.POINTS di local (0,0) — selalu menempel di engsel Door, ke mana pun Door berputar"],
  ["Axes", "identity matrix", "gl.LINES sumbu X dan Y, penanda world origin (0,0)"],
];

const ORDER_COMPARISON: [string, string, string][] = [
  ["Matrix product", "M = T × R × S", "M = R × T"],
  ["Urutan diterapkan ke titik", "Scale → Rotate → Translate", "Translate → Rotate"],
  ["Efek visual", "Object berputar & berskala di tempatnya sendiri, baru dipindah", "Object mengorbit mengelilingi origin dunia"],
  ["Kapan dipakai", "Perilaku normal object dalam game/scene", "Menjelaskan kenapa satelit/planet terlihat mengorbit"],
];

const CHECKLIST = [
  "WebGL2 context, viewport, dan background non-default",
  "Geometry (triangle & door) tersimpan sebagai local coordinate, di-upload sekali ke GPU buffer",
  "Homogeneous coordinate — vec3(a_position, 1.0) di vertex shader",
  "Translation, rotation, dan scaling matrix (Mat3.translation/rotation/scaling)",
  "Uniform scaling (+/-) dan non-uniform scaling (Z/X untuk X, C/V untuk Y)",
  "Matrix multiplication dan Model Matrix (T×R×S) dikirim sebagai uniform mat3",
  "Dua object (A & B) berbagi satu geometry triangle yang sama persis",
  "Keyboard translation, rotation, scaling — semuanya state-based, dibaca per frame",
  "deltaTime (detik, dibatasi maksimum 0.05) supaya kecepatan konsisten di refresh rate berapa pun",
  "Automatic animation — Object B berotasi dan berskala otomatis terhadap waktu",
  "Dua transform order berbeda (Order A vs Order B) dan HUD yang menampilkan order aktif",
  "HUD position, rotation, scale Object A sebagai HTML biasa, bukan teks di canvas",
  "Coordinate axes dan pivot marker sebagai referensi world origin & titik putar",
  "Console tidak menunjukkan error pada penggunaan normal",
  "Challenge B — tiga preset transform (tombol 1/2/3)",
  "Challenge C — toggle transform order (tombol T)",
  "Challenge D — klik canvas memindahkan Object A lewat konversi NDC",
];

const NOTES: [string, string][] = [
  [
    "Apa perbedaan local coordinate dan world coordinate?",
    "Local coordinate adalah posisi vertex relatif terhadap origin object itu sendiri — TRIANGLE_VERTICES tidak pernah berubah. World coordinate adalah tempat object itu berakhir setelah Model Matrix-nya diterapkan. Object A dan B memakai vertex local yang identik, tapi tampil di posisi dunia yang berbeda karena matrix-nya berbeda.",
  ],
  [
    "Apa fungsi Model Matrix, dan kenapa geometry sebaiknya tetap di local space?",
    "Model Matrix menggabungkan translation, rotation, dan scaling satu object menjadi satu matrix 3×3 yang dikirim sebagai uniform, sehingga vertex buffer tidak perlu ditulis ulang tiap frame. Karena itu satu buffer geometry (triangle) bisa dipakai ulang untuk banyak object — cukup ganti matrix-nya. Bandingkan dengan Pertemuan 2, yang menulis ulang vertex tiap kali object bergerak.",
  ],
  [
    "Apa perbedaan uniform dan non-uniform scaling?",
    "Uniform: scaleX sama dengan scaleY (tombol +/-), bentuk membesar/mengecil proporsional. Non-uniform: scaleX dan scaleY berubah sendiri-sendiri (Z/X untuk X, C/V untuk Y), sehingga bentuknya bisa jadi gepeng atau memanjang — coba pada Object A dan bandingkan dengan Door, yang non-uniform secara permanen (lebar dan tinggi berbeda).",
  ],
  [
    "Mengapa homogeneous coordinate (menambahkan w) diperlukan?",
    "Rotation dan scaling bisa ditulis sebagai perkalian matrix 2×2 biasa, tapi translation tidak bisa — translation adalah penjumlahan, bukan perkalian. Menambahkan komponen ketiga (w=1 untuk titik) membuat translation ikut bisa ditulis sebagai matrix 3×3, sehingga ketiganya bisa digabung lewat perkalian matrix yang sama. w=0 dipakai untuk direction/vector, supaya baris translation matrix (yang dikalikan w) tidak ikut menggeser arah — arah tidak punya posisi, jadi tidak seharusnya ikut bergeser.",
  ],
  [
    "Apa perbedaan attribute dan uniform di sini?",
    "a_position adalah attribute: nilainya berbeda untuk tiap vertex, dibaca dari buffer lewat vertexAttribPointer(). u_matrix dan u_color adalah uniform: nilainya sama untuk semua vertex dalam satu draw call — cocok untuk Model Matrix dan warna, karena satu object memakai satu matrix dan satu warna yang sama di seluruh vertex-nya.",
  ],
  [
    "Mengapa matrix uniform lebih baik daripada mentransformasi vertex di CPU?",
    "Menulis ulang tiap vertex di CPU lalu meng-upload ulang ke GPU (pendekatan Pertemuan 2) berarti transfer CPU→GPU setiap frame untuk setiap object yang bergerak. Matrix uniform hanya mengirim 9 angka float, lalu perkalian matrix×vertex dikerjakan GPU secara paralel di vertex shader untuk semua vertex sekaligus — jauh lebih murah, apalagi kalau geometry-nya punya banyak vertex.",
  ],
  [
    "Mengapa T×R menghasilkan sesuatu yang berbeda dari R×T?",
    "Perkalian matrix tidak komutatif. composeOrderA menghasilkan M = T×R×S: titik di-scale dan di-rotate dulu di sekitar local origin-nya sendiri, baru dipindah (translate) ke posisi dunia — hasilnya object berputar di tempat. composeOrderB menghasilkan M = R×T: titik ditranslate dulu menjauhi origin, baru hasilnya yang sudah pindah itu ikut dirotasi — hasilnya object mengorbit origin dunia. Lihat panel Transform Order untuk membandingkan keduanya secara langsung.",
  ],
  [
    "Apa hubungan pivot dengan rotation dan scaling?",
    "Rotation dan scaling matrix selalu bekerja relatif terhadap local origin (0,0). Triangle Object A/B dibuat simetris terhadap (0,0), jadi keduanya berputar dan berskala di tengah. DOOR_VERTICES sengaja dimulai dari x=0 (bukan -0.5), sehingga (0,0) berada di tepi kiri rectangle — akibatnya Door berputar seperti berengsel di tepi, dan menskalakan lebarnya (scaleX) tetap menjaga sisi engsel itu diam di tempat.",
  ],
  [
    "Mengapa state-based cocok untuk kontrol kontinu, dan untuk apa deltaTime?",
    "State-based (keys[event.code] = true/false) membuat translate/rotate/scale terus berjalan selama tombol ditahan, dibaca ulang tiap frame di updateObjectA() — tidak bergantung pengaturan keyboard repeat sistem operasi. deltaTime (detik sejak frame sebelumnya, dibatasi maksimum 0.05 detik) memastikan kecepatan (mis. 0.65 unit/detik) sama saja baik di layar 60Hz maupun 144Hz; tanpa itu, refresh rate yang lebih tinggi berarti lebih banyak frame per detik sehingga gerakannya ikut lebih cepat dari yang seharusnya.",
  ],
  [
    "Bagaimana Model Matrix berhubungan dengan konsep parent-child?",
    "Praktikum ini belum mengimplementasikan hierarchical transform, tapi Door dan pivot marker-nya sudah menunjukkan prinsip yang sama: keduanya memakai Model Matrix yang identik, sehingga marker selalu 'menempel' pada titik pivot Door ke mana pun Door bergerak atau berputar. Prinsip umumnya: ChildWorld = ParentWorld × ChildLocal — kalau parent berubah, hasil kali matrix-nya berubah, dan posisi akhir child ikut berubah walau ChildLocal-nya sendiri tidak disentuh.",
  ],
  [
    "Ke mana arah pipeline ini setelah Model Matrix (Pertemuan 4)?",
    "View Matrix memindahkan world coordinate menjadi relatif terhadap kamera. Projection Matrix memproyeksikannya menjadi clip coordinate (homogeneous). Perspective divide (bagi dengan w) mengubah clip coordinate menjadi NDC (-1..1). Viewport transform terakhir memetakan NDC ke pixel di layar (screen coordinate). Praktikum ini berhenti di Model Matrix karena View dan Projection belum dipakai — semua yang tampil di canvas sekarang secara efektif sudah berada di ruang mirip NDC.",
  ],
];

export default function InfoSection() {
  return (
    <div className="space-y-6">
      <Section
        title="Pipeline yang dijalankan"
        description="Tahap yang dilalui setiap object, dari data lokal sampai piksel di layar."
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
        description="Semua object memakai program shader yang sama; yang membedakan hanya matrix dan warnanya."
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-4 font-medium">Object</th>
                <th className="py-2 pr-4 font-medium">Composition</th>
                <th className="py-2 font-medium">Keterangan</th>
              </tr>
            </thead>
            <tbody>
              {OBJECTS.map(([name, matrix, detail]) => (
                <tr key={name} className="border-b border-slate-800/60 last:border-0">
                  <td className="py-2 pr-4 text-slate-100">{name}</td>
                  <td className="py-2 pr-4 font-mono text-xs text-indigo-300">{matrix}</td>
                  <td className="py-2 text-slate-400">{detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section
        title="Transform order: kenapa urutan penting"
        description="Order A dan Order B memakai parameter yang sama persis — bedanya hanya urutan perkalian matrix."
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-4 font-medium">Aspek</th>
                <th className="py-2 pr-4 font-medium">Order A</th>
                <th className="py-2 font-medium">Order B</th>
              </tr>
            </thead>
            <tbody>
              {ORDER_COMPARISON.map(([aspect, a, b]) => (
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
          Catatan implementasi: modul menyusun <code className="text-slate-300">createTRSMatrix</code>{" "}
          dengan memanggil <code className="text-slate-300">multiply</code> berurutan S, lalu R, lalu T.
          Karena <code className="text-slate-300">Mat3.multiply(a, b)</code> mengembalikan a×b dan hasilnya
          dipakai sebagai M×titik, urutan panggil itu justru membangun S×R×T — Translate diterapkan
          duluan ke titik dan Scale paling akhir, kebalikan dari label &ldquo;Scale → Rotate →
          Translate&rdquo; yang dituju (createRTMatrix punya kebalikan yang sama). Playground ini
          memanggil multiply dengan urutan terbalik dari cara labelnya dibaca (T, R, S untuk Order A;
          R, T untuk Order B) supaya matrix akhirnya benar-benar cocok dengan labelnya. Ini persis gejala
          yang disebut modul bagian 69, &ldquo;Debugging Transform Order&rdquo;: kalau object mengorbit
          padahal seharusnya berputar di tempat, periksa urutan multiplication-nya.
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
