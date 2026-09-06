import type { ComponentType } from "react";
import Pertemuan1 from "./pertemuan-1/Pertemuan1";

// Peta slug -> komponen praktikum. Tambahkan baris baru di sini setiap
// sebuah pertemuan baru selesai diimplementasikan.
export const praktikumComponents: Record<string, ComponentType> = {
  "pertemuan-1": Pertemuan1,
};
