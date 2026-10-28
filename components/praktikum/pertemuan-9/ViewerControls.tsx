"use client";

import type { RefObject } from "react";
import { ControlCard, btnClass, segClass } from "@/components/ui/controls";
import stats from "@/public/praktikum-9/stats.json";
import type { ViewerActions, ViewerInfo } from "./StageViewer";

export interface ViewerControlsProps {
  /** Null until the viewer sends its first snapshot (~100 ms after mount). */
  info: ViewerInfo | null;
  actions: RefObject<ViewerActions | null>;
}

const VIEW_BUTTONS = [
  ["front", "Front", "Num 1"],
  ["right", "Right", "Num 3"],
  ["top", "Top", "Num 7"],
  ["persp", "3/4", "Num 0"],
] as const;

/** One keyboard shortcut row in the legend. */
function KeyRow({ keys, action }: { keys: string; action: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-0.5">
      <kbd className="rounded border border-slate-700 bg-slate-800 px-1.5 py-0.5 font-mono text-[11px] text-slate-200">
        {keys}
      </kbd>
      <span className="text-right text-xs text-slate-400">{action}</span>
    </div>
  );
}

export default function ViewerControls({ info, actions }: ViewerControlsProps) {
  const stageIndex = info?.stage ?? stats.stages.length;
  const stage = stats.stages[stageIndex - 1];
  const totals = stage.parts.reduce(
    (sum, part) => ({
      base: sum.base + part.base.faces,
      evaluated: sum.evaluated + part.evaluated.faces,
      tris: sum.tris + part.evaluated.tris,
      ngons: sum.ngons + part.evaluated.ngons,
    }),
    { base: 0, evaluated: 0, tris: 0, ngons: 0 },
  );

  return (
    <div className="flex flex-col gap-4">
      <ControlCard title="Tahap workflow (1–5)">
        <div className="grid grid-cols-5 gap-1">
          {stats.stages.map((item) => (
            <button
              key={item.index}
              type="button"
              aria-pressed={stageIndex === item.index}
              title={item.title}
              onClick={() => actions.current?.setStage(item.index)}
              className={segClass(stageIndex === item.index)}
            >
              {item.index}
            </button>
          ))}
        </div>
        <p className="mt-3 text-sm font-medium text-slate-100">{stage.title}</p>
        <p className="mt-1 text-xs leading-relaxed text-slate-400">{stage.notes}</p>
      </ControlCard>

      <ControlCard title="Topology tahap ini">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="text-slate-500">
              <th className="pb-1 font-medium">Object</th>
              <th className="pb-1 text-right font-medium">Face</th>
              <th className="pb-1 text-right font-medium">+Modifier</th>
            </tr>
          </thead>
          <tbody className="font-mono text-slate-200">
            {stage.parts.map((part) => (
              <tr key={part.name} title={part.modifiers.join(", ") || "tanpa modifier"}>
                <td className="py-0.5 pr-2">{part.name}</td>
                <td className="py-0.5 text-right">{part.base.faces}</td>
                <td className="py-0.5 text-right text-sky-300">{part.evaluated.faces}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-xs leading-relaxed text-slate-500">
          Total {totals.base} face di base mesh, {totals.evaluated} setelah modifier ({totals.tris} tri,{" "}
          {totals.ngons} n-gon, sisanya quad).
        </p>
      </ControlCard>

      <ControlCard title="View preset & tampilan">
        <div className="grid grid-cols-4 gap-1">
          {VIEW_BUTTONS.map(([view, label, key]) => (
            <button
              key={view}
              type="button"
              title={key}
              aria-pressed={info?.view === view}
              onClick={() => actions.current?.setView(view)}
              className={segClass(info?.view === view)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button
            type="button"
            aria-pressed={info?.wireframe ?? false}
            onClick={() => actions.current?.toggleWireframe()}
            className={segClass(info?.wireframe ?? false)}
          >
            Wireframe (W)
          </button>
          <button
            type="button"
            aria-pressed={info?.xray ?? false}
            onClick={() => actions.current?.toggleXray()}
            className={segClass(info?.xray ?? false)}
          >
            X-Ray (X)
          </button>
          <button type="button" onClick={() => actions.current?.swapCamera()} className={btnClass}>
            {info?.camera === "Orthographic" ? "Ortho (Num 5)" : "Persp (Num 5)"}
          </button>
          <button type="button" onClick={() => actions.current?.frameSelected()} className={btnClass}>
            Frame (Num .)
          </button>
        </div>
        <button type="button" onClick={() => actions.current?.reset()} className={`mt-2 w-full ${btnClass}`}>
          Reset
        </button>
        <p className="mt-2 text-xs leading-relaxed text-slate-500">
          Wireframe menggambar edge asli dari Blender (quad / n-gon), bukan segitiga hasil triangulasi
          glTF. Front, Right, dan Top otomatis orthographic seperti di Blender.
        </p>
      </ControlCard>

      <ControlCard title="Kontrol">
        <KeyRow keys="Drag kiri / kanan" action="Orbit / pan" />
        <KeyRow keys="Scroll" action="Zoom" />
        <KeyRow keys="1 – 5" action="Tahap workflow" />
        <KeyRow keys="Num 1 / 3 / 7" action="Front / Right / Top" />
        <KeyRow keys="Num 5" action="Perspective ↔ ortho" />
        <KeyRow keys="Num 0 / Home" action="View 3/4 awal" />
        <KeyRow keys="Num ." action="Frame asset" />
        <KeyRow keys="W / X" action="Wireframe / X-Ray" />
      </ControlCard>
    </div>
  );
}
