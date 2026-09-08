export type PraktikumStatus = "available" | "coming-soon";

export interface PraktikumMeta {
  slug: string;
  pertemuan: number;
  judul: string;
  topik: string;
  deskripsi: string;
  tags: string[];
  status: PraktikumStatus;
}

// Tambahkan entri baru di sini setiap ada tugas praktikum berikutnya.
// Halaman /pertemuan/[slug] akan otomatis merender komponen yang didaftarkan
// di components/praktikum/registry.tsx sesuai slug di bawah ini.
export const praktikumList: PraktikumMeta[] = [
  {
    slug: "pertemuan-1",
    pertemuan: 1,
    judul: "Graphics Playground",
    topik: "Introduction to Computer Graphics",
    deskripsi: "Mini aplikasi grafika interaktif: menggambar primitive 2D (line, rectangle, circle, triangle, star) dengan warna pilihan sendiri, animasi berbasis frame, interaksi mouse dan keyboard, serta panel FPS — seluruhnya di atas HTML Canvas 2D.",
    tags: ["Canvas 2D", "Primitive & Koordinat", "Animasi", "Input Mouse & Keyboard", "FPS & Frame Time"],
    status: "available",
  },
  {
    slug: "pertemuan-2",
    pertemuan: 2,
    judul: "WebGL Primitive Playground",
    topik: "WebGL Fundamental",
    deskripsi: "Pipeline WebGL2 dari nol: vertex data disiapkan sebagai Float32Array, diunggah ke buffer GPU, dihubungkan ke attribute, lalu digambar lewat shader sendiri. Berisi triangle, rectangle, star, dan point grid dengan vertex color yang diinterpolasi, tiga object yang memantul di batas NDC dengan arah dan kecepatan berbeda, kontrol keyboard state-based, serta primitive baru yang muncul di posisi klik.",
    tags: ["WebGL2", "Buffer & Attribute", "Vertex & Fragment Shader", "NDC", "Vertex Color", "Draw Mode"],
    status: "available",
  },
];

export function getPraktikumBySlug(slug: string): PraktikumMeta | undefined {
  return praktikumList.find((item) => item.slug === slug);
}
