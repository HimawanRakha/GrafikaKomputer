"use client";

import { SHAPE_KINDS, SHAPE_LABELS, type ShapeKind, type Tool } from "./shapes";

export type Mode = "state" | "event";

const btnClass =
  "rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:border-indigo-500 hover:bg-slate-700";

function segClass(active: boolean) {
  return `flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
    active ? "bg-indigo-500 text-white" : "text-slate-400 hover:text-slate-200"
  }`;
}

function ControlCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
      <h3 className="mb-3 text-sm font-semibold text-white">{title}</h3>
      {children}
    </div>
  );
}

// Tool icons drawn as inline SVG so each button shows the primitive it creates.
const TOOL_ICONS: Record<Tool, React.ReactNode> = {
  demo: <path d="M5 3l12 8-5 1 2.5 5.5-2 1L10 13l-5 4z" fill="currentColor" />,
  line: <line x1="4" y1="17" x2="17" y2="4" stroke="currentColor" strokeWidth="2" />,
  rect: <rect x="4" y="6" width="14" height="10" stroke="currentColor" strokeWidth="2" fill="none" />,
  circle: <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="2" fill="none" />,
  triangle: <polygon points="11,4 18,17 4,17" stroke="currentColor" strokeWidth="2" fill="none" />,
  star: (
    <polygon
      points="11,3 13.2,8.6 19,9 14.6,12.9 16,18.6 11,15.4 6,18.6 7.4,12.9 3,9 8.8,8.6"
      stroke="currentColor"
      strokeWidth="1.6"
      fill="none"
    />
  ),
};

function ToolButton({
  tool,
  label,
  active,
  onSelect,
}: {
  tool: Tool;
  label: string;
  active: boolean;
  onSelect: (tool: Tool) => void;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={() => onSelect(tool)}
      className={`flex h-10 w-10 items-center justify-center rounded-md border transition-colors ${
        active
          ? "border-indigo-400 bg-indigo-500/20 text-indigo-300"
          : "border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600 hover:text-slate-200"
      }`}
    >
      <svg viewBox="0 0 22 22" className="h-5 w-5">
        {TOOL_ICONS[tool]}
      </svg>
    </button>
  );
}

// One read-only row of the Info panel.
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="font-mono text-sm text-slate-200">{value}</span>
    </div>
  );
}

export interface PlaygroundControlsProps {
  activeTool: Tool;
  onToolChange: (tool: Tool) => void;
  color: string;
  hue: number;
  onHueChange: (hue: number) => void;
  onColorChange: (color: string) => void;
  onClear: () => void;
  onRandom: () => void;
  onReset: () => void;
  animating: boolean;
  onToggleAnimate: () => void;
  drawnCount: number;
  fps: number;
  frameTime: number;
  resolution: string;
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  speed: number;
  onSpeedChange: (speed: number) => void;
  trail: boolean;
  onTrailChange: (trail: boolean) => void;
}

// Presentational sidebar. Holds no canvas logic of its own so that all drawing
// state stays in one place inside GraphicsPlayground.
export default function PlaygroundControls({
  activeTool,
  onToolChange,
  color,
  hue,
  onHueChange,
  onColorChange,
  onClear,
  onRandom,
  onReset,
  animating,
  onToggleAnimate,
  drawnCount,
  fps,
  frameTime,
  resolution,
  mode,
  onModeChange,
  speed,
  onSpeedChange,
  trail,
  onTrailChange,
}: PlaygroundControlsProps) {
  return (
    <aside className="space-y-4">
      <ControlCard title="Shapes">
        <div className="flex flex-wrap gap-2">
          <ToolButton
            tool="demo"
            label="Demo (klik untuk ganti warna bola)"
            active={activeTool === "demo"}
            onSelect={onToolChange}
          />
          {SHAPE_KINDS.map((kind: ShapeKind) => (
            <ToolButton
              key={kind}
              tool={kind}
              label={SHAPE_LABELS[kind]}
              active={activeTool === kind}
              onSelect={onToolChange}
            />
          ))}
        </div>
        <p className="mt-2 text-xs leading-relaxed text-slate-500">
          {activeTool === "demo"
            ? "Mode demo: klik canvas untuk mengganti warna bola dan menambah circle."
            : `Drag di canvas untuk menggambar ${SHAPE_LABELS[activeTool].toLowerCase()}.`}
        </p>
      </ControlCard>

      <ControlCard title="Color">
        <div className="flex items-center gap-3">
          <span
            className="h-9 w-9 shrink-0 rounded-md border border-slate-700"
            style={{ backgroundColor: color }}
          />
          <input
            type="color"
            value={color}
            onChange={(event) => onColorChange(event.target.value)}
            aria-label="Pilih warna persis"
            className="h-9 w-14 cursor-pointer rounded-md border border-slate-700 bg-slate-800"
          />
          <span className="font-mono text-xs text-slate-400">{color}</span>
        </div>

        {/* Hue slider: the gradient is the full HSL hue wheel laid out flat. */}
        <input
          type="range"
          min={0}
          max={360}
          value={hue}
          onChange={(event) => onHueChange(Number(event.target.value))}
          onPointerUp={(event) => event.currentTarget.blur()}
          aria-label="Hue"
          className="mt-3 h-3 w-full cursor-pointer appearance-none rounded-full"
          style={{
            background:
              "linear-gradient(to right, hsl(0,70%,55%), hsl(60,70%,55%), hsl(120,70%,55%), hsl(180,70%,55%), hsl(240,70%,55%), hsl(300,70%,55%), hsl(360,70%,55%))",
          }}
        />
      </ControlCard>

      <ControlCard title="Actions">
        <div className="flex flex-wrap gap-2">
          <button type="button" className={btnClass} onClick={onClear}>
            Clear ({drawnCount})
          </button>
          <button type="button" className={btnClass} onClick={onRandom}>
            Random
          </button>
          <button type="button" className={btnClass} onClick={onToggleAnimate}>
            {animating ? "Pause (P)" : "Animate (P)"}
          </button>
          <button type="button" className={btnClass} onClick={onReset}>
            Reset (R)
          </button>
        </div>
      </ControlCard>

      <ControlCard title="Info">
        <div className="space-y-1.5">
          <InfoRow label="FPS" value={String(fps)} />
          <InfoRow label="Frame Time" value={`${frameTime.toFixed(2)} ms`} />
          <InfoRow label="Resolution" value={resolution} />
        </div>
      </ControlCard>

      <ControlCard title="Mode translasi keyboard">
        <div className="flex gap-1 rounded-lg border border-slate-700 bg-slate-800/60 p-1">
          <button type="button" className={segClass(mode === "state")} onClick={() => onModeChange("state")}>
            State-based
          </button>
          <button type="button" className={segClass(mode === "event")} onClick={() => onModeChange("event")}>
            Event-based
          </button>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-slate-500">
          {mode === "state"
            ? "keydown/keyup hanya mengubah keys[...]. Translasi dibaca setiap frame di updatePlayer()."
            : "keydown langsung mengubah posisi player. Tahan tombol panah dan rasakan delay/rate keyboard repeat browser."}
        </p>
      </ControlCard>

      <ControlCard title="Kontrol tambahan">
        <label className="block text-xs text-slate-400">
          Speed player: <span className="text-slate-200">{speed}</span>
          <input
            type="range"
            min={1}
            max={10}
            value={speed}
            onChange={(event) => onSpeedChange(Number(event.target.value))}
            onPointerUp={(event) => event.currentTarget.blur()}
            className="mt-1 w-full accent-indigo-500"
          />
        </label>

        <label className="mt-4 flex items-center gap-2 text-xs text-slate-400">
          <input
            type="checkbox"
            checked={trail}
            onChange={(event) => onTrailChange(event.target.checked)}
          />
          Trail mode (canvas tidak di-clear)
        </label>
      </ControlCard>

      <ControlCard title="Keterangan">
        <ul className="space-y-1.5 text-xs text-slate-400">
          <li>Kotak biru, garis merah, lingkaran hijau, segitiga oranye &mdash; primitive statis.</li>
          <li>Bola memantul di dalam batas canvas (velocity + boundary check).</li>
          <li>Circle teal mengikuti posisi mouse.</li>
          <li>Circle kecil di bagian bawah &mdash; beberapa objek bergerak independen.</li>
          <li>Kotak oranye adalah player yang dikendalikan keyboard.</li>
          <li>Keyboard hanya aktif ketika pointer berada di atas canvas.</li>
        </ul>
      </ControlCard>
    </aside>
  );
}
