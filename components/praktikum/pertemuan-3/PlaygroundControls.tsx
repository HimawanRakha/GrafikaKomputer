"use client";

import { ControlCard, btnClass, segClass } from "@/components/ui/controls";
import { ORDER_LABELS, PRESETS, type TransformOrder } from "./webgl/scene";

export interface PlaygroundControlsProps {
  order: TransformOrder;
  onSetOrder: (order: TransformOrder) => void;
  paused: boolean;
  onTogglePause: () => void;
  onReset: () => void;
  activePreset: number | null;
  onApplyPreset: (index: number) => void;
  // HUD readings for Object A
  position: { x: number; y: number };
  rotation: number;
  scaleX: number;
  scaleY: number;
}

/** One label/value row inside the HUD card. */
function HudRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span className="text-xs text-slate-400">{label}</span>
      <span className="font-mono text-xs text-slate-100">{value}</span>
    </div>
  );
}

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

export default function PlaygroundControls({
  order,
  onSetOrder,
  paused,
  onTogglePause,
  onReset,
  activePreset,
  onApplyPreset,
  position,
  rotation,
  scaleX,
  scaleY,
}: PlaygroundControlsProps) {
  return (
    <div className="flex flex-col gap-4">
      {/* Challenge C — toggle Object A's Model Matrix composition order. */}
      <ControlCard title="Transform order — Object A">
        <div className="flex gap-1 rounded-lg border border-slate-800 bg-slate-950/60 p-1">
          <button
            type="button"
            aria-pressed={order === "A"}
            onClick={() => onSetOrder("A")}
            className={segClass(order === "A")}
          >
            Order A
          </button>
          <button
            type="button"
            aria-pressed={order === "B"}
            onClick={() => onSetOrder("B")}
            className={segClass(order === "B")}
          >
            Order B
          </button>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-slate-500">
          <span className="text-slate-300">{ORDER_LABELS[order]}</span>
          {order === "A"
            ? " — M = T×R×S. Object berputar di tempatnya sendiri, baru dipindah ke posisi dunia."
            : " — M = R×T. Posisi ditranslasi dulu, lalu hasilnya ikut diputar, sehingga object mengorbit origin dunia alih-alih berputar di tempat."}
        </p>
      </ControlCard>

      <ControlCard title="Preset — Challenge B">
        <div className="grid grid-cols-3 gap-2">
          {PRESETS.map((preset, index) => (
            <button
              key={preset.label}
              type="button"
              aria-pressed={activePreset === index}
              onClick={() => onApplyPreset(index)}
              className={segClass(activePreset === index)}
            >
              {index + 1}
            </button>
          ))}
        </div>
      </ControlCard>

      <ControlCard title="Aksi">
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={onTogglePause} className={btnClass}>
            {paused ? "Resume (P)" : "Pause (P)"}
          </button>
          <button type="button" onClick={onReset} className={btnClass}>
            Reset (R)
          </button>
        </div>
      </ControlCard>

      <ControlCard title="Kontrol keyboard">
        <KeyRow keys="Arrow" action="Translate Object A" />
        <KeyRow keys="Q / E" action="Rotate Object A" />
        <KeyRow keys="+ / -" action="Uniform scale" />
        <KeyRow keys="Z / X" action="Scale X (non-uniform)" />
        <KeyRow keys="C / V" action="Scale Y (non-uniform)" />
        <KeyRow keys="1 / 2 / 3" action="Terapkan preset" />
        <KeyRow keys="T" action="Ganti transform order" />
        <KeyRow keys="R" action="Reset transform" />
        <KeyRow keys="Klik" action="Set posisi via mouse (NDC)" />
        <p className="mt-2 text-xs text-slate-500">
          Keyboard hanya aktif saat canvas di-hover atau difokus dengan Tab, supaya tombol panah
          tetap bisa men-scroll halaman di tempat lain.
        </p>
      </ControlCard>

      <ControlCard title="HUD — Object A">
        <HudRow label="Position" value={`(${position.x.toFixed(2)}, ${position.y.toFixed(2)})`} />
        <HudRow label="Rotation" value={`${rotation.toFixed(1)}°`} />
        <HudRow label="Scale" value={`(${scaleX.toFixed(2)}, ${scaleY.toFixed(2)})`} />
        <HudRow label="Order" value={ORDER_LABELS[order]} />
        <HudRow label="Status" value={paused ? "Paused" : "Berjalan"} />
      </ControlCard>
    </div>
  );
}
