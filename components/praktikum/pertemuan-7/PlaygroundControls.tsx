"use client";

import type { RefObject } from "react";
import { ControlCard, btnClass, segClass } from "@/components/ui/controls";
import { PBR_PRESETS } from "./webgl/scene.js";
import type { SceneActions, SceneInfo } from "./InteractivePlayground";

export interface PlaygroundControlsProps {
  /** Null until the scene sends its first snapshot (~100 ms after mount). */
  info: SceneInfo | null;
  actions: RefObject<SceneActions | null>;
}

type Vec3Plain = { x: number; y: number; z: number };

const vec = (v: Vec3Plain, digits = 2) => `(${v.x.toFixed(digits)}, ${v.y.toFixed(digits)}, ${v.z.toFixed(digits)})`;

/** One label/value row inside a HUD card. */
function HudRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span className="shrink-0 text-xs text-slate-400">{label}</span>
      <span className="text-right font-mono text-xs text-slate-100">{value}</span>
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

export default function PlaygroundControls({ info, actions }: PlaygroundControlsProps) {
  const selected = info?.selected ?? null;

  return (
    <div className="flex flex-col gap-4">
      {/* Challenge C — information panel for the selected entity. */}
      <ControlCard title="Information panel">
        {selected ? (
          <>
            <HudRow label="Label" value={selected.label} />
            <HudRow label="Name / jenis" value={`${selected.name} · ${selected.kind}`} />
            <HudRow label="Position (local)" value={vec(selected.position)} />
            <HudRow label="Position (world)" value={vec(selected.worldPosition)} />
            <HudRow label="Rotation" value={vec(selected.rotationDeg, 0) + "°"} />
            <HudRow label="Scale" value={vec(selected.scale)} />
            <HudRow label="Material" value={selected.material} />
            <button
              type="button"
              onClick={() => actions.current?.clearSelection()}
              className={`mt-2 w-full ${btnClass}`}
            >
              Batalkan pilihan (Esc)
            </button>
          </>
        ) : (
          <p className="text-xs leading-relaxed text-slate-500">
            Klik object di canvas — robot GLB, hierarchy group, PBR sphere, bola galeri, atau tata
            surya. Drag tidak mengubah pilihan.
          </p>
        )}
      </ControlCard>

      {/* Challenge A — one AnimationMixer, several AnimationActions. */}
      <ControlCard title="Animation clip (1 / 2 / 3)">
        {info && info.clips.length > 0 ? (
          <div className="grid grid-cols-3 gap-2">
            {info.clips.map((clip, index) => (
              <button
                key={clip}
                type="button"
                aria-pressed={info.activeClipIndex === index}
                onClick={() => actions.current?.playClip(index)}
                className={segClass(info.activeClipIndex === index)}
              >
                {clip}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-500">Menunggu GLB selesai dimuat…</p>
        )}
        <p className="mt-2 text-xs leading-relaxed text-slate-500">
          Pergantian clip memakai crossfade 0,35 detik. Wave diputar sekali lalu kembali ke clip loop
          sebelumnya — sama seperti saat robot diklik.
        </p>
      </ControlCard>

      <ControlCard title="PBR sphere (M)">
        <div className="grid grid-cols-5 gap-1">
          {PBR_PRESETS.map((preset, index) => (
            <button
              key={preset.label}
              type="button"
              aria-pressed={info?.pbrPresetIndex === index}
              onClick={() => actions.current?.setPbrPreset(index)}
              className={segClass(info?.pbrPresetIndex === index)}
            >
              {preset.label === "Default" ? "Awal" : preset.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs leading-relaxed text-slate-500">
          {info
            ? `roughness ${info.pbrPreset.roughness.toFixed(2)} · metalness ${info.pbrPreset.metalness.toFixed(2)}`
            : "–"}{" "}
          — warna sama, karakter permukaan berbeda. Bandingkan C (metal halus) dengan environment
          dimatikan.
        </p>
      </ControlCard>

      <ControlCard title="Environment & kamera">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            aria-pressed={info?.environment ?? false}
            onClick={() => actions.current?.toggleEnvironment()}
            className={segClass(info?.environment ?? false)}
          >
            {info?.environment === false ? "Env OFF (E)" : "Env ON (E)"}
          </button>
          <button
            type="button"
            onClick={() => actions.current?.toggleCamera()}
            className={btnClass}
          >
            {info?.camera === "Orthographic" ? "Ortho (C)" : "Persp (C)"}
          </button>
        </div>
        <button type="button" onClick={() => actions.current?.reset()} className={`mt-2 w-full ${btnClass}`}>
          Reset semua (R)
        </button>
        <p className="mt-2 text-xs leading-relaxed text-slate-500">
          scene.environment menyinari dan memantul pada material tanpa terlihat sebagai latar —
          background tetap warna polos.
        </p>
      </ControlCard>

      <ControlCard title="Kontrol">
        <KeyRow keys="Drag kiri" action="Orbit" />
        <KeyRow keys="Drag kanan" action="Pan" />
        <KeyRow keys="Scroll" action="Zoom (3–25 / 0.5–3×)" />
        <KeyRow keys="Klik" action="Pilih object" />
        <KeyRow keys="1 / 2 / 3" action="Clip Idle / Walk / Wave" />
        <KeyRow keys="E" action="Environment ON/OFF" />
        <KeyRow keys="C" action="Perspective ↔ ortho" />
        <KeyRow keys="M" action="Preset PBR sphere" />
        <KeyRow keys="Esc" action="Batalkan pilihan" />
        <KeyRow keys="R" action="Reset semua" />
      </ControlCard>

      <ControlCard title="HUD — scene">
        <HudRow label="FPS" value={info ? info.fps.toFixed(0) : "–"} />
        <HudRow label="Kamera" value={info ? `${info.camera} · ${info.camera === "Perspective" ? `jarak ${info.distance.toFixed(1)}` : `zoom ${info.zoom.toFixed(2)}×`}` : "–"} />
        <HudRow label="Pointer NDC" value={info?.pointer ? `(${info.pointer.x.toFixed(2)}, ${info.pointer.y.toFixed(2)})` : "di luar canvas"} />
        <HudRow label="Child local" value={info ? vec(info.childLocal) : "–"} />
        <HudRow label="Child world" value={info ? vec(info.childWorld) : "–"} />
        <HudRow
          label="GLB"
          value={info?.model ? `${info.model.meshCount} mesh · ${info.model.nodeCount} node · kedalaman ${info.model.depth}` : "–"}
        />
      </ControlCard>
    </div>
  );
}
