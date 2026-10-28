import Image from "next/image";
import Section from "@/components/ui/Section";
import { asset } from "@/lib/asset";
import stats from "@/public/praktikum-9/stats.json";

const WORKFLOW: [string, string][] = [
  ["Reference / Ide", "crate kargo sci-fi: kotak tebal, panel recessed, tutup terangkat, handle, ventilasi, kaki"],
  ["Primitive", "Cube untuk body, handle, slat, foot; Plane untuk panel samping"],
  ["Blockout", "proporsi 4 × 3 × 2.4 m dari S X 2 / Y 1.5 / Z 1.2, belum ada detail"],
  ["Transform", "G/R/S dengan axis constraint dan input numerik, Ctrl+A → Scale pada body"],
  ["Edit Mode", "Face Select untuk panel, Edge Select untuk loop dan sudut, Vertex Select untuk geser loop"],
  ["Extrude + Inset", "panel depan/belakang recessed, tutup terangkat dengan recess, handle U"],
  ["Loop Cut + Bevel", "panel samping dibagi tiga strip, rib di tengah, sudut tegak body di-bevel"],
  ["Modifier", "Bevel, Solidify, Mirror, Array, Subdivision Surface — semua masih bisa diedit"],
  ["Topology Cleanup", "Merge by Distance + Recalculate Normal pada seluruh part"],
  ["Final Inspection", "scale (1,1,1), normal konsisten, non-manifold diperiksa, Outliner rapi"],
  ["3D Asset", "P09_SciFi_Crate.blend, siap untuk UV dan material di Pertemuan 10"],
];

const SCREENSHOTS: [string, string, string][] = [
  ["stage-1.png", "1. Primitive / Blockout", "screenshot_blockout.png"],
  ["stage-2.png", "2. Extrude + Inset", ""],
  ["stage-3.png", "3. Loop Cut / Bevel", "screenshot_modeling.png"],
  ["stage-4.png", "4. Modifier", ""],
  ["stage-5.png", "5. Final Asset", "screenshot_final.png"],
  ["topology.png", "Inspeksi topology (wireframe)", ""],
];

const OUTLINER = `Scene Collection
├── SciFi_Crate (collection)
│   └── SciFi_Crate (Empty, root asset)
│       ├── Crate_Body      Bevel
│       ├── Side_Panel      Solidify → Mirror (X, terhadap root)
│       ├── Handle          Bevel → Subdivision Surface
│       ├── Vent_Slats      Array (6) → Mirror (Y, terhadap root)
│       ├── Foot_FL         Bevel
│       ├── Foot_FR         Bevel   ┐
│       ├── Foot_BL         Bevel   ├ Shift+D dari Foot_FL
│       └── Foot_BR         Bevel   ┘
├── Eksperimen (collection)  Exp1_… sampai Exp12_…
└── Studio (collection)      Camera_Crate, Camera_Eksperimen, Key_Light, Ground`;

const OPERATIONS: [string, string, string][] = [
  ["Add primitive", "Shift + A", "Cube (body, handle, slat, foot), Plane (panel samping)"],
  ["Rename", "F2", "semua object diberi nama Crate_Body, Side_Panel, Handle, Vent_Slats, Foot_*"],
  ["Scale + axis + numerik", "S X 2, S Y 1.5, S Z 1.2", "blockout body; slat S X 2.4 / Y 0.06 / Z 0.1"],
  ["Apply Scale", "Ctrl + A → Scale", "Crate_Body: scale (2, 1.5, 1.2) → (1, 1, 1) sebelum Bevel"],
  ["Move numerik", "G X −1.6, G Y −1.15", "posisi foot, handle, panel, slat (tepat 0.01 di luar body)"],
  ["Duplicate", "Shift + D", "Foot_FL → Foot_FR, Foot_BL, Foot_BR (data terpisah, bukan Alt+D)"],
  ["Extrude", "E", "panel recessed, tutup naik 0.12, recess tutup, 5× pada handle, rib panel samping"],
  ["Inset", "I", "front/back 0.18, tutup 0.2 lalu 0.15, strip tengah panel samping 0.06"],
  ["Loop Cut", "Ctrl + R (2 cut)", "panel samping dibagi tiga strip, loop digeser ke y = ±0.35"],
  ["Bevel (edit)", "Ctrl + B, 3 segment", "empat sudut tegak Crate_Body, offset 0.1"],
  ["Knife", "K", "empat sudut panel samping dipotong diagonal 0.25 (tidak bisa dengan Loop Cut)"],
  ["Merge by Distance", "M → By Distance", "semua part, jarak 0.0001"],
  ["Recalculate Normal", "A, Shift + N", "semua part"],
];

const MODIFIERS: [string, string, string][] = [
  ["Crate_Body", "Bevel", "width 0.025, 2 segment, limit Angle 30° — menangkap semua hard edge sisa"],
  ["Side_Panel", "Solidify → Mirror", "tebal 0.08 ke arah normal, lalu dicerminkan di sumbu X terhadap root"],
  ["Vent_Slats", "Array → Mirror", "6 slat, relative offset Z 2.2, lalu dicerminkan ke panel belakang"],
  ["Handle", "Bevel → Subdivision Surface", "bevel 0.02 memberi supporting edge sehingga Subdivision level 2 membulatkan tanpa meleleh"],
  ["Foot_* (4)", "Bevel", "width 0.03, 2 segment"],
];

const CHALLENGES: [string, string][] = [
  ["A — Symmetric Prop", "Side_Panel hanya dimodelkan di sisi −X; Mirror Modifier terhadap root SciFi_Crate memunculkan panel kanan. Vent_Slats juga dicerminkan dari depan ke belakang."],
  ["B — Repeated Mechanical Detail", "Satu slat + Array Modifier (count 6) membentuk grille ventilasi. Mengubah jumlah atau jarak cukup satu angka."],
  ["C — Thin Panel + Solidify", "Side_Panel berawal dari Plane, siluetnya dibentuk di Edit Mode (Loop Cut, Inset, Extrude, Knife), lalu diberi tebal 0.08 oleh Solidify."],
  ["D — Advanced Paneling", "Empat panel: recessed depan, recessed belakang, tutup terangkat dengan recess di atasnya, dan rib terangkat di panel samping (Loop Cut + Inset + Extrude)."],
  ["E — Knife Detail", "Empat sudut panel samping dipotong diagonal dengan Knife. Topology diperiksa: dua face tengah menjadi n-gon datar (5 sisi), tanpa normal terbalik."],
  ["F — Controlled Curved Form", "Handle memakai Bevel → Subdivision Surface: pegangan membulat, tetapi bentuk U-nya tetap tegas karena supporting edge dari Bevel."],
  ["G — Modular Asset", "Asset dipisah menjadi body, panel, handle, detail (slat), dan support (4 foot), semua di bawah Empty SciFi_Crate dengan nama rapi di Outliner."],
];

const exp = stats;
const EXPERIMENTS: [string, string, string][] = [
  [
    "1 — Object vs Edit Transform",
    `Cube A (Object Mode, S X 2) scale = (${exp.exp1.A_scale.join(", ")}); Cube B (Edit Mode, A, S X 2) scale = (${exp.exp1.B_scale.join(", ")}).`,
    "Bentuknya sama, state-nya berbeda. A menyimpan perubahan di transform object (mesh tetap kubus 1 × 1 × 1), B mengubah posisi vertex sehingga scale tetap 1. Operasi berikutnya (Bevel, Solidify, texture) memakai ukuran mesh, jadi A akan menghasilkan bevel yang terdistorsi sampai Apply Scale.",
  ],
  [
    "2 — Apply Scale dan Bevel",
    "Cube S X 3, S Z 0.5, Bevel 0.15 / 3 segment: sebelum Apply Scale bevel memanjang di X dan gepeng di Z; sesudah Ctrl+A → Scale bevel sama lebar di semua sisi.",
    "Bevel dihitung di ruang mesh lalu ikut diskalakan oleh object scale (3, 1, 0.5). Apply Scale memindahkan skala ke vertex, sehingga 0.15 benar-benar 0.15 di semua arah.",
  ],
  [
    "3 — Extrude vs Move",
    `G pada face atas: ${exp.exp3.Exp3_Move_G.verts} vertex / ${exp.exp3.Exp3_Move_G.faces} face. E pada face atas: ${exp.exp3.Exp3_Extrude_E.verts} vertex / ${exp.exp3.Exp3_Extrude_E.faces} face.`,
    "G hanya menggeser vertex yang ada — kubus memanjang, dinding sampingnya ikut meregang. E menduplikasi face dan membuat empat face dinding baru, sehingga kubus asli tetap dan muncul segmen baru yang bisa diedit sendiri.",
  ],
  [
    "4 — Inset + Extrude",
    `Jumlah face: ${exp.exp4.faces[0]} → ${exp.exp4.faces[1]} setelah Inset → ${exp.exp4.faces[2]} setelah Extrude ke dalam.`,
    "Inset membuat face dalam beserta cincin border (frame panel); Extrude ke dalam membuat dinding kedalaman. Bersama-sama menghasilkan panel recessed — pola yang dipakai di panel depan/belakang crate.",
  ],
  [
    "5 — Loop Cut",
    `1 loop: ${exp.exp5["1"].verts} vertex / ${exp.exp5["1"].faces} face. 3 loop: ${exp.exp5["3"].verts} vertex / ${exp.exp5["3"].faces} face.`,
    "Setiap loop menambah satu cincin vertex mengelilingi strip quad. Tiga loop memberi lebih banyak titik kontrol, tetapi juga lebih banyak geometry yang harus dijaga; loop sebaiknya ditambah hanya di tempat yang butuh detail.",
  ],
  [
    "6 — Bevel Segment",
    `Bevel 0.2 pada kubus: 1 segment ${exp.exp6["1"]} face, 3 segment ${exp.exp6["3"]} face, 6 segment ${exp.exp6["6"]} face.`,
    "1 segment = chamfer tajam, 3 = membulat halus, 6 = nyaris sama dengan 3 dari jarak normal tetapi geometry tiga kali lipat. Asset final memakai 2–3 segment.",
  ],
  [
    "7 — Modifier Stack",
    `Mirror → Bevel: ${exp.exp7.Exp7_Mirror_then_Bevel.faces} face, satu balok utuh. Bevel → Mirror: ${exp.exp7.Exp7_Bevel_then_Mirror.faces} face, dua balok dengan alur di garis simetri.`,
    "Hasilnya berubah. Bevel sebelum Mirror ikut membulatkan edge di sambungan, sehingga muncul celah di tengah. Mirror dulu lalu Bevel membevel bentuk gabungan — yang biasanya diinginkan.",
  ],
  [
    "8 — Duplicate vs Array",
    `Shift+D: ${exp.exp8.duplicate.objects} object, ${exp.exp8.duplicate.meshes} mesh terpisah. Array: ${exp.exp8.array.objects} object, count ${exp.exp8.array.count}, ${exp.exp8.array.faces} face.`,
    "Duplicate cocok untuk bagian yang posisinya bebas (foot di empat sudut). Array lebih mudah diubah (satu angka), selalu konsisten jaraknya, dan non-destructive — dipakai untuk slat ventilasi.",
  ],
  [
    "9 — Snapping",
    `Diletakkan dengan mata: celah ${(exp.exp9.ByEye[0] * 1000).toFixed(0)} mm di X dan ${(exp.exp9.ByEye[1] * 1000).toFixed(0)} mm di Y. Dengan snap ke vertex: ${exp.exp9.Snapped[0]} / ${exp.exp9.Snapped[1]}.`,
    "Selisih beberapa milimeter tidak terlihat di viewport tetapi menimbulkan celah atau z-fighting. Snapping bermanfaat saat bagian harus menempel tepat: panel ke body, kaki ke lantai, modul ke modul.",
  ],
  [
    "10 — Proportional Editing",
    `Vertex tengah grid 12 × 12 dinaikkan 0.8: O OFF menggerakkan ${exp.exp10.movedVertsOff} vertex (paku), O ON radius 1.5 Smooth menggerakkan ${exp.exp10.movedVertsOn} vertex (bukit).`,
    "Proportional Editing ikut menggeser vertex di sekitar dengan falloff, cocok untuk bentuk organik. Untuk hard-surface biasanya dimatikan agar edge tetap tegas.",
  ],
  [
    "11 — Merge by Distance",
    `Kubus dengan seluruh geometry terduplikasi: ${exp.exp11.before} vertex → ${exp.exp11.after} vertex.`,
    "Vertex ganda di posisi sama tidak terlihat, tetapi membuat shading pecah, bevel gagal, dan UV terpisah. Menggabungkannya adalah cleanup karena bentuk tidak berubah — hanya data yang tidak perlu dibuang.",
  ],
  [
    "12 — Recalculate Normal",
    `Tiga face sengaja dibalik: ${exp.exp12.inwardBefore} face menghadap ke dalam → ${exp.exp12.inwardAfter} setelah A, Shift+N.`,
    "Di Face Orientation face terbalik tampak merah. Recalculate Normal menyamakan arah semua face ke luar, penting untuk shading, backface culling, Solidify, dan ekspor ke Three.js.",
  ],
];

const ANALYSIS: [string, string][] = [
  [
    "A — Object Mode vs Edit Mode",
    "Cube A punya scale (2, 1, 1) dengan mesh kubus satuan; Cube B punya scale (1, 1, 1) dengan vertex yang sudah melebar. Secara visual sama, tetapi A membawa transform non-uniform yang memengaruhi Bevel, Solidify, Array relative offset, dan UV sampai di-Apply.",
  ],
  [
    "B — Extrude",
    "G hanya memindahkan vertex face yang sama sehingga face tetangga meregang dan jumlah geometry tetap. E membuat salinan face beserta dinding baru di antara posisi lama dan baru (4 → 10 face pada eksperimen 3). Bentuk dasar tetap, dan segmen baru bisa dibentuk tanpa merusak bagian lama.",
  ],
  [
    "C — Bevel",
    "Di dunia nyata tidak ada edge yang benar-benar tajam; bevel kecil menangkap highlight di sudut sehingga bentuk terbaca dan terasa solid. Tanpa bevel, sudut crate terlihat seperti kertas dan siluetnya datar.",
  ],
  [
    "D — Modifier",
    "Selama desain, jumlah slat, tebal panel, atau lebar bevel masih sering berubah. Sebagai modifier, cukup satu angka diubah dan base mesh tetap ringan (Vent_Slats: 6 face base, 72 face hasil). Apply hanya dilakukan bila memang perlu, misalnya sebelum edit manual pada hasilnya.",
  ],
  [
    "E — Topology",
    "Setiap loop menambah vertex yang harus dijaga saat edit, UV, dan bevel, dan bisa membuat shading tidak rata. Loop sebaiknya punya tujuan: memisahkan panel, menahan bevel, atau memberi supporting edge — seperti dua loop di panel samping yang menjadi batas rib.",
  ],
  [
    "F — Primitive Decomposition",
    "Robot head: kepala dari Cube yang di-blockout, visor dari face depan yang di-Inset + Extrude ke dalam, antena dari Cylinder, telinga/speaker dari Cylinder pendek dengan Array untuk grille, rahang dari loop cut lalu extrude. Setiap bagian dipisah dan diberi nama, satu sisi dimodelkan lalu Mirror.",
  ],
  [
    "G — Apply Scale",
    "Operasi seperti Bevel, Solidify, dan Inset bekerja di ruang mesh lalu diskalakan oleh object scale. Dengan scale (3, 1, 0.5), lebar bevel 0.15 menjadi 0.45 di X dan 0.075 di Z (eksperimen 2). Apply Scale menjadikan scale (1, 1, 1) sehingga ukuran yang dimasukkan sesuai yang dihasilkan.",
  ],
  [
    "H — Pipeline",
    "UV unwrap mengikuti edge dan face: quad yang rapi menghasilkan seam yang jelas dan island yang mudah di-pack, sedangkan vertex ganda dan normal terbalik membuat UV terpecah dan texture terbalik. Scale yang sudah di-apply membuat texel density seragam di semua part.",
  ],
];

const UNDERSTANDING: [string, string][] = [
  ["Fungsi Blender dalam graphics pipeline?", "Membuat asset: modeling, UV, material, lighting, rendering, lalu ekspor (misalnya GLB) ke engine seperti Three.js."],
  ["Fungsi 3D Viewport?", "Area kerja utama untuk melihat, memilih, dan mengedit object dalam ruang 3D."],
  ["Fungsi Outliner?", "Menampilkan struktur scene — collection, object, hierarchy parent-child — untuk rename, select, dan hide."],
  ["Fungsi Properties Editor di praktikum ini?", "Melihat/mengubah transform (scale setelah Apply), menambah dan mengatur Modifier, serta Object data."],
  ["Fungsi MMB?", "Drag MMB memutar (orbit) view; scroll untuk zoom."],
  ["Fungsi Shift + MMB?", "Pan — menggeser view tanpa memutar."],
  ["Fungsi Numpad 1, 3, 7?", "View Front, Right, dan Top (Ctrl untuk sisi sebaliknya)."],
  ["Fungsi Numpad 5?", "Menukar Perspective ↔ Orthographic."],
  ["Fungsi Numpad . ?", "Frame Selected — memusatkan view ke object/komponen terpilih."],
  ["Object Mode vs Edit Mode?", "Object Mode mengubah object utuh (transform, modifier); Edit Mode mengubah vertex, edge, face di dalam mesh."],
  ["Apa itu vertex?", "Titik di ruang 3D, satuan terkecil mesh."],
  ["Apa itu edge?", "Garis yang menghubungkan dua vertex."],
  ["Apa itu face?", "Permukaan yang dibatasi tiga edge atau lebih; yang dirender."],
  ["Apa itu mesh?", "Kumpulan vertex, edge, dan face yang membentuk object."],
  ["Apa itu topology?", "Susunan dan aliran vertex/edge/face — bagaimana mesh terhubung, bukan hanya bentuknya."],
  ["Mengapa quad nyaman untuk loop-based editing?", "Edge loop dan ring hanya bisa mengalir lurus melewati quad; tri dan n-gon menghentikan loop."],
  ["Fungsi G, R, S?", "Grab/move, Rotate, Scale."],
  ["Keuntungan axis constraint?", "Transform terkunci pada satu sumbu (X/Y/Z) sehingga bagian tidak bergeser ke arah lain."],
  ["Mengapa transform numerik berguna?", "Ukuran dan posisi tepat dan bisa diulang (S X 2, G Z 0.5), bukan perkiraan mouse."],
  ["Fungsi Shift + A?", "Menu Add: primitive mesh, light, camera, empty."],
  ["Fungsi Shift + D?", "Duplicate dengan data terpisah, langsung dalam mode Move."],
  ["Fungsi Apply Scale?", "Memindahkan scale object ke vertex sehingga scale menjadi (1, 1, 1)."],
  ["Mengapa Apply Scale penting sebelum Bevel?", "Agar lebar bevel sama di semua sumbu; tanpa itu bevel ikut terdistorsi oleh scale non-uniform."],
  ["Fungsi snapping?", "Menempelkan elemen tepat ke vertex, edge, face, atau grid target."],
  ["Fungsi Proportional Editing?", "Transform ikut memengaruhi elemen sekitar dengan falloff sesuai radius."],
  ["Fungsi Extrude?", "Menarik elemen keluar sambil membuat geometry penghubung baru."],
  ["Extrude vs Move?", "Move menggeser elemen yang ada; Extrude membuat elemen baru dan dinding di antaranya."],
  ["Fungsi Inset?", "Membuat face baru di dalam face dengan cincin border di sekelilingnya."],
  ["Manfaat Inset + Extrude?", "Membuat panel recessed atau raised dengan frame yang rapi."],
  ["Fungsi Loop Cut?", "Menambah edge loop melingkari ring quad."],
  ["Mengapa Loop Cut cocok pada quad?", "Loop bisa terus mengalir dari quad ke quad; pada tri/n-gon loop berhenti atau bercabang."],
  ["Fungsi Bevel?", "Memotong edge/vertex menjadi chamfer atau lengkung."],
  ["Mengapa bevel membantu visual hard-surface?", "Sudut menangkap highlight sehingga bentuk terbaca solid dan realistis."],
  ["Fungsi Merge?", "Menggabungkan beberapa vertex terpilih menjadi satu (at center, at last, dll.)."],
  ["Fungsi Merge by Distance?", "Menggabungkan vertex yang jaraknya di bawah ambang — menghapus vertex ganda."],
  ["Fungsi Fill?", "Membuat face/edge dari elemen terpilih untuk menutup lubang."],
  ["Fungsi Knife?", "Memotong edge baru secara bebas melintasi face."],
  ["Fungsi Recalculate Normal?", "Menyeragamkan arah normal face ke luar mesh."],
  ["Apa itu Modifier?", "Operasi otomatis yang diterapkan pada object tanpa mengubah base mesh."],
  ["Mengapa Modifier non-destructive?", "Base mesh tetap utuh; modifier bisa diubah, diurutkan ulang, dimatikan, atau dihapus kapan saja."],
  ["Fungsi Bevel Modifier?", "Bevel otomatis berdasarkan angle, weight, atau vertex group."],
  ["Fungsi Mirror Modifier?", "Mencerminkan mesh terhadap sumbu atau object, untuk model simetris."],
  ["Fungsi Array Modifier?", "Mengulang mesh dengan offset tertentu."],
  ["Fungsi Solidify Modifier?", "Memberi ketebalan pada permukaan tipis."],
  ["Fungsi Subdivision Surface?", "Menghaluskan mesh dengan membagi face dan membulatkan bentuk."],
  ["Mengapa urutan Modifier Stack penting?", "Setiap modifier bekerja pada hasil modifier sebelumnya — Mirror→Bevel ≠ Bevel→Mirror."],
  ["Apa itu blockout?", "Bentuk kasar dari primitive untuk mengunci proporsi dan siluet."],
  ["Mengapa detail kecil jangan terlalu awal?", "Proporsi masih berubah; detail awal harus dikerjakan ulang dan memperberat edit."],
  ["Apa itu topology cleanup?", "Membuang vertex ganda, menyeragamkan normal, menghapus geometry tak perlu, merapikan n-gon bermasalah."],
  ["Mengapa asset diperiksa sebelum UV?", "Kesalahan geometry ikut terbawa ke UV, texture, dan ekspor, dan lebih mahal diperbaiki nanti."],
];

const stage5 = stats.stages[4];
const nonManifold = Object.entries(stats.topology).filter(([, t]) => t.nonManifoldEdges > 0);

const CHECKLIST = [
  "File P09_SciFi_Crate.blend tersedia dan dapat dibuka (Blender 4.2 LTS)",
  "Nama object rapi: Crate_Body, Side_Panel, Handle, Vent_Slats, Foot_FL/FR/BL/BR di bawah SciFi_Crate",
  "Silhouette jelas dari Front, Right, Top, dan 3/4",
  "Primitive/blockout terdokumentasi (tahap 1)",
  "Object Mode: scale numerik dengan axis constraint, Apply Scale, Duplicate",
  "Edit Mode dengan Vertex/Edge/Face selection",
  "Extrude, Inset, Loop Cut, Bevel, dan Knife digunakan",
  "Lima jenis Modifier: Bevel, Solidify, Mirror, Array, Subdivision Surface",
  "Apply Scale digunakan pada Crate_Body dan dibuktikan pada eksperimen 1–2",
  `Topology diperiksa: ${stage5.parts.reduce((s, p) => s + p.evaluated.faces, 0)} face final, normal 0 terbalik di semua part`,
  "Merge by Distance + Recalculate Normal pada seluruh part",
  "Detail tidak berlebihan: base mesh 197 face, sisanya dari modifier yang masih bisa diatur",
  "Tujuh challenge: A, B, C, D, E, F, G",
  "Screenshot proses (5 tahap) dan screenshot final tersedia",
  "12 eksperimen wajib dikerjakan di collection Eksperimen",
  "Asset siap dilanjutkan ke UV/material",
];

/** A wide table with a heading row; every pertemuan page uses the same look. */
function Table({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead>
          <tr className="border-b border-slate-800 text-xs uppercase tracking-wide text-slate-500">
            {head.map((cell) => (
              <th key={cell} className="py-2 pr-4 font-medium">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row[0]} className="border-b border-slate-800/60 align-top last:border-0">
              {row.map((cell, index) => (
                <td
                  key={index}
                  className={`py-2 pr-4 ${index === 0 ? "text-slate-100" : index === 1 ? "font-mono text-xs text-indigo-300" : "text-slate-400"}`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function InfoSection() {
  return (
    <div className="space-y-6">
      <Section title="Workflow modeling" description="Reference → Primitive → … → 3D Asset, seperti alur modul.">
        <ol className="space-y-2">
          {WORKFLOW.map(([stage, detail], index) => (
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
        title="Dokumentasi proses"
        description="Render Workbench (solid + cavity) dari Camera_Crate di akhir setiap tahap — dihasilkan oleh script Blender yang sama."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SCREENSHOTS.map(([file, caption, submission]) => (
            <figure key={file} className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950/40">
              <Image
                src={asset(`/praktikum-9/${file}`)}
                alt={caption}
                width={1280}
                height={800}
                sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                className="h-auto w-full"
              />
              <figcaption className="px-3 py-2 text-xs text-slate-300">
                {caption}
                {submission ? <span className="text-slate-500"> · {submission}</span> : null}
              </figcaption>
            </figure>
          ))}
        </div>
      </Section>

      <Section title="Struktur Outliner" description="Challenge G — asset dipecah menjadi part yang logis dengan nama jelas.">
        <div className="overflow-x-auto">
          <pre className="font-mono text-xs leading-relaxed text-slate-300">{OUTLINER}</pre>
        </div>
      </Section>

      <Section title="Operasi modeling" description="Setiap operasi wajib, shortcut-nya, dan bagian crate yang memakainya.">
        <Table head={["Operasi", "Shortcut", "Dipakai pada"]} rows={OPERATIONS} />
      </Section>

      <Section title="Modifier stack" description="Urutan dari atas ke bawah, seperti di Properties → Modifier.">
        <Table head={["Object", "Stack", "Pengaturan"]} rows={MODIFIERS} />
      </Section>

      <Section title="Cleanup & inspeksi akhir" description="Dihitung oleh script dari mesh tahap 5.">
        <ul className="space-y-1.5 text-sm text-slate-300">
          <li>
            <span className="text-emerald-400">✓</span> Merge by Distance (0.0001):{" "}
            {Object.values(stats.cleanup).reduce((a, b) => a + b, 0)} vertex ganda — tidak ada geometry ganda yang
            tersisa dari extrude.
          </li>
          <li>
            <span className="text-emerald-400">✓</span> Recalculate Normal, lalu konsistensi arah diperiksa per edge:
            0 edge dengan winding terbalik di semua part.
          </li>
          <li>
            <span className="text-emerald-400">✓</span> Scale semua part (1, 1, 1):{" "}
            {stats.nonUnitScale.length === 0 ? "tidak ada object dengan scale non-uniform" : stats.nonUnitScale.join(", ")}.
          </li>
          <li>
            <span className="text-emerald-400">✓</span> Non-manifold edge:{" "}
            {nonManifold.map(([name, t]) => `${name} ${t.nonManifoldEdges}`).join(", ")} — tepi terbuka Plane yang memang
            tipis; Solidify menutupnya. Part lain 0.
          </li>
          <li>
            <span className="text-emerald-400">✓</span> N-gon hanya di face datar: dua face panel samping hasil Knife
            dan sudut bevel body — tidak dideformasi, jadi shading tetap rata.
          </li>
        </ul>
      </Section>

      <Section title="12 eksperimen wajib" description="Object eksperimen ada di collection Eksperimen, terpisah dari asset utama.">
        <figure className="mb-5 overflow-hidden rounded-xl border border-slate-800">
          <Image
            src={asset("/praktikum-9/experiments.png")}
            alt="Object eksperimen 1 sampai 12 berjajar"
            width={1280}
            height={800}
            sizes="(min-width: 1024px) 800px, 100vw"
            className="h-auto w-full"
          />
          <figcaption className="px-3 py-2 text-xs text-slate-400">
            Baris depan: Exp1 A (Object scale), Exp2 sebelum Apply Scale, Exp6 (1/3/6 segment), Exp11. Baris
            tengah: Exp1 B (Edit scale), Exp2 sesudah Apply Scale, Exp7 (Mirror→Bevel, Bevel→Mirror), Exp12. Baris
            belakang: Exp3 (G/E), Exp4, Exp5 (1/3 loop), Exp8 (Shift+D/Array), Exp9, Exp10 (O off/on).
          </figcaption>
        </figure>
        <dl className="space-y-4">
          {EXPERIMENTS.map(([title, result, explanation]) => (
            <div key={title}>
              <dt className="text-sm font-medium text-slate-100">Eksperimen {title}</dt>
              <dd className="mt-1 text-sm text-indigo-200">{result}</dd>
              <dd className="mt-1 text-sm leading-relaxed text-slate-400">{explanation}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section title="Challenge yang dikerjakan (7)" description="Modul meminta minimal dua.">
        <dl className="space-y-3">
          {CHALLENGES.map(([title, detail]) => (
            <div key={title}>
              <dt className="text-sm font-medium text-slate-100">{title}</dt>
              <dd className="mt-1 text-sm leading-relaxed text-slate-400">{detail}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section title="Pertanyaan analisis" description="Bagian 101 modul.">
        <dl className="space-y-4">
          {ANALYSIS.map(([question, answer]) => (
            <div key={question}>
              <dt className="text-sm font-medium text-slate-100">{question}</dt>
              <dd className="mt-1 text-sm leading-relaxed text-slate-400">{answer}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section title="Pertanyaan pemahaman" description="Bagian 100 modul — 50 pertanyaan, jawaban singkat.">
        <details className="group">
          <summary className="cursor-pointer text-sm text-indigo-300 hover:text-indigo-200">Tampilkan 50 jawaban</summary>
          <ol className="mt-4 grid gap-x-8 gap-y-3 md:grid-cols-2">
            {UNDERSTANDING.map(([question, answer], index) => (
              <li key={question} className="text-sm">
                <span className="font-medium text-slate-100">
                  {index + 1}. {question}
                </span>
                <span className="block text-slate-400">{answer}</span>
              </li>
            ))}
          </ol>
        </details>
      </Section>

      <Section title="Checklist pengumpulan">
        <ul className="grid gap-2 sm:grid-cols-2">
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
