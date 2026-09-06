import Section from "@/components/ui/Section";

const OBJECTS = [
  { nama: "Rectangle", warna: "#3498db", data: "position (x, y), width, height" },
  { nama: "Line", warna: "#e74c3c", data: "titik awal & akhir (moveTo → lineTo)" },
  { nama: "Circle statis", warna: "#2ecc71", data: "center (x, y), radius" },
  { nama: "Triangle", warna: "#f39c12", data: "3 vertex: v0, v1, v2" },
  { nama: "Bouncing ball", warna: "#9b59b6", data: "posisi + velocity (speedX, speedY)" },
  { nama: "Follow circle", warna: "#1abc9c", data: "mengikuti koordinat mouse tiap frame" },
  { nama: "Player", warna: "#e67e22", data: "posisi + speed, translasi keyboard" },
  {
    nama: "Shape buatan user",
    warna: "#dd873c",
    data: "kind + 2 titik hasil drag + warna dari color picker (default di samping)",
  },
];

const COMPARISON: [string, string, string][] = [
  ["Pemicu", "Event seperti keydown", "State dibaca tiap frame di animation loop"],
  ["Aksi dijalankan", "Langsung di event handler", "Di fungsi update()"],
  ["Cocok untuk", "Aksi diskrit / sekali tekan", "Aksi kontinu"],
  ["Translasi terus-menerus", "Kurang ideal", "Sangat cocok"],
  ["Bergantung keyboard repeat", "Bisa iya", "Tidak"],
  ["Multi-key movement", "Kurang natural", "Mudah"],
  ["Pause / toggle / reset", "Sangat cocok", "Tidak perlu"],
];

const CHECKLIST = [
  "Canvas minimal 800×500 (logis 960×600, tampil responsif)",
  "Minimal 3 primitive berbeda — rectangle, line, circle, triangle",
  "Minimal 4 warna terlihat pada objek berbeda",
  "1 triangle dibentuk dari 3 koordinat vertex",
  "Minimal 1 objek bergerak — bouncing ball, follow circle, multiple moving objects",
  "Translasi keyboard state-based, dengan mode event-based untuk perbandingan langsung",
  "Koordinat mouse tampil secara real-time di HUD canvas",
  "Challenge A–E terpenuhi: bounce, follow mouse, click to change color, keyboard movement, mouse coordinate",
  "Challenge tambahan: click to create circle, trail mode, multiple moving objects",
  "Panel Shapes — user memilih sendiri primitive yang digambar: line, rectangle, circle, triangle, star",
  "Panel Color — warna dipilih lewat hue slider atau color picker, bukan lagi palet tetap",
  "Actions — Clear, Random, Animate, dan Reset",
  "Panel Info — FPS dan frame time diukur dari selisih timestamp requestAnimationFrame, plus resolusi canvas",
];

const QNA: [string, string][] = [
  [
    "Apa fungsi <canvas>?",
    "Elemen HTML yang menyediakan area bitmap untuk digambar lewat JavaScript; ukuran drawing buffer-nya ditentukan atribut width/height.",
  ],
  [
    'Apa fungsi getContext("2d")?',
    "Meminta 2D rendering context dari canvas sehingga tersedia perintah menggambar seperti fillRect, arc, dan stroke.",
  ],
  [
    "Di mana titik (0, 0) pada canvas?",
    "Di pojok kiri atas. Nilai x bertambah ke kanan, nilai y bertambah ke bawah.",
  ],
  [
    "Apa yang direpresentasikan x dan y?",
    "Posisi horizontal dan vertikal sebuah titik atau objek dalam sistem koordinat canvas.",
  ],
  [
    "Bagaimana tiga koordinat membentuk triangle?",
    "moveTo menuju vertex pertama, lineTo ke vertex kedua dan ketiga, lalu closePath menyambungkannya kembali ke vertex pertama.",
  ],
  [
    "Perbedaan fill() dan stroke()?",
    "fill() mewarnai area tertutup path (isi bentuk); stroke() hanya menggambar garis outline path tersebut.",
  ],
  [
    "Mengapa canvas perlu dibersihkan tiap frame?",
    "Canvas tidak menghapus piksel lama secara otomatis. Tanpa clearRect, objek yang bergerak meninggalkan jejak — coba aktifkan mode Trail untuk melihat efeknya.",
  ],
  [
    "Apa fungsi requestAnimationFrame()?",
    "Meminta browser memanggil ulang fungsi animate tepat sebelum repaint berikutnya, menghasilkan animation loop yang selaras dengan refresh rate layar.",
  ],
  [
    "Bagaimana FPS dan frame time dihitung?",
    "requestAnimationFrame mengirim timestamp ke fungsi animate. Selisih dua timestamp berturut-turut adalah frame time, dan FPS = 1000 / frame time. Angkanya dirata-ratakan lalu dikirim ke UI 4x per detik saja — meng-update state tiap frame justru memaksa 60 render per detik dan menurunkan FPS yang sedang diukur.",
  ],
  [
    "Bagaimana satu bentuk bisa dibuat dari dua titik drag?",
    "Titik saat mousedown dan titik saat mouse bergerak disimpan sebagai (x1, y1) dan (x2, y2). Rectangle dan triangle memakai kotak pembatas dua titik itu, sedangkan circle dan star memakai titik pertama sebagai center dan jaraknya sebagai radius.",
  ],
  [
    "Bagaimana keyboard bisa menggerakkan objek?",
    "Event keydown/keyup mengubah data (posisi langsung, atau status tombol keys[...]), lalu fungsi update membaca data itu sebelum objek digambar ulang.",
  ],
  [
    "Perbedaan event-based dan state-based?",
    "Event-based menjalankan aksi langsung saat event terjadi. State-based hanya mencatat status tombol; aksinya baru dijalankan pada setiap frame di updatePlayer().",
  ],
  [
    "Mengapa translasi kontinu lebih tepat state-based?",
    "Karena pergerakannya mengikuti timing animation loop aplikasi, bukan timing keyboard repeat browser/OS yang punya delay awal dan rate berbeda-beda.",
  ],
  [
    "Dua contoh aksi yang lebih tepat event-based?",
    "Mengganti warna bola (tombol C) dan mereset posisi (tombol R) — keduanya aksi sekali tekan, bukan translasi kontinu.",
  ],
  [
    "Mengapa keydown/keyup tetap dipakai pada state-based?",
    "Karena keduanya satu-satunya cara membaca status tombol dari browser. State-based hanya memindahkan aksinya ke update(), bukan menghilangkan listener-nya.",
  ],
  [
    "Mana yang termasuk data, mana proses drawing?",
    "Data: object rectangle, line, triangle, movingBall, player, mouse, keys. Proses drawing: fungsi draw* yang membaca data tersebut lalu memanggil Canvas 2D API.",
  ],
  [
    "Apa hubungan animasi dengan konsep frame?",
    "Satu frame adalah satu hasil gambar. requestAnimationFrame memanggil update lalu draw berulang kali, dan rangkaian frame yang berbeda posisi terlihat sebagai gerakan.",
  ],
  [
    "Apa hubungan praktikum ini dengan Data → Proses Grafika → Gambar?",
    "Setiap objek adalah data; fungsi update mengubah data itu tiap frame; fungsi draw mengirim data ke Canvas 2D API; browser me-rasterisasi hasilnya menjadi piksel di layar.",
  ],
];

function FlowDiagram({ steps }: { steps: string[] }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {steps.map((step, index) => (
        <div key={step} className="flex items-center gap-2">
          <span className="rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-xs font-medium text-slate-200">
            {step}
          </span>
          {index < steps.length - 1 && <span className="text-slate-600">&rarr;</span>}
        </div>
      ))}
    </div>
  );
}

export default function InfoSection() {
  return (
    <div className="space-y-6">
      <Section title="Capaian praktikum">
        <ul className="grid list-disc gap-x-8 gap-y-1.5 pl-5 text-sm text-slate-300 sm:grid-cols-2">
          <li>Menjelaskan fungsi HTML Canvas sebagai area gambar</li>
          <li>Memahami koordinat 2D pada canvas</li>
          <li>Menggunakan data posisi, ukuran, dan warna untuk membentuk gambar</li>
          <li>Menggambar rectangle, line, circle, dan triangle</li>
          <li>Membuat animasi berbasis frame dengan requestAnimationFrame()</li>
          <li>Menangani input mouse dan keyboard</li>
          <li>Membedakan event-based dan state-based keyboard input</li>
          <li>Menghubungkan hasil praktikum dengan konsep graphics pipeline</li>
        </ul>
      </Section>

      <Section title="Alur data menjadi gambar">
        <div className="space-y-4">
          <FlowDiagram steps={["DATA", "COORDINATE", "PRIMITIVE", "DRAWING", "FRAME", "PIXEL / IMAGE"]} />
          <FlowDiagram steps={["USER INPUT", "UPDATE DATA", "DRAW FRAME", "DISPLAY", "REPEAT"]} />
        </div>
      </Section>

      <Section
        title="Objek pada canvas"
        description="Setiap bentuk berasal dari data posisi, ukuran, dan warna yang terpisah dari fungsi menggambarnya."
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-xs uppercase tracking-wider text-slate-500">
                <th className="py-2 pr-4">Objek</th>
                <th className="py-2 pr-4">Warna</th>
                <th className="py-2">Data utama</th>
              </tr>
            </thead>
            <tbody>
              {OBJECTS.map((obj) => (
                <tr key={obj.nama} className="border-b border-slate-800/60 last:border-0">
                  <td className="py-2 pr-4 text-slate-200">{obj.nama}</td>
                  <td className="py-2 pr-4">
                    <span className="inline-flex items-center gap-2">
                      <span
                        className="h-3 w-3 rounded-full border border-white/10"
                        style={{ backgroundColor: obj.warna }}
                      />
                      <span className="text-slate-400">{obj.warna}</span>
                    </span>
                  </td>
                  <td className="py-2 text-slate-400">{obj.data}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section
        title="Event-based vs state-based keyboard input"
        description="Coba ganti mode di panel kontrol lalu tahan Arrow Right untuk merasakan langsung perbedaannya."
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-xs uppercase tracking-wider text-slate-500">
                <th className="py-2 pr-4">Aspek</th>
                <th className="py-2 pr-4">Event-based</th>
                <th className="py-2">State-based</th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON.map(([aspek, event, state]) => (
                <tr key={aspek} className="border-b border-slate-800/60 last:border-0">
                  <td className="py-2 pr-4 text-slate-200">{aspek}</td>
                  <td className="py-2 pr-4 text-slate-400">{event}</td>
                  <td className="py-2 text-slate-400">{state}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Checklist syarat praktikum">
        <ul className="space-y-2 text-sm">
          {CHECKLIST.map((item) => (
            <li key={item} className="flex items-start gap-2 text-slate-300">
              <span className="mt-0.5 text-emerald-400">&#10003;</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Catatan konsep" description="Ringkasan jawaban untuk pertanyaan pemahaman pada modul praktikum.">
        <ol className="space-y-4 text-sm">
          {QNA.map(([question, answer], index) => (
            <li key={question}>
              <p className="font-medium text-slate-200">
                {index + 1}. {question}
              </p>
              <p className="mt-1 text-slate-400">{answer}</p>
            </li>
          ))}
        </ol>
      </Section>
    </div>
  );
}
