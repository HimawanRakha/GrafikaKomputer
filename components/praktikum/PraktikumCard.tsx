import Link from "next/link";
import type { PraktikumMeta } from "@/data/praktikum";

export default function PraktikumCard({ meta }: { meta: PraktikumMeta }) {
  const available = meta.status === "available";

  const card = (
    <div
      className={`h-full rounded-2xl border p-5 transition-colors ${
        available
          ? "border-slate-800 bg-slate-900/60 hover:border-indigo-500/60 hover:bg-slate-900"
          : "border-dashed border-slate-800 bg-slate-900/20"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
          Pertemuan {meta.pertemuan}
        </span>
        {!available && (
          <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[11px] text-slate-400">
            Segera
          </span>
        )}
      </div>
      <h2 className="mt-2 text-lg font-semibold text-white">{meta.judul}</h2>
      <p className="mt-1 text-sm text-slate-400">{meta.topik}</p>
      <p className="mt-3 text-sm text-slate-500">{meta.deskripsi}</p>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {meta.tags.map((tag) => (
          <span key={tag} className="rounded-full bg-slate-800/80 px-2 py-0.5 text-[11px] text-slate-300">
            {tag}
          </span>
        ))}
      </div>
    </div>
  );

  if (!available) return card;
  return <Link href={`/pertemuan/${meta.slug}`}>{card}</Link>;
}
