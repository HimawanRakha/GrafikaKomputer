import { notFound } from "next/navigation";
import { getPraktikumBySlug, praktikumList } from "@/data/praktikum";
import { praktikumComponents } from "@/components/praktikum/registry";

export function generateStaticParams() {
  return praktikumList.map((item) => ({ slug: item.slug }));
}

export default async function PraktikumDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const meta = getPraktikumBySlug(slug);
  if (!meta) notFound();

  const Component = praktikumComponents[meta.slug];

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-8">
        <p className="text-sm font-medium text-indigo-400">
          Pertemuan {meta.pertemuan} &middot; {meta.topik}
        </p>
        <h1 className="mt-1 text-2xl font-bold text-white">{meta.judul}</h1>
        <p className="mt-2 max-w-3xl text-slate-400">{meta.deskripsi}</p>
      </header>

      {Component ? (
        <Component />
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-800 p-10 text-center text-slate-500">
          Konten praktikum ini belum tersedia.
        </div>
      )}
    </main>
  );
}
