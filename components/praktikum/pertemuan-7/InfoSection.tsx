import Section from "@/components/ui/Section";

const SCENE_GRAPH = `Scene
├── AmbientLight, DirectionalLight (castShadow)
├── Ground (receiveShadow)
├── Hierarchy Demo (Group)          ← selectable
│   └── Body
│       ├── Child Object            ← local (1, 0, 0) relatif ke Body
│       └── Wheel ×4
├── PBR Sphere                      ← selectable, preset A–D
├── PBR Gallery (Group)
│   └── 9 sphere, roughness × metalness   ← tiap sphere selectable
├── Solar System (Group)            ← selectable
│   └── Sun └── Earth Orbit └── Earth └── Moon Orbit └── Moon
├── Selection Ring                  ← helper, tidak ikut raycast
└── Imported GLB (gltf.scene)       ← selectable
    └── Robot └── Hips ├── Torso ── Head, ShoulderL/R ── Arm ── Hand
                       └── LegL/R ── LegMesh ── Foot`;

const PIPELINE = [
  ["Scene Graph", "Object3D tersusun parent → children; transform anak dihitung dari transform induk"],
  ["PBR Material", "MeshStandardMaterial — warna + roughness + metalness, dibaca bersama lampu dan environment"],
  ["GLB Asset", "GLTFLoader memuat robot.glb secara asynchronous; hasilnya ditelusuri dengan traverse()"],
  ["AnimationMixer", "satu mixer, tiga AnimationAction (Idle, Walk, Wave); mixer.update(delta) tiap frame"],
  ["Raycasting", "pointer pixel → NDC → setFromCamera() → intersectObjects(..., true)"],
  ["Hover + Click", "hover = sementara mengikuti pointer, click = pilihan yang bertahan"],
  ["Selection State", "hoveredObject dan selectedObject disimpan terpisah, prioritas selected > hovered"],
  ["Visual Feedback", "scale 1.06× / 1.12×, ring di ground, rotasi pelan, HUD, information panel"],
  ["Environment", "RoomEnvironment → PMREMGenerator → scene.environment, background tetap warna polos"],
];

const PBR_TABLE: [string, string, string, string][] = [
  ["A", "0.1", "0.0", "Plastik mengilap — highlight kecil dan tajam, warna tetap dari albedo"],
  ["B", "0.8", "0.0", "Plastik doff — cahaya tersebar rata, hampir tanpa highlight"],
  ["C", "0.1", "1.0", "Metal halus — memantulkan environment seperti cermin berwarna"],
  ["D", "0.8", "1.0", "Metal kasar — pantulan environment kabur, kesan logam disikat"],
];

const INTERACTION: [string, string, string][] = [
  ["Pemicu", "pointermove di atas canvas", "click tanpa drag (≤ 5 piksel)"],
  ["State", "hoveredObject", "selectedObject"],
  ["Umur", "hilang saat pointer pindah / keluar canvas", "bertahan sampai klik area kosong, Esc, atau Reset"],
  ["Feedback", "scale 1.06×, kursor pointer", "scale 1.12×, ring biru di ground, rotasi pelan, HUD & panel"],
  ["Saat drag orbit", "dibekukan", "tidak berubah"],
];

const CHECKLIST = [
  "Scene, PerspectiveCamera, WebGLRenderer, ground, lighting, shadow, animation loop",
  "Responsive rendering lewat ResizeObserver pada canvas",
  "THREE.Group dan hierarchy parent-child (Group → Body → Child, plus 4 wheel)",
  "Local vs world transform ditampilkan langsung di HUD (Child local vs Child world)",
  "MeshStandardMaterial dengan roughness dan metalness pada sphere, galeri, robot",
  "GLB dimuat dengan GLTFLoader, progress dan error ditangani, dibuang bila komponen sudah unmount",
  "Hierarchy GLB ditelusuri dengan traverse() — jumlah node, mesh, kedalaman dicatat di Console & HUD",
  "Seluruh mesh GLB castShadow dan receiveShadow",
  "Tiga animation clip dijalankan lewat AnimationMixer, diperbarui dengan mixer.update(delta)",
  "THREE.Raycaster, pointer NDC berbasis bounding rect canvas, recursive intersection",
  "Hover dan click selection dengan state terpisah dan prioritas visual yang jelas",
  "Klik tidak berubah menjadi selection saat pengguna sebenarnya sedang drag orbit/pan",
  "OrbitControls dengan batas jarak, zoom, dan polar angle; damping diperbarui sebelum render",
  "Environment lighting procedural (RoomEnvironment), terpisah dari scene.background",
  "Seluruh animasi memakai delta time yang dibatasi 0,05 detik",
  "Console tanpa error pada penggunaan normal",
  "Challenge A — multiple animation clips (1 / 2 / 3) dengan crossfade",
  "Challenge B — klik robot memutar clip Wave sekali lalu kembali ke clip loop",
  "Challenge C — information panel: name, position, rotation, scale, material type",
  "Challenge D — hierarchical solar system Sun → Earth Orbit → Earth → Moon Orbit → Moon",
  "Challenge E — PBR material gallery 3 × 3 (roughness × metalness)",
  "Challenge G — object terpilih berputar pelan, berhenti saat deselect",
  "Challenge H — environment toggle (E) dengan status di panel",
];

const NOTES: [string, string][] = [
  [
    "Apa itu Scene Graph, dan mengapa memakai hierarchy?",
    "Scene Graph adalah pohon Object3D: setiap object punya satu parent dan boleh punya banyak children. Transform anak selalu dinyatakan relatif terhadap induknya, jadi menggerakkan Hierarchy Group membawa Body, Child, dan keempat wheel sekaligus tanpa satu pun posisinya diubah. Untuk robot atau kendaraan dengan puluhan bagian, cukup satu transform di root — bukan menghitung ulang posisi tiap bagian.",
  ],
  [
    "Mengapa local position child tidak sama dengan world position-nya?",
    "child.position = (1, 0, 0) hanya berarti 'satu unit ke kanan dari Body'. World position-nya adalah hasil matrixWorld(child) = matrixWorld(parent) × matrix(child), jadi ikut digeser, diputar, dan diskalakan oleh Body dan Hierarchy Group. Karena group terus berputar, baris Child world di HUD berubah tiap saat sementara Child local tetap (1, 0, 0) — dan karena itu wheel dari sebuah car tidak perlu diubah local position-nya saat car bergerak 10 unit.",
  ],
  [
    "Apa fungsi THREE.Group, dan apakah Group butuh geometry?",
    "Group adalah Object3D kosong tanpa geometry dan material — ia tidak pernah digambar. Fungsinya mengelompokkan object dan memberi transform bersama. Transform Group bila semua bagian harus bergerak bersama (memindah seluruh tata surya), transform child bila hanya satu bagian yang bergerak relatif terhadap yang lain (orbit bumi, putaran wheel).",
  ],
  [
    "Apa arti roughness dan metalness?",
    "Roughness 0 berarti permukaan sangat halus (pantulan tajam), 1 sangat kasar (pantulan menyebar). Metalness 0 berarti non-metal — warna berasal dari albedo dan highlight-nya putih; metalness 1 berarti logam — tidak ada warna difus, seluruh tampilannya berasal dari pantulan lingkungan yang diwarnai. Itulah kenapa dua sphere berwarna sama bisa terlihat sangat berbeda: baris paling bawah galeri (metalness 1) tampak jauh lebih gelap dan reflektif daripada baris paling atas.",
  ],
  [
    "Mengapa PBR, terutama material metal, butuh environment?",
    "Material metal hampir tidak punya komponen difus; yang terlihat adalah pantulan dunia di sekitarnya. Tanpa scene.environment, satu-satunya yang bisa dipantulkan adalah DirectionalLight dan AmbientLight, sehingga metal tampak gelap dan datar. Tekan E saat preset C aktif: sphere metal halus langsung kehilangan hampir seluruh kilaunya.",
  ],
  [
    "Apa beda scene.background dan scene.environment?",
    "scene.background adalah latar yang tampak di belakang object. scene.environment adalah tekstur yang dipakai material untuk pencahayaan dan pantulan, dan tidak pernah tampak langsung. Keduanya boleh memakai tekstur yang sama, tapi di sini sengaja dibedakan: background warna polos, environment berasal dari RoomEnvironment — buktinya, cahaya ruangan terlihat memantul di robot padahal latarnya kosong.",
  ],
  [
    "Apa itu GLTF dan GLB, dan apa yang dibawanya?",
    "GLTF adalah format scene 3D yang dapat membawa mesh, material, texture, hierarchy, dan animation. Versi .gltf berupa JSON plus berkas .bin dan gambar terpisah; GLB mengemas seluruhnya dalam satu berkas biner sehingga distribusinya sederhana. robot.glb di sini membawa 30-an node bertingkat, empat material PBR, dan tiga animation clip.",
  ],
  [
    "Mengapa loading GLB asynchronous, dan bagaimana ditangani?",
    "loader.load() hanya memulai request; download dan parsing berjalan di belakang, dan hasilnya baru tersedia di callback. Karena itu semua logic yang butuh model — traverse(), shadow, registerSelectable, AnimationMixer — dijalankan di dalam callback. Ada satu kasus tambahan di React: komponen bisa sudah unmount sebelum download selesai (Strict Mode me-mount dua kali), sehingga callback memeriksa flag disposed dan membuang hasilnya alih-alih menambahkannya ke scene yang sudah mati.",
  ],
  [
    "Mengapa traverse(), dan mengapa recursive raycast?",
    "gltf.scene hampir tidak pernah satu Mesh; robot ini punya root Group, joint Group, dan belasan Mesh di kedalaman berbeda. traverse() mengunjungi semuanya untuk mengaktifkan shadow. Hal yang sama berlaku untuk raycasting: intersectObjects(..., false) hanya menguji object di daftar itu sendiri, padahal gltf.scene tidak punya geometry — ray tidak akan pernah mengenai robot. Dengan true, ray menguji seluruh descendant, lalu findSelectableRoot() memetakan mesh yang terkena (misalnya HandR) kembali ke root yang ditandai selectable.",
  ],
  [
    "Mengapa action.play() saja belum cukup?",
    "play() hanya mengaktifkan action. Waktu animasinya baru maju ketika mixer.update(delta) dipanggil, dan pemanggilan itu menulis nilai keyframe ke quaternion dan position tiap node. Tanpa update di animation loop, clip berstatus 'playing' tapi robot diam di pose awal.",
  ],
  [
    "Apa itu raycasting, dan mengapa pointer harus diubah ke NDC?",
    "Raycasting menembakkan sinar dari kamera melalui posisi pointer untuk mencari object 3D yang dilewati. Browser memberi posisi dalam pixel relatif terhadap viewport, sedangkan setFromCamera() membutuhkan Normalized Device Coordinates −1..+1 dengan Y ke atas. Rumusnya memakai getBoundingClientRect() canvas — bukan ukuran window — karena di portal ini canvas tidak memenuhi layar. Baris Pointer NDC di HUD bisa dipakai memeriksa: pojok kiri atas mendekati (−1, 1), kanan bawah (1, −1).",
  ],
  [
    "Mengapa hoveredObject dan selectedObject disimpan terpisah?",
    "Keduanya menjawab pertanyaan berbeda: 'apa yang sedang ditunjuk' berubah setiap gerakan pointer, sedangkan 'apa yang dipilih' harus bertahan setelah pointer pergi. Bila disimpan di satu variabel, menggerakkan pointer akan menghapus pilihan. Satu fungsi refreshVisual() membaca kedua state dengan prioritas selected > hovered > normal, sehingga keduanya tidak pernah saling menimpa skala.",
  ],
  [
    "Mengapa click harus dibedakan dari drag?",
    "OrbitControls memakai drag kiri untuk orbit, dan browser tetap mengirim event click di akhir drag. Tanpa pembeda, setiap kali kamera diputar, object di bawah pointer ikut terpilih. Posisi pointerdown disimpan; begitu pointer bergeser lebih dari 5 piksel, selection ditekan untuk gesture itu — termasuk bila pointer kembali ke titik awal. Gerakan dipantau di window pada fase capture karena OrbitControls menangkap pointer selama drag.",
  ],
  [
    "Mengapa robot dibuat sendiri, bukan diunduh?",
    "Modul menyerahkan GLB kepada mahasiswa dan meminta asset yang punya hierarchy, material, dan animation clip. Robot ini dibangun dengan Three.js lalu diekspor dengan GLTFExporter (scripts/build-robot-glb.mjs), sehingga lisensinya jelas, sumbernya bisa dibaca, dan clip-nya dirancang khusus untuk challenge: Idle dan Walk berulang, Wave sekali jalan untuk respons klik.",
  ],
];

export default function InfoSection() {
  return (
    <div className="space-y-6">
      <Section title="Struktur scene graph" description="Setiap object adalah Object3D; garis menunjukkan hubungan parent → children.">
        <div className="overflow-x-auto">
          <pre className="font-mono text-xs leading-relaxed text-slate-300">{SCENE_GRAPH}</pre>
        </div>
      </Section>

      <Section title="Pipeline aplikasi" description="Dari scene statis Pertemuan 6 menuju aplikasi 3D interaktif.">
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

      <Section title="Roughness × metalness" description="Preset PBR sphere (tombol M); galeri 3 × 3 di belakangnya mengisi nilai di antaranya.">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-4 font-medium">Mode</th>
                <th className="py-2 pr-4 font-medium">Roughness</th>
                <th className="py-2 pr-4 font-medium">Metalness</th>
                <th className="py-2 font-medium">Karakter</th>
              </tr>
            </thead>
            <tbody>
              {PBR_TABLE.map(([mode, roughness, metalness, look]) => (
                <tr key={mode} className="border-b border-slate-800/60 last:border-0">
                  <td className="py-2 pr-4 text-slate-100">{mode}</td>
                  <td className="py-2 pr-4 font-mono text-xs text-indigo-300">{roughness}</td>
                  <td className="py-2 pr-4 font-mono text-xs text-indigo-300">{metalness}</td>
                  <td className="py-2 text-slate-400">{look}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Hover vs click" description="Dua state berbeda untuk dua konsep berbeda.">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-4 font-medium">Aspek</th>
                <th className="py-2 pr-4 font-medium">Hover</th>
                <th className="py-2 font-medium">Click / selected</th>
              </tr>
            </thead>
            <tbody>
              {INTERACTION.map(([aspect, hover, click]) => (
                <tr key={aspect} className="border-b border-slate-800/60 last:border-0">
                  <td className="py-2 pr-4 text-slate-100">{aspect}</td>
                  <td className="py-2 pr-4 text-slate-400">{hover}</td>
                  <td className="py-2 text-slate-400">{click}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Catatan konsep" description="Jawaban ringkas untuk pertanyaan pemahaman dan analisis pada modul.">
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
