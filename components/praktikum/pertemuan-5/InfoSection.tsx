import Section from "@/components/ui/Section";

const PIPELINE = [
  ["Geometry", "CUBE_VERTICES — 36 vertex vec3, posisi tidak pernah berubah"],
  ["Position + Normal + UV", "tiga attribute per vertex; normal dipilih dari FLAT_NORMALS atau SMOOTH_NORMALS"],
  ["Vertex Shader", "memindahkan position ke world space, mentransformasi normal lewat Normal Matrix, menskalakan UV"],
  ["Interpolation", "world position, normal, dan UV diinterpolasi rasterizer di antara ketiga vertex tiap triangle"],
  ["Fragment — Texture Sampling", "texture(u_texture, v_texCoord) menghasilkan base color dari checkerboard"],
  ["Fragment — Ambient", "u_ambientStrength × texColor — cahaya dasar, tidak bergantung normal atau arah cahaya"],
  ["Fragment — Diffuse", "max(dot(N, L), 0) × lightColor × texColor — terang mengikuti sudut N terhadap L"],
  ["Fragment — Specular", "pow(max(dot(R, V), 0), shininess) × lightColor — highlight mengikuti arah pantulan"],
  ["Final Surface Color", "ambient + diffuse + specular"],
  ["Canvas", "hasil akhir yang tampil ke pengguna"],
];

const VERTEX_DATA: [string, string][] = [
  ["Position", "Posisi geometry dalam local space — sama untuk kedua mode shading, tidak pernah ditulis ulang"],
  ["Normal — FLAT", "Satu arah per face (FLAT_NORMALS); keenam vertex satu sisi membawa nilai yang identik"],
  ["Normal — SMOOTH", "Arah pusat-ke-sudut per vertex (SMOOTH_NORMALS); geometry sama persis, hanya buffer ini yang beda"],
  ["UV", "Koordinat 0..1 per face, dikalikan u_uvScale di vertex shader sebelum diinterpolasi dan disampling"],
];

const LIGHTING_TERMS: [string, string, string][] = [
  ["Ambient", "u_ambientStrength × texColor", "Dasar cahaya — tidak bergantung normal atau arah; sisi gelap tetap sedikit terlihat"],
  ["Diffuse", "max(dot(N, L), 0) × lightColor × texColor", "Terang mengikuti sudut antara permukaan dan arah datang cahaya"],
  ["Specular", "pow(max(dot(R, V), 0), shininess) × lightColor", "Highlight yang mengikuti arah pantulan relatif terhadap kamera"],
];

const FILTER_COMPARISON: [string, string, string][] = [
  ["Texel dipilih", "Satu texel terdekat", "Interpolasi bilinear antar texel"],
  ["Tampilan dari dekat", "Tajam, blok terlihat (pixelated)", "Halus, transisi warna menerus"],
  ["Cocok untuk", "Pixel art, gaya retro", "Permukaan dan foto pada umumnya"],
];

const WRAP_BEHAVIOR: [string, string][] = [
  ["REPEAT", "UV di luar 0..1 diulang dari awal — pattern checkerboard terlihat berulang mengikuti u_uvScale"],
  ["CLAMP_TO_EDGE", "UV di luar 0..1 dijepit ke texel tepi — area berulang itu jadi warna tepi yang memanjang rata"],
  ["MIRRORED_REPEAT", "Sama seperti REPEAT, tapi tiap pengulangan dicerminkan — sambungannya menyatu tanpa lompatan warna"],
];

const CHECKLIST = [
  "WebGL2 context dengan depth test aktif",
  "Cube 3D dari Pertemuan 4 dipakai ulang sebagai geometry dasar",
  "Position, normal, dan UV sebagai tiga vertex attribute terpisah",
  "Face normal (flat) dan alternatif smooth vertex normal, dapat ditukar saat runtime (F)",
  "Normal dinormalisasi di fragment shader sebelum dipakai pada dot product",
  "Normal Matrix (inverse-transpose) dipakai untuk mentransformasikan normal, bukan Model Matrix biasa",
  "Ambient, diffuse, dan specular lighting, digabung jadi satu warna akhir",
  "Point light position dan diffuse dihitung lewat dot(N, L)",
  "View direction, reflection direction, dan shininess untuk specular",
  "UV coordinate dikirim sebagai attribute dan diskalakan lewat u_uvScale",
  "Texture checkerboard dibuat programatik lewat canvas 2D, tanpa file eksternal",
  "Texture sampling di fragment shader, digabung dengan hasil lighting",
  "Filtering NEAREST dan LINEAR dapat dibandingkan langsung (T)",
  "Tiga wrapping mode — REPEAT, CLAMP_TO_EDGE, MIRRORED_REPEAT (G)",
  "Automatic cube rotation lewat Model Matrix, dengan Pause yang hanya membekukan rotasi",
  "State-based keyboard control untuk posisi lampu, UV scale, dan shininess, dengan deltaTime",
  "Event-based toggle untuk shading, filtering, wrapping, scale mode, dan reset",
  "HUD HTML menampilkan shading, filtering, wrapping, UV scale, shininess, dan posisi lampu",
  "Console tidak menunjukkan error pada penggunaan normal",
  "Challenge B — kontrol ambient strength interaktif (A / Z)",
  "Challenge D — toggle uniform/non-uniform scale (N) untuk menunjukkan fungsi Normal Matrix",
  "Challenge F — toggle ambient/diffuse/specular satu per satu (1 / 2 / 3)",
];

const NOTES: [string, string][] = [
  [
    "Apa fungsi normal dalam lighting?",
    "Menentukan ke arah mana permukaan menghadap, sehingga shader bisa menghitung dot(N, L) untuk tahu seberapa langsung cahaya mengenai titik itu. Tanpa normal, tidak ada cara membedakan sisi yang menghadap cahaya dari sisi yang membelakanginya.",
  ],
  [
    "Apa perbedaan face normal dan vertex normal di sini?",
    "FLAT_NORMALS memberi keenam vertex satu face nilai yang identik, sehingga lighting konstan di seluruh face dan berubah tiba-tiba di tiap tepi — flat shading. SMOOTH_NORMALS memberi tiap vertex arah pusat-ke-sudutnya sendiri; rasterizer menginterpolasikannya di antara ketiga vertex satu triangle, menghasilkan transisi lighting yang menerus.",
  ],
  [
    "Mengapa normal perlu dinormalisasi lagi di fragment shader?",
    "v_normal adalah hasil interpolasi vertex normal yang tadinya sudah unit length, tapi interpolasi dua unit vector umumnya tidak menghasilkan unit vector lagi. normalize(v_normal) mengembalikannya ke panjang 1 sebelum dipakai di dot(N, L) — dot product dua unit vector itulah yang benar-benar merepresentasikan cosinus sudut di antara keduanya.",
  ],
  [
    "Mengapa normal tidak cukup dikalikan Model Matrix biasa?",
    "Model Matrix memindahkan TITIK dengan benar, tapi untuk ARAH (normal), bagian scale ikut mendistorsinya kalau scale-nya tidak uniform — permukaan yang dipepatkan pada satu sumbu butuh normal yang justru diregangkan pada sumbu itu supaya tetap tegak lurus. Normal Matrix (inverse-transpose dari bagian linear Model Matrix) adalah transformasi yang menjaga tegak-lurusan itu; mat3(u_model) saja tidak menjaminnya.",
  ],
  [
    "Mengapa Challenge D (toggle uniform/non-uniform scale) relevan dengan Normal Matrix?",
    "Dengan scale uniform, selisih antara memakai Model Matrix biasa dan Normal Matrix untuk normal nyaris tidak terlihat. Begitu cube diskalakan ke (1.8, 0.6, 1.0) lewat tombol N, perbedaannya baru terasa: Normal Matrix tetap menjaga lighting masuk akal di permukaan yang sudah tidak proporsional itu, yang justru menjadi inti Eksperimen Wajib 9 pada modul.",
  ],
  [
    "Apa fungsi ambient lighting, dan mengapa bukan pengganti diffuse?",
    "Ambient adalah pendekatan sangat sederhana untuk cahaya pantulan tidak langsung — nilainya tetap, tidak bergantung normal maupun arah cahaya, sekadar mencegah sisi yang tidak terkena cahaya langsung jadi hitam total. Karena itu ambient sendirian tidak pernah memberi kesan bentuk 3D; bentuk cube baru terlihat jelas begitu diffuse (yang memang bergantung arah) ikut aktif.",
  ],
  [
    "Apa arti dot(N, L), dan kenapa dibungkus max(..., 0.0)?",
    "Untuk dua unit vector, dot(N, L) mendekati 1 saat keduanya nyaris searah (cahaya datang tegak lurus permukaan, paling terang), mendekati 0 saat tegak lurus satu sama lain, dan negatif saat L menunjuk ke BELAKANG permukaan — cahaya berada di sisi yang tidak menghadapnya. Karena intensitas cahaya tidak boleh negatif (itu akan mengurangi warna, bukan sekadar nol-kan), hasilnya dijepit dengan max(dot(N, L), 0.0).",
  ],
  [
    "Apa fungsi view direction dan reflection direction pada specular?",
    "View direction V menunjuk dari permukaan ke kamera — specular butuh tahu dari mana permukaan ini sedang diamati. Reflection direction R adalah arah L dipantulkan terhadap N (reflect(-L, N)). Highlight paling terang saat R dan V nyaris sejajar, yaitu saat kamera kebetulan berada tepat di jalur pantulan cahaya — itulah kenapa specular bisa berubah walau posisi lampu tetap, asalkan sudut pandang kamera berubah.",
  ],
  [
    "Apa pengaruh shininess?",
    "Shininess adalah eksponen pada pow(max(dot(R, V), 0), shininess). Nilai kecil (mis. 8) membuat highlight lebar dan lembut karena pow dengan eksponen kecil meluruhkan lambat menjauhi pusat highlight. Nilai besar (mis. 128) membuat highlight kecil dan tajam karena peluruhannya jauh lebih cepat. ini bukan roughness fisik yang sebenarnya, hanya pendekatan Phong sederhana.",
  ],
  [
    "Apa fungsi UV coordinate dan texture sampler?",
    "UV adalah koordinat 2D (0..1 secara konvensi) yang memetakan tiap vertex ke satu titik pada texture image. u_texture (sampler2D) adalah pegangan ke texture unit yang aktif; texture(u_texture, v_texCoord) di fragment shader mengambil warna pada koordinat UV yang sudah diinterpolasi untuk fragment tersebut, menghasilkan base color permukaan.",
  ],
  [
    "Apa perbedaan NEAREST/LINEAR dan REPEAT/CLAMP_TO_EDGE/MIRRORED_REPEAT?",
    "Keduanya menjawab pertanyaan berbeda. Filtering (NEAREST vs LINEAR) menjawab 'texel mana yang dipakai kalau satu fragment jatuh di antara beberapa texel'. Wrapping (REPEAT/CLAMP_TO_EDGE/MIRRORED_REPEAT) menjawab 'texel mana yang dipakai kalau UV-nya sendiri sudah di luar 0..1' — tiga perilaku berbeda yang baru terlihat jelas setelah UV scale dinaikkan di atas 1.",
  ],
  [
    "Mengapa UV scale diperlukan untuk melihat efek wrapping?",
    "Selama UV tetap di rentang 0..1 seperti bawaan tiap face, REPEAT dan CLAMP_TO_EDGE menghasilkan tampilan yang nyaris identik — tidak ada bagian yang benar-benar keluar dari rentang itu untuk diuji. Menaikkan u_uvScale (lewat [ dan ]) membuat UV yang dikirim ke fragment shader melebihi 1, barulah wrapping mode benar-benar menentukan apa yang terjadi pada bagian yang 'kelebihan' itu.",
  ],
  [
    "Bagaimana texture dan lighting digabungkan?",
    "texColor dipakai sebagai warna dasar permukaan untuk ambient dan diffuse (ambient = strength × texColor, diffuse = faktor × lightColor × texColor) — artinya bagian cube yang gelap karena teksturnya memang gelap, bukan karena lighting. Specular sengaja TIDAK dikalikan texColor, hanya lightColor, karena highlight specular biasanya merepresentasikan warna sumber cahaya yang terpantul, bukan warna material di titik itu.",
  ],
  [
    "Mengapa lighting dihitung per-fragment, bukan per-vertex?",
    "Cube hanya punya 36 vertex tapi ribuan fragment. Menghitung ambient/diffuse/specular di fragment shader berarti tiap fragment memakai normal hasil interpolasinya SENDIRI (bukan dari salah satu dari 3 vertex terdekat), sehingga diffuse berubah halus melintasi permukaan dan specular highlight bisa muncul tepat di tengah sebuah face, bukan hanya di titik-titik vertex.",
  ],
  [
    "Di mana posisi praktikum ini pada rangkaian pipeline?",
    "Pertemuan 4 menyelesaikan rantai Local → World → Camera → Clip → NDC → Screen, tapi setiap fragment di permukaannya masih sekadar warna rata per face. Pertemuan 5 tidak menambah tahap transformasi baru — ia mengisi fragment shader yang sebelumnya hanya meneruskan warna, dengan pertanyaan 'bagaimana permukaan ini seharusnya terlihat', lewat normal, cahaya, dan texture.",
  ],
];

export default function InfoSection() {
  return (
    <div className="space-y-6">
      <Section
        title="Pipeline yang dijalankan"
        description="Tahap yang dilalui setiap fragment cube, dari data lokal sampai warna akhir di layar."
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
        title="Data per vertex"
        description="Posisi, normal, dan UV disiapkan terpisah dari warna/lighting — ketiganya hanya data mentah sampai fragment shader mengolahnya."
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-4 font-medium">Data</th>
                <th className="py-2 font-medium">Keterangan</th>
              </tr>
            </thead>
            <tbody>
              {VERTEX_DATA.map(([name, detail]) => (
                <tr key={name} className="border-b border-slate-800/60 last:border-0">
                  <td className="py-2 pr-4 text-slate-100">{name}</td>
                  <td className="py-2 text-slate-400">{detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section
        title="Komponen lighting"
        description="Ketiganya dijumlahkan di fragment shader; tombol 1/2/3 mematikan salah satunya untuk melihat kontribusinya sendiri-sendiri."
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-4 font-medium">Komponen</th>
                <th className="py-2 pr-4 font-medium">Formula</th>
                <th className="py-2 font-medium">Peran</th>
              </tr>
            </thead>
            <tbody>
              {LIGHTING_TERMS.map(([name, formula, role]) => (
                <tr key={name} className="border-b border-slate-800/60 last:border-0">
                  <td className="py-2 pr-4 text-slate-100">{name}</td>
                  <td className="py-2 pr-4 font-mono text-xs text-indigo-300">{formula}</td>
                  <td className="py-2 text-slate-400">{role}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section
        title="Texture: filtering & wrapping"
        description="Dua pertanyaan berbeda yang keduanya dijawab oleh parameter texture, bukan oleh datanya."
      >
        <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
          Filtering — texel mana yang dipakai di dalam satu fragment
        </p>
        <div className="overflow-x-auto">
          <table className="mb-4 w-full min-w-[480px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-4 font-medium">Aspek</th>
                <th className="py-2 pr-4 font-medium">NEAREST</th>
                <th className="py-2 font-medium">LINEAR</th>
              </tr>
            </thead>
            <tbody>
              {FILTER_COMPARISON.map(([aspect, nearest, linear]) => (
                <tr key={aspect} className="border-b border-slate-800/60 last:border-0">
                  <td className="py-2 pr-4 text-slate-100">{aspect}</td>
                  <td className="py-2 pr-4 text-slate-400">{nearest}</td>
                  <td className="py-2 text-slate-400">{linear}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
          Wrapping — texel mana yang dipakai saat UV di luar 0..1
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-4 font-medium">Mode</th>
                <th className="py-2 font-medium">Perilaku</th>
              </tr>
            </thead>
            <tbody>
              {WRAP_BEHAVIOR.map(([mode, behavior]) => (
                <tr key={mode} className="border-b border-slate-800/60 last:border-0">
                  <td className="py-2 pr-4 font-mono text-xs text-indigo-300">{mode}</td>
                  <td className="py-2 text-slate-400">{behavior}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
