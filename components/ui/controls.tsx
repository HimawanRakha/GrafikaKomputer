// Small presentational building blocks shared by the control panels of every
// pertemuan. They carry no state and no behaviour — only the styling that keeps
// the panels looking consistent across praktikum.

/** Standard look for a small action button inside a control panel. */
export const btnClass =
  "rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:border-indigo-500 hover:bg-slate-700";

/** Styling for one option inside a segmented control; `active` marks the selection. */
export function segClass(active: boolean) {
  return `flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
    active ? "bg-indigo-500 text-white" : "text-slate-400 hover:text-slate-200"
  }`;
}

/** A titled card that groups related controls. */
export function ControlCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
      <h3 className="mb-3 text-sm font-semibold text-white">{title}</h3>
      {children}
    </div>
  );
}
