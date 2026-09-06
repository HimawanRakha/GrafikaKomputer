import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center px-6 text-center">
      <p className="text-sm font-medium text-indigo-400">404</p>
      <h1 className="mt-2 text-2xl font-bold text-white">Halaman tidak ditemukan</h1>
      <p className="mt-2 text-slate-400">Praktikum yang kamu cari belum tersedia atau URL-nya salah.</p>
      <Link
        href="/"
        className="mt-6 rounded-md border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700"
      >
        Kembali ke dashboard
      </Link>
    </main>
  );
}
