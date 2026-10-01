import type { ComponentType } from "react";
import Pertemuan1 from "./pertemuan-1/Pertemuan1";
import Pertemuan2 from "./pertemuan-2/Pertemuan2";
import Pertemuan3 from "./pertemuan-3/Pertemuan3";
import Pertemuan4 from "./pertemuan-4/Pertemuan4";
import Pertemuan5 from "./pertemuan-5/Pertemuan5";

// Peta slug -> komponen praktikum. Tambahkan baris baru di sini setiap
// sebuah pertemuan baru selesai diimplementasikan.
export const praktikumComponents: Record<string, ComponentType> = {
  "pertemuan-1": Pertemuan1,
  "pertemuan-2": Pertemuan2,
  "pertemuan-3": Pertemuan3,
  "pertemuan-4": Pertemuan4,
  "pertemuan-5": Pertemuan5,
};
