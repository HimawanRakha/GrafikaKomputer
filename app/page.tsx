import { praktikumList } from "@/data/praktikum";
import PraktikumCard from "@/components/praktikum/PraktikumCard";

export default function Home() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <section className="mb-10">
        <p className="text-sm font-medium text-indigo-400">EF234504 — Grafika Komputer</p>
        <h1 className="mt-2 text-3xl font-bold text-white">Portal Praktikum</h1>
        <p className="mt-3 max-w-2xl text-slate-400">
          Kumpulan praktikum interaktif mata kuliah Grafika Komputer, Departemen Teknik
          Informatika ITS. Setiap pertemuan dirender sesuai jenis praktikumnya masing-masing,
          dan halaman ini akan terus bertambah setiap ada tugas praktikum baru.
        </p>
      </section>

      <section className="grid gap-5 sm:grid-cols-2">
        {praktikumList.map((item) => (
          <PraktikumCard key={item.slug} meta={item} />
        ))}
      </section>
    </main>
  );
}
