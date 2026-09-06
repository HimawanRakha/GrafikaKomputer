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
    deskripsi: "Menggambar primitive 2D (rectangle, line, circle, triangle), animasi berbasis frame, serta interaksi mouse dan keyboard menggunakan HTML Canvas 2D.",
    tags: ["Canvas 2D", "Primitive & Koordinat", "Animasi", "Input Mouse & Keyboard"],
    status: "available",
  },
  {
    slug: "pertemuan-2",
    pertemuan: 2,
    judul: "coming-soon",
    topik: "coming-soon",
    deskripsi: "coming-soon",
    tags: ["coming-soon"],
    status: "coming-soon",
  },
];

export function getPraktikumBySlug(slug: string): PraktikumMeta | undefined {
  return praktikumList.find((item) => item.slug === slug);
}
