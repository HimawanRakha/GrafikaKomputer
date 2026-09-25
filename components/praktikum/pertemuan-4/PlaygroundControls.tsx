"use client";

import type { RefObject } from "react";
import { ControlCard, btnClass, segClass } from "@/components/ui/controls";
import type { ControlsApi, HudState } from "./CameraPlayground";
import {
  FOV_PRESETS,
  NEAR_FAR_PRESETS,
  PROJECTION_LABELS,
  type ProjectionMode,
} from "./webgl/scene";

/** CSS aspect-ratio values, used verbatim as the canvas element's style. */
export type AspectPreset = "21 / 9" | "16 / 10" | "4 / 3" | "1 / 1";

export const ASPECT_PRESETS: AspectPreset[] = ["21 / 9", "16 / 10", "4 / 3", "1 / 1"];

export interface PlaygroundControlsProps {
  hud: HudState;
  api: RefObject<ControlsApi | null>;
  aspectPreset: AspectPreset;
  onSetAspectPreset: (preset: AspectPreset) => void;
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
  hud,
  api,
  aspectPreset,
  onSetAspectPreset,
}: PlaygroundControlsProps) {
  const nearFar = NEAR_FAR_PRESETS[hud.nearFarIndex];

  return (
    <div className="flex flex-col gap-4">
      <ControlCard title="Proyeksi">
        <div className="flex gap-1 rounded-lg border border-slate-800 bg-slate-950/60 p-1">
          {(["perspective", "orthographic"] as ProjectionMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              aria-pressed={hud.projection === mode}
              onClick={() => api.current?.setProjection(mode)}
              className={segClass(hud.projection === mode)}
            >
              {PROJECTION_LABELS[mode]}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs leading-relaxed text-slate-500">
          {hud.projection === "perspective"
            ? "Cube yang jauh tampak lebih kecil — clip w membawa nilai −z, sehingga perspective divide mengecilkan object sesuai kedalamannya."
            : "Ukuran tidak lagi bergantung jarak — w tetap 1, jadi perspective divide tidak melakukan apa-apa. Tinggi box-nya disamakan dengan frustum di jarak target supaya pergantian tidak membuat scene melompat."}
        </p>
      </ControlCard>

      <ControlCard title="Field of view">
        <div className="grid grid-cols-3 gap-2">
          {FOV_PRESETS.map((preset, index) => (
            <button
              key={preset}
              type="button"
              aria-pressed={Math.round(hud.fov) === preset}
              onClick={() => api.current?.applyFovPreset(index)}
              className={segClass(Math.round(hud.fov) === preset)}
            >
              {preset}&deg;
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs leading-relaxed text-slate-500">
          FOV aktif <span className="font-mono text-slate-300">{hud.fov.toFixed(1)}&deg;</span> —
          atur halus dengan <kbd className="font-mono">[</kbd> dan <kbd className="font-mono">]</kbd>.
          FOV besar memperluas frustum sehingga cube tampak menjauh dan sisi-sisinya melebar.
        </p>
      </ControlCard>

      <ControlCard title="Near / far plane">
        <div className="grid gap-2">
          {NEAR_FAR_PRESETS.map((preset, index) => (
            <button
              key={preset.label}
              type="button"
              aria-pressed={hud.nearFarIndex === index}
              onClick={() => api.current?.setNearFar(index)}
              className={segClass(hud.nearFarIndex === index)}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs leading-relaxed text-slate-500">
          Preset ketiga sengaja sempit: cube yang melewati batas akan terpotong rata, memperlihatkan
          bahwa clipping terjadi pada bidang datar, bukan pada jarak dari kamera.
        </p>
      </ControlCard>

      <ControlCard title="Depth test">
        <button
          type="button"
          aria-pressed={hud.depthTest}
          onClick={() => api.current?.toggleDepthTest()}
          className={`w-full ${segClass(hud.depthTest)}`}
        >
          {hud.depthTest ? "Depth test ON (D)" : "Depth test OFF (D)"}
        </button>
        <p className="mt-2 text-xs leading-relaxed text-slate-500">
          Ketiga cube digambar dari yang terdekat ke terjauh. Saat depth test dimatikan, cube
          belakang menimpa cube depan karena yang menang adalah yang digambar terakhir — inilah
          masalah yang depth buffer selesaikan.
        </p>
      </ControlCard>

      <ControlCard title="Kamera">
        <button
          type="button"
          aria-pressed={hud.orbit}
          onClick={() => api.current?.toggleOrbit()}
          className={`mb-2 w-full ${segClass(hud.orbit)}`}
        >
          {hud.orbit ? "Orbit camera ON (O)" : "Orbit camera OFF (O)"}
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => api.current?.togglePause()} className={btnClass}>
            {hud.paused ? "Resume (Space)" : "Pause (Space)"}
          </button>
          <button type="button" onClick={() => api.current?.reset()} className={btnClass}>
            Reset (R)
          </button>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-slate-500">
          {hud.orbit
            ? "Arrow memutar kamera mengelilingi target pada radius tetap, W/S mengubah radius. Kamera selalu menghadap target."
            : "Arrow menggeser posisi kamera pada sumbu X/Y dunia, W/S pada sumbu Z. Target tetap, jadi arah pandang ikut berubah."}
        </p>
      </ControlCard>

      <ControlCard title="Aspect ratio canvas">
        <div className="grid grid-cols-4 gap-2">
          {ASPECT_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              aria-pressed={aspectPreset === preset}
              onClick={() => onSetAspectPreset(preset)}
              className={segClass(aspectPreset === preset)}
            >
              {preset.replace(/ /g, "")}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs leading-relaxed text-slate-500">
          Mengubah ukuran canvas, bukan proyeksinya. Cube tetap proporsional karena aspect dibaca
          ulang dari drawing buffer tiap frame lalu dimasukkan ke projection matrix.
        </p>
      </ControlCard>

      <ControlCard title="Kontrol keyboard">
        <KeyRow keys="Arrow" action={hud.orbit ? "Azimuth / elevation" : "Kamera X / Y"} />
        <KeyRow keys="W / S" action={hud.orbit ? "Radius orbit" : "Kamera Z"} />
        <KeyRow keys="P" action="Ganti proyeksi" />
        <KeyRow keys="[ / ]" action="FOV turun / naik" />
        <KeyRow keys="1 / 2 / 3" action="Preset FOV 35/60/90" />
        <KeyRow keys="N" action="Preset near / far" />
        <KeyRow keys="D" action="Depth test ON/OFF" />
        <KeyRow keys="O" action="Orbit camera ON/OFF" />
        <KeyRow keys="Space" action="Pause rotasi cube" />
        <KeyRow keys="R" action="Reset semua" />
        <p className="mt-2 text-xs text-slate-500">
          Keyboard hanya aktif saat canvas di-hover atau difokus dengan Tab, supaya tombol panah
          tetap bisa men-scroll halaman di tempat lain.
        </p>
      </ControlCard>

      <ControlCard title="HUD">
        <HudRow
          label="Camera"
          value={`(${hud.camera.x.toFixed(2)}, ${hud.camera.y.toFixed(2)}, ${hud.camera.z.toFixed(2)})`}
        />
        <HudRow
          label="Target"
          value={`(${hud.target.x.toFixed(2)}, ${hud.target.y.toFixed(2)}, ${hud.target.z.toFixed(2)})`}
        />
        {hud.orbit ? (
          <HudRow
            label="Orbit"
            value={`az ${hud.azimuth.toFixed(0)}° · el ${hud.elevation.toFixed(0)}° · r ${hud.radius.toFixed(2)}`}
          />
        ) : null}
        <HudRow label="Projection" value={PROJECTION_LABELS[hud.projection]} />
        <HudRow label="FOV" value={`${hud.fov.toFixed(1)}°`} />
        <HudRow label="Near / far" value={`${nearFar.near} / ${nearFar.far}`} />
        <HudRow label="Depth test" value={hud.depthTest ? "ON" : "OFF"} />
        <HudRow
          label="Drawing buffer"
          value={`${hud.drawingBuffer.width}×${hud.drawingBuffer.height}`}
        />
        <HudRow label="Aspect" value={hud.aspect.toFixed(3)} />
        <HudRow label="Rotasi cube" value={hud.paused ? "Paused" : "Berjalan"} />
      </ControlCard>
    </div>
  );
}
