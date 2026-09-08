"use client";

import { ControlCard, btnClass, segClass } from "@/components/ui/controls";
import { DRAW_MODES, DRAW_MODE_LABELS, PALETTE, type DrawMode } from "./webgl/scene";

export interface PlaygroundControlsProps {
  drawMode: DrawMode;
  onDrawModeChange: (mode: DrawMode) => void;
  color: string;
  onColorChange: (color: string) => void;
  onRandomColor: () => void;
  paused: boolean;
  onTogglePause: () => void;
  onReset: () => void;
  onClearSpawned: () => void;
  speed: number;
  onSpeedChange: (speed: number) => void;
  // HUD readings (Challenge F)
  fps: number;
  frameTime: number;
  spawnedCount: number;
  primitiveCount: number;
  vertexCount: number;
  mouseNdc: { x: number; y: number };
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
  drawMode,
  onDrawModeChange,
  color,
  onColorChange,
  onRandomColor,
  paused,
  onTogglePause,
  onReset,
  onClearSpawned,
  speed,
  onSpeedChange,
  fps,
  frameTime,
  spawnedCount,
  primitiveCount,
  vertexCount,
  mouseNdc,
}: PlaygroundControlsProps) {
  return (
    <div className="flex flex-col gap-4">
      {/* Challenge A — the selector drives the draw mode of every spawned primitive. */}
      <ControlCard title="Draw Mode">
        <div className="flex gap-1 rounded-lg border border-slate-800 bg-slate-950/60 p-1">
          {DRAW_MODES.map((mode) => (
            <button
              key={mode}
              type="button"
              aria-pressed={drawMode === mode}
              onClick={() => onDrawModeChange(mode)}
              className={segClass(drawMode === mode)}
            >
              {DRAW_MODE_LABELS[mode]}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          <span className="text-slate-300">gl.{drawMode}</span> dipakai untuk primitive baru
          hasil klik, sekaligus menggambar ulang <span className="text-slate-300">gradient
          rectangle</span> dengan 6 vertex yang sama persis — perhatikan bentuknya berubah
          tanpa satu pun angka pada vertex data ikut berubah.
        </p>
      </ControlCard>

      <ControlCard title="Warna">
        <div className="flex flex-wrap gap-2">
          {PALETTE.map((swatch) => (
            <button
              key={swatch}
              type="button"
              aria-label={`Warna ${swatch}`}
              aria-pressed={color === swatch}
              onClick={() => onColorChange(swatch)}
              style={{ backgroundColor: swatch }}
              className={`h-7 w-7 rounded-full border-2 transition-transform hover:scale-110 ${
                color === swatch ? "border-white" : "border-transparent"
              }`}
            />
          ))}
        </div>
        <button type="button" onClick={onRandomColor} className={`${btnClass} mt-3 w-full`}>
          Random
        </button>
        <p className="mt-2 text-xs text-slate-500">
          Dipakai untuk primitive baru dan segitiga player (tombol <span className="text-slate-300">C</span>).
        </p>
      </ControlCard>

      <ControlCard title="Aksi">
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={onTogglePause} className={btnClass}>
            {paused ? "Resume" : "Pause"}
          </button>
          <button type="button" onClick={onReset} className={btnClass}>
            Reset posisi
          </button>
          <button type="button" onClick={onClearSpawned} className={`${btnClass} col-span-2`}>
            Hapus primitive ({spawnedCount})
          </button>
        </div>

        <label className="mt-4 block text-xs text-slate-400">
          Kecepatan player
          <span className="ml-2 font-mono text-slate-200">{speed.toFixed(3)}</span>
          <input
            type="range"
            min={0.004}
            max={0.04}
            step={0.002}
            value={speed}
            onChange={(event) => onSpeedChange(Number(event.target.value))}
            className="mt-2 w-full accent-indigo-500"
          />
        </label>
      </ControlCard>

      <ControlCard title="Kontrol">
        <KeyRow keys="Arrow / WASD" action="Gerakkan player (state-based)" />
        <KeyRow keys="R" action="Reset posisi" />
        <KeyRow keys="C" action="Ganti warna player" />
        <KeyRow keys="P" action="Pause / resume" />
        <KeyRow keys="Klik" action="Buat primitive baru" />
        <p className="mt-2 text-xs text-slate-500">
          Keyboard hanya aktif saat canvas di-hover atau difokus dengan Tab, supaya tombol panah
          tetap bisa men-scroll halaman di tempat lain.
        </p>
      </ControlCard>

      {/* Challenge F — HUD as plain HTML outside the canvas, no WebGL text rendering. */}
      <ControlCard title="HUD">
        <HudRow label="FPS" value={String(fps)} />
        <HudRow label="Frame time" value={`${frameTime.toFixed(2)} ms`} />
        <HudRow label="Jumlah primitive" value={String(primitiveCount)} />
        <HudRow label="Total vertex" value={String(vertexCount)} />
        <HudRow label="Draw mode aktif" value={`gl.${drawMode}`} />
        <HudRow label="Mouse NDC" value={`(${mouseNdc.x.toFixed(3)}, ${mouseNdc.y.toFixed(3)})`} />
        <HudRow label="Status" value={paused ? "Paused" : "Berjalan"} />
      </ControlCard>
    </div>
  );
}
