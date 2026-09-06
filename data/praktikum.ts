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
    judul: "Belum tersedia",
    topik: "Menunggu modul praktikum berikutnya",
    deskripsi: "Materi pertemuan ini belum dirilis. Halaman akan muncul di sini begitu praktikumnya dikerjakan.",
    tags: ["Segera"],
    status: "coming-soon",
  },
];

export function getPraktikumBySlug(slug: string): PraktikumMeta | undefined {
  return praktikumList.find((item) => item.slug === slug);
}
