import Section from "@/components/ui/Section";

const OBJECTS: [string, string, string, string][] = [
  ["Ground", "PlaneGeometry 60×60", "MeshStandardMaterial", "rotation.x = −90°, receiveShadow"],
  ["Box", "BoxGeometry", "MeshStandardMaterial", "scale (1.2, 1.5, 1.2) non-uniform, berputar"],
  ["Sphere", "SphereGeometry", "MeshPhongMaterial", "memantul naik-turun (|sin t|)"],
  ["TorusKnot", "TorusKnotGeometry", "MeshStandardMaterial (metalness)", "challenge: geometry tambahan"],
  ["Cone", "ConeGeometry (6 sisi)", "MeshLambertMaterial + flatShading", "challenge: geometry tambahan"],
  ["Galeri ×4", "SphereGeometry", "Basic · Lambert · Phong · Standard", "challenge: material gallery"],
];

/** What Pertemuan 2-5 wrote by hand, and what Three.js now does for us. */
const MANUAL_VS_THREE: [string, string, string][] = [
  ["Upload vertex", "createBuffer + bufferData + vertexAttribPointer", "new BoxGeometry(...)"],
  ["Shader", "Tulis GLSL vertex & fragment sendiri", "Dipilih otomatis dari jenis material"],
  ["Model Matrix", "Mat4.multiply(T, R, S) manual", "mesh.position / rotation / scale"],
  ["View & Projection", "Mat4.lookAt + Mat4.perspective", "PerspectiveCamera + camera.lookAt()"],
  ["Lighting", "Rumus ambient/diffuse/specular di shader", "AmbientLight + DirectionalLight + material"],
  ["Normal Matrix", "normalMatrixFromMat4 (inverse-transpose)", "Dihitung renderer per object"],
  ["Depth test", "gl.enable(DEPTH_TEST) + clear depth", "Aktif secara default"],
  ["Shadow", "Belum pernah dibuat", "castShadow / receiveShadow + shadow map"],
];

const SHADOW_STEPS = [
  ["Shadow pass", "renderer menggambar scene dari sudut pandang DirectionalLight dan menyimpan kedalamannya ke shadow map (tekstur depth)"],
  ["Main pass", "untuk setiap fragment, posisinya diubah ke ruang lampu lalu kedalamannya dibandingkan dengan isi shadow map"],
  ["Hasil", "lebih jauh dari nilai di shadow map berarti ada object lain yang lebih dulu kena cahaya, sehingga fragment itu ada di bayangan"],
];

const CHECKLIST = [
  "Project memakai Three.js (dipin ke r182, lihat catatan di bawah)",
  "Scene, background, PerspectiveCamera, dan WebGLRenderer dengan antialias",
  "Pixel ratio dibatasi Math.min(devicePixelRatio, 2)",
  "BoxGeometry, SphereGeometry, dan PlaneGeometry sebagai ground",
  "Lima jenis material, empat di antaranya merespons cahaya",
  "Transformasi position, rotation, dan scale diterapkan pada object",
  "AmbientLight dan DirectionalLight",
  "DirectionalLight castShadow, delapan object castShadow, ground receiveShadow",
  "Animation loop requestAnimationFrame + delta time dari THREE.Clock",
  "Resize memperbarui ukuran renderer, aspect camera, dan projection matrix",
  "HUD scene information",
  "Challenge — tambah 2 geometry (TorusKnot, Cone)",
  "Challenge — material gallery (Basic, Lambert, Phong, Standard)",
  "Challenge — OrthographicCamera (C)",
  "Challenge — light animation (L)",
  "Challenge — shadow quality 256 / 1024 / 2048 (G)",
  "Challenge — scene information (FPS, mesh, draw calls, triangles)",
  "Challenge — toggle animation (Space)",
  "Challenge — object control (O, Arrow, Q/E, -/=)",
  "Console tanpa error maupun warning",
];

const NOTES: [string, string][] = [
  [
    "Apa yang sebenarnya dilakukan Three.js?",
    "Three.js tetap memakai WebGL di baliknya. Saat renderer.render(scene, camera) dipanggil, ia menelusuri scene graph, mengunggah geometry ke buffer GPU, memilih dan meng-compile shader sesuai material, menghitung Model, View, Projection, dan Normal Matrix, lalu mengeluarkan satu draw call (gl.drawElements atau gl.drawArrays) untuk tiap mesh. Itu semua adalah langkah yang kita tulis sendiri di Pertemuan 2–5. Bedanya, sekarang kita cukup mendeskripsikan isi scene, bukan cara menggambarnya.",
  ],
  [
    "Kenapa mesh = geometry + material?",
    "Geometry adalah bentuk (posisi vertex, normal, UV). Material adalah cara permukaan itu diwarnai (shader yang dipakai dan parameternya). Keduanya dipisah supaya bisa dipakai ulang secara mandiri: galeri material di scene ini memakai geometry bola yang identik, dan yang membuat tampilannya berbeda hanyalah materialnya.",
  ],
  [
    "Material mana yang merespons cahaya?",
    "MeshBasicMaterial tidak menghitung cahaya sama sekali; warnanya tampil persis seperti yang diberikan, sehingga bola Basic di galeri terlihat datar. Lambert hanya menghitung diffuse, tanpa specular highlight. Phong menambahkan specular highlight dengan parameter shininess. Standard memakai model physically based (roughness dan metalness), paling realistis tapi paling mahal dihitung.",
  ],
  [
    "Kenapa bayangan perlu diaktifkan di tiga tempat?",
    "renderer.shadowMap.enabled menyalakan fitur shadow secara global. light.castShadow membuat lampu itu menghasilkan shadow map. mesh.castShadow menentukan object mana yang ikut digambar ke shadow map, dan mesh.receiveShadow menentukan object mana yang membandingkan dirinya dengan shadow map. Semua object di sini cast sekaligus receive, sehingga bola yang dibesarkan bisa membayangi bola galeri di depannya.",
  ],
  [
    "Apa itu shadow camera bounds dan shadow acne?",
    "DirectionalLight membuat shadow map lewat kamera orthographic. Kotak kameranya (left/right/top/bottom) disetel ±8 unit agar pas dengan area scene. Kalau kotaknya terlalu besar, pixel shadow map tersebar ke area kosong dan bayangan jadi kasar. Shadow acne adalah garis-garis bayangan palsu di permukaan yang terkena cahaya, akibat permukaan membandingkan kedalaman dengan dirinya sendiri. shadow.bias dan shadow.normalBias menggeser perbandingan itu sedikit sehingga garis tersebut hilang.",
  ],
  [
    "Kenapa delta time memakai THREE.Clock?",
    "clock.getDelta() mengembalikan detik sejak pemanggilan sebelumnya. Semua kecepatan dikalikan nilai ini, sehingga object bergerak dengan kecepatan yang sama di layar 60 Hz maupun 144 Hz. Nilainya dibatasi maksimal 0,05 detik supaya object tidak melompat jauh ketika tab kembali aktif setelah lama di background.",
  ],
  [
    "Kenapa Three.js dipin ke r182?",
    "Mulai r183, konstruktor THREE.Clock mencetak peringatan deprecation dan menyarankan THREE.Timer. Modul mewajibkan THREE.Clock sekaligus Console yang bersih, dan dua syarat itu hanya bisa dipenuhi bersamaan di r182. Untuk alasan serupa, shadow map memakai PCFShadowMap, karena PCFSoftShadowMap sudah deprecated di r182 dan juga mencetak peringatan.",
  ],
  [
    "Apa yang terjadi saat browser di-resize?",
    "Tiga hal harus ikut berubah: ukuran drawing buffer (renderer.setSize), rasio lebar-tinggi kamera (camera.aspect), dan projection matrix (camera.updateProjectionMatrix). Tanpa langkah terakhir, aspect yang baru tidak pernah masuk ke matrix sehingga object tampak gepeng. Di layar potret, FOV vertikal juga diperlebar supaya lebar pandang horizontalnya tidak menyempit dan sisi scene tidak terpotong.",
  ],
  [
    "Kenapa draw calls bisa lebih sedikit dari jumlah mesh?",
    "Three.js melakukan frustum culling: mesh yang bounding sphere-nya berada di luar view frustum kamera tidak dikirim ke GPU sama sekali. Kalau jendela dipersempit sampai satu bola galeri keluar layar, angka draw calls di HUD turun dari 9 menjadi 8.",
  ],
];

export default function InfoSection() {
  return (
    <div className="space-y-6">
      <Section
        title="Object di dalam scene"
        description="Sembilan mesh, lima jenis material, dan satu scene graph."
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-4 font-medium">Object</th>
                <th className="py-2 pr-4 font-medium">Geometry</th>
                <th className="py-2 pr-4 font-medium">Material</th>
                <th className="py-2 font-medium">Keterangan</th>
              </tr>
            </thead>
            <tbody>
              {OBJECTS.map(([name, geometry, material, detail]) => (
                <tr key={name} className="border-b border-slate-800/60 last:border-0">
                  <td className="py-2 pr-4 text-slate-100">{name}</td>
                  <td className="py-2 pr-4 font-mono text-xs text-indigo-300">{geometry}</td>
                  <td className="py-2 pr-4 text-slate-300">{material}</td>
                  <td className="py-2 text-slate-400">{detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section
        title="Dari WebGL manual ke Three.js"
        description="Yang kita tulis sendiri di Pertemuan 2–5, dan yang sekarang diurus Three.js."
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-4 font-medium">Tahap</th>
                <th className="py-2 pr-4 font-medium">Pertemuan 2–5</th>
                <th className="py-2 font-medium">Three.js</th>
              </tr>
            </thead>
            <tbody>
              {MANUAL_VS_THREE.map(([stage, manual, three]) => (
                <tr key={stage} className="border-b border-slate-800/60 last:border-0">
                  <td className="py-2 pr-4 text-slate-100">{stage}</td>
                  <td className="py-2 pr-4 font-mono text-xs text-slate-400">{manual}</td>
                  <td className="py-2 font-mono text-xs text-indigo-300">{three}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section
        title="Cara shadow map bekerja"
        description="Dua kali menggambar scene setiap frame: sekali dari lampu, sekali dari kamera."
      >
        <ol className="space-y-2">
          {SHADOW_STEPS.map(([stage, detail], index) => (
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

      <Section title="Catatan konsep" description="Jawaban ringkas untuk konsep utama praktikum ini.">
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
