"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { praktikumList } from "@/data/praktikum";

function Brand() {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-indigo-400">EF234504</p>
      <h1 className="mt-1 text-base font-bold text-white">Grafika Komputer</h1>
      <p className="mt-1 text-xs text-slate-500">Himawan Rakha Bhadra &middot; Frenaldy</p>
    </div>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex-1 overflow-y-auto">
      <Link href="/" onClick={onNavigate} className={`block rounded-lg px-3 py-2 text-sm font-medium transition-colors ${pathname === "/" ? "bg-indigo-500/15 text-indigo-300" : "text-slate-300 hover:bg-slate-800/60 hover:text-white"}`}>
        Dashboard
      </Link>

      <p className="mb-2 mt-5 px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Daftar Pertemuan</p>
      <ul className="space-y-1">
        {praktikumList.map((item) => {
          const href = `/pertemuan/${item.slug}`;
          const active = pathname === href;
          const disabled = item.status !== "available";

          if (disabled) {
            return (
              <li key={item.slug}>
                <span className="block cursor-not-allowed rounded-lg px-3 py-2 opacity-50">
                  <span className="block text-sm font-medium text-slate-400">Pertemuan {item.pertemuan}</span>
                  <span className="block text-xs text-slate-600">{item.judul}</span>
                </span>
              </li>
            );
          }

          return (
            <li key={item.slug}>
              <Link href={href} onClick={onNavigate} className={`block rounded-lg px-3 py-2 transition-colors ${active ? "bg-indigo-500/15 text-indigo-300" : "text-slate-300 hover:bg-slate-800/60 hover:text-white"}`}>
                <span className="block text-sm font-medium">Pertemuan {item.pertemuan}</span>
                <span className="block text-xs text-slate-500">{item.judul}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export default function Sidebar() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-800 bg-slate-950/90 px-4 py-3 backdrop-blur md:hidden">
        <Link href="/" className="text-sm font-semibold text-white">
          Grafika Komputer
        </Link>
        <button onClick={() => setOpen(true)} className="rounded-md border border-slate-700 px-3 py-1.5 text-sm text-slate-200">
          Menu
        </button>
      </header>

      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 flex-col gap-6 border-r border-slate-800 bg-slate-950 px-5 py-6">
            <div className="flex items-start justify-between">
              <Brand />
              <button onClick={() => setOpen(false)} className="text-slate-500" aria-label="Tutup menu">
                ✕
              </button>
            </div>
            <NavLinks onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}

      <aside className="sticky top-0 hidden h-screen w-72 shrink-0 flex-col gap-6 border-r border-slate-800 bg-slate-900/40 px-5 py-6 md:flex">
        <Brand />
        <NavLinks />
      </aside>
    </>
  );
}
