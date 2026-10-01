"use client";

import type { RefObject } from "react";
import { ControlCard, btnClass, segClass } from "@/components/ui/controls";
import type { ControlsApi, HudState } from "./LitCubePlayground";
import { WRAP_MODES, type LightingComponents } from "./webgl/scene";

export interface PlaygroundControlsProps {
  hud: HudState;
  api: RefObject<ControlsApi | null>;
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

const COMPONENT_KEYS: [keyof LightingComponents, string, string][] = [
  ["ambient", "Ambient", "1"],
  ["diffuse", "Diffuse", "2"],
  ["specular", "Specular", "3"],
];

export default function PlaygroundControls({ hud, api }: PlaygroundControlsProps) {
  return (
    <div className="flex flex-col gap-4">
      <ControlCard title="Shading">
        <div className="flex gap-1 rounded-lg border border-slate-800 bg-slate-950/60 p-1">
          {(["FLAT", "SMOOTH"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              aria-pressed={hud.shadingMode === mode}
              onClick={() => hud.shadingMode !== mode && api.current?.toggleShading()}
              className={segClass(hud.shadingMode === mode)}
            >
              {mode === "FLAT" ? "Flat (F)" : "Smooth (F)"}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs leading-relaxed text-slate-500">
          {hud.shadingMode === "FLAT"
            ? "Normal mengikuti arah tiap face — batas antar-sisi terlihat tegas."
            : "Normal mengarah dari pusat cube ke tiap sudut — geometry sama, tapi lightingnya tampak lebih membulat."}
        </p>
      </ControlCard>

      <ControlCard title="Scale mode — Challenge D">
        <div className="flex gap-1 rounded-lg border border-slate-800 bg-slate-950/60 p-1">
          {(["UNIFORM", "NON_UNIFORM"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              aria-pressed={hud.scaleMode === mode}
              onClick={() => hud.scaleMode !== mode && api.current?.toggleScaleMode()}
              className={segClass(hud.scaleMode === mode)}
            >
              {mode === "UNIFORM" ? "Uniform (N)" : "Non-uniform (N)"}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs leading-relaxed text-slate-500">
          Non-uniform menskalakan cube ke (1.8, 0.6, 1.0). Normal Matrix tetap menjaga lighting
          masuk akal — bandingkan dengan menonaktifkan diffuse/specular di bawah untuk melihat
          seberapa jauh bentuknya berubah.
        </p>
      </ControlCard>

      <ControlCard title="Texture">
        <p className="mb-1.5 text-xs font-medium text-slate-400">Filtering (T)</p>
        <div className="flex gap-1 rounded-lg border border-slate-800 bg-slate-950/60 p-1">
          {(["NEAREST", "LINEAR"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              aria-pressed={hud.filterMode === mode}
              onClick={() => hud.filterMode !== mode && api.current?.toggleFiltering()}
              className={segClass(hud.filterMode === mode)}
            >
              {mode}
            </button>
          ))}
        </div>

        <p className="mb-1.5 mt-3 text-xs font-medium text-slate-400">Wrapping (G)</p>
        <div className="grid grid-cols-3 gap-1 rounded-lg border border-slate-800 bg-slate-950/60 p-1">
          {WRAP_MODES.map((mode) => (
            <button
              key={mode}
              type="button"
              aria-pressed={hud.wrapMode === mode}
              onClick={() => api.current?.setWrapping(mode)}
              className={`${segClass(hud.wrapMode === mode)} text-[10px]`}
            >
              {mode === "CLAMP_TO_EDGE" ? "CLAMP" : mode === "MIRRORED_REPEAT" ? "MIRROR" : mode}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs leading-relaxed text-slate-500">
          UV scale <span className="font-mono text-slate-300">{hud.uvScale.toFixed(2)}</span> (
          <kbd className="font-mono">[</kbd> / <kbd className="font-mono">]</kbd>) — naikkan di
          atas 1 supaya efek wrapping terlihat jelas di setiap sisi cube.
        </p>
      </ControlCard>

      <ControlCard title="Lighting">
        <div className="grid grid-cols-3 gap-2">
          {COMPONENT_KEYS.map(([key, label, keyLabel]) => (
            <button
              key={key}
              type="button"
              aria-pressed={hud.components[key]}
              onClick={() => api.current?.toggleComponent(key)}
              className={segClass(hud.components[key])}
            >
              {label} ({keyLabel})
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs leading-relaxed text-slate-500">
          Ambient <span className="font-mono text-slate-300">{hud.ambientStrength.toFixed(2)}</span>{" "}
          (<kbd className="font-mono">A</kbd>/<kbd className="font-mono">Z</kbd>) &middot; Shininess{" "}
          <span className="font-mono text-slate-300">{hud.shininess.toFixed(0)}</span> (
          <kbd className="font-mono">-</kbd>/<kbd className="font-mono">+</kbd>)
        </p>
      </ControlCard>

      <ControlCard title="Aksi">
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => api.current?.togglePause()} className={btnClass}>
            {hud.paused ? "Resume (P)" : "Pause (P)"}
          </button>
          <button type="button" onClick={() => api.current?.reset()} className={btnClass}>
            Reset (R)
          </button>
        </div>
      </ControlCard>

      <ControlCard title="Kontrol keyboard">
        <KeyRow keys="Arrow" action="Posisi lampu X / Y" />
        <KeyRow keys="W / S" action="Posisi lampu Z" />
        <KeyRow keys="F" action="Flat / Smooth shading" />
        <KeyRow keys="T" action="Filtering NEAREST / LINEAR" />
        <KeyRow keys="G" action="Ganti wrapping mode" />
        <KeyRow keys="[ / ]" action="UV scale" />
        <KeyRow keys="- / +" action="Shininess" />
        <KeyRow keys="A / Z" action="Ambient strength" />
        <KeyRow keys="N" action="Uniform / non-uniform scale" />
        <KeyRow keys="1 / 2 / 3" action="Toggle ambient/diffuse/specular" />
        <KeyRow keys="P" action="Pause rotasi cube" />
        <KeyRow keys="R" action="Reset semua" />
        <p className="mt-2 text-xs text-slate-500">
          Keyboard hanya aktif saat canvas di-hover atau difokus dengan Tab, supaya tombol panah
          tetap bisa men-scroll halaman di tempat lain.
        </p>
      </ControlCard>

      <ControlCard title="HUD">
        <HudRow label="Shading" value={hud.shadingMode} />
        <HudRow label="Scale mode" value={hud.scaleMode === "UNIFORM" ? "Uniform" : "Non-uniform"} />
        <HudRow label="Filtering" value={hud.filterMode} />
        <HudRow label="Wrapping" value={hud.wrapMode} />
        <HudRow label="UV scale" value={hud.uvScale.toFixed(2)} />
        <HudRow label="Shininess" value={hud.shininess.toFixed(1)} />
        <HudRow label="Ambient" value={hud.ambientStrength.toFixed(2)} />
        <HudRow
          label="Light"
          value={`(${hud.lightPosition.x.toFixed(2)}, ${hud.lightPosition.y.toFixed(2)}, ${hud.lightPosition.z.toFixed(2)})`}
        />
        <HudRow
          label="Komponen aktif"
          value={COMPONENT_KEYS.filter(([key]) => hud.components[key])
            .map(([, label]) => label)
            .join(" + ") || "Tidak ada"}
        />
        <HudRow label="Rotasi cube" value={hud.paused ? "Paused" : "Berjalan"} />
      </ControlCard>
    </div>
  );
}
