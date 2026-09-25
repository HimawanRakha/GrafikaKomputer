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
  {
    slug: "pertemuan-3",
    pertemuan: 3,
    judul: "Interactive Transformation Playground",
    topik: "Transformation & Coordinate System",
    deskripsi: "Model Matrix di atas WebGL2: geometry tetap di local coordinate sementara translation, rotation, dan uniform/non-uniform scaling digabung lewat matrix multiplication dan dikirim sebagai uniform mat3. Dua object berbagi satu geometry triangle, satu object beranimasi otomatis, sebuah pintu berengsel mendemonstrasikan pivot, kontrol keyboard state-based dengan deltaTime, dua urutan transformasi yang bisa dibandingkan langsung, serta HUD posisi/rotasi/skala.",
    tags: ["WebGL2", "Transformation Matrix", "Local & World Space", "Matrix Composition", "Pivot", "Delta Time"],
    status: "available",
  },
  {
    slug: "pertemuan-4",
    pertemuan: 4,
    judul: "Rotating 3D Cube Camera Playground",
    topik: "Camera, Projection & 3D",
    deskripsi: "Rantai Model → View → Projection lengkap di atas WebGL2. Tiga cube 36 vertex dengan warna per sisi berbagi satu buffer GPU dan berputar otomatis lewat Model Matrix 4×4, sementara kamera dengan position/target/up dapat digerakkan bebas maupun mengorbit target. Perspective dan orthographic projection dapat ditukar saat runtime, lengkap dengan kontrol FOV, preset near/far yang memotong geometry, depth test yang bisa dimatikan untuk memperlihatkan kegagalan painter's algorithm, serta aspect ratio yang dihitung ulang tiap frame dari drawing buffer.",
    tags: ["WebGL2", "View Matrix & lookAt", "Perspective & Orthographic", "FOV & Clipping Plane", "Depth Buffer", "Orbit Camera"],
    status: "available",
  },
];

export function getPraktikumBySlug(slug: string): PraktikumMeta | undefined {
  return praktikumList.find((item) => item.slug === slug);
}
