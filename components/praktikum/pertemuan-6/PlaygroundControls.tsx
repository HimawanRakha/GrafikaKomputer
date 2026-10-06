"use client";

import type { RefObject } from "react";
import { ControlCard, btnClass, segClass } from "@/components/ui/controls";
import { SHADOW_QUALITIES } from "@/tugas-6-threejs/src/scene.js";
import type { SceneActions, SceneInfo } from "./ThreeScenePlayground";

export interface PlaygroundControlsProps {
  /** Null until the scene sends its first snapshot (~100 ms after mount). */
  info: SceneInfo | null;
  actions: RefObject<SceneActions | null>;
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

export default function PlaygroundControls({ info, actions }: PlaygroundControlsProps) {
  const position = info?.selectedPosition;

  return (
    <div className="flex flex-col gap-4">
      <ControlCard title="Kamera (C)">
        <div className="flex gap-1 rounded-lg border border-slate-800 bg-slate-950/60 p-1">
          {(["Perspective", "Orthographic"] as const).map((camera) => (
            <button
              key={camera}
              type="button"
              aria-pressed={info?.camera === camera}
              // The scene only exposes a toggle, so it is called only when the
              // clicked option is not already active — radio-button behaviour.
              onClick={() => info?.camera !== camera && actions.current?.toggleCamera()}
              className={segClass(info?.camera === camera)}
            >
              {camera}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs leading-relaxed text-slate-500">
          Orthographic menghilangkan perspektif: object jauh tidak mengecil. Tinggi box-nya disamakan
          dengan frustum perspective di jarak target supaya pergantian tidak membuat scene melompat.
        </p>
      </ControlCard>

      <ControlCard title="Shadow quality (G)">
        <div className="grid grid-cols-3 gap-2">
          {SHADOW_QUALITIES.map((quality, index) => (
            <button
              key={quality.label}
              type="button"
              aria-pressed={info?.shadowIndex === index}
              onClick={() => actions.current?.setShadowQuality(index)}
              className={segClass(info?.shadowIndex === index)}
            >
              {quality.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs leading-relaxed text-slate-500">
          Ukuran shadow map {info ? `${info.shadowMapSize}×${info.shadowMapSize}` : "–"}. Makin kecil,
          makin sedikit pixel yang menutupi area scene, sehingga tepi bayangan tampak bergerigi.
        </p>
      </ControlCard>

      <ControlCard title="Animasi">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            aria-pressed={info?.lightAnimated ?? false}
            onClick={() => actions.current?.toggleLightAnimation()}
            className={segClass(info?.lightAnimated ?? false)}
          >
            Light (L)
          </button>
          <button
            type="button"
            aria-pressed={info ? !info.paused : false}
            onClick={() => actions.current?.toggleAnimation()}
            className={segClass(info ? !info.paused : false)}
          >
            Object (Space)
          </button>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-slate-500">
          Light animation memutar DirectionalLight mengelilingi scene, sehingga arah bayangan ikut
          berputar. Keduanya memakai delta time dari THREE.Clock.
        </p>
      </ControlCard>

      <ControlCard title="Object control (O)">
        <div className="grid grid-cols-2 gap-2">
          {(info?.objectNames ?? []).map((name, index) => (
            <button
              key={name}
              type="button"
              aria-pressed={info?.selectedIndex === index}
              onClick={() => actions.current?.select(index)}
              className={segClass(info?.selectedIndex === index)}
            >
              {name}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs leading-relaxed text-slate-500">
          Object terpilih bersinar kekuningan. Fokuskan canvas lalu gunakan Arrow untuk menggeser,
          Q/E untuk memutar, dan -/= untuk mengubah scale.
        </p>
      </ControlCard>

      <ControlCard title="Aksi">
        <button type="button" onClick={() => actions.current?.reset()} className={`w-full ${btnClass}`}>
          Reset semua (R)
        </button>
      </ControlCard>

      <ControlCard title="Kontrol keyboard">
        <KeyRow keys="O" action="Pilih object berikutnya" />
        <KeyRow keys="Arrow" action="Geser object (X / Z)" />
        <KeyRow keys="Q / E" action="Rotasi object" />
        <KeyRow keys="- / =" action="Scale object" />
        <KeyRow keys="C" action="Perspective ↔ orthographic" />
        <KeyRow keys="L" action="Light animation" />
        <KeyRow keys="G" action="Kualitas shadow" />
        <KeyRow keys="Space" action="Pause animasi object" />
        <KeyRow keys="R" action="Reset semua" />
        <p className="mt-2 text-xs text-slate-500">
          Keyboard hanya aktif saat canvas di-hover atau difokus dengan Tab.
        </p>
      </ControlCard>

      <ControlCard title="HUD — Scene information">
        <HudRow label="FPS" value={info ? info.fps.toFixed(0) : "–"} />
        <HudRow label="Mesh" value={info ? String(info.meshCount) : "–"} />
        <HudRow label="Draw calls" value={info ? String(info.drawCalls) : "–"} />
        <HudRow label="Triangles" value={info ? info.triangles.toLocaleString("id-ID") : "–"} />
        <HudRow label="Kamera" value={info?.camera ?? "–"} />
        <HudRow label="Shadow" value={info?.shadowLabel ?? "–"} />
        <HudRow label="Object terpilih" value={info?.selectedName ?? "–"} />
        <HudRow
          label="Posisi"
          value={
            position ? `(${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)})` : "–"
          }
        />
        <HudRow label="Rotasi Y" value={info ? `${info.selectedRotationDeg.toFixed(0)}°` : "–"} />
        <HudRow label="Scale" value={info ? `${info.selectedScale.toFixed(2)}×` : "–"} />
      </ControlCard>
    </div>
  );
}
