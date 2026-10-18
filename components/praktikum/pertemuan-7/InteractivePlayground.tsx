"use client";

import { useEffect, useRef, useState } from "react";
import { createInteractiveScene } from "./webgl/scene.js";
import PlaygroundControls from "./PlaygroundControls";

type Vec3Plain = { x: number; y: number; z: number };

/** Snapshot the scene sends 10x per second (see buildInfo() in webgl/scene.js). */
export interface SceneInfo {
  fps: number;
  loading: { state: "loading" | "loaded" | "error"; percent: number };
  hoverLabel: string | null;
  selected: {
    label: string;
    name: string;
    kind: "Imported GLB" | "Mesh" | "Group";
    position: Vec3Plain;
    worldPosition: Vec3Plain;
    rotationDeg: Vec3Plain;
    scale: Vec3Plain;
    material: string;
  } | null;
  clips: string[];
  activeClip: string | null;
  activeClipIndex: number;
  environment: boolean;
  camera: "Perspective" | "Orthographic";
  zoom: number;
  distance: number;
  pbrPresetIndex: number;
  pbrPreset: { label: string; roughness: number; metalness: number };
  pointer: { x: number; y: number } | null;
  childLocal: Vec3Plain;
  childWorld: Vec3Plain;
  model: { rootName: string; nodeCount: number; meshCount: number; depth: number; meshNames: string[] } | null;
}

export type SceneActions = ReturnType<typeof createInteractiveScene>["actions"];

/** Served from public/praktikum-7/; regenerate with `npm run build:model:p7`. */
const MODEL_URL = "/praktikum-7/robot.glb";

export default function InteractivePlayground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Bridge for the HTML buttons: they call into the running scene through this ref.
  const actionsRef = useRef<SceneActions | null>(null);

  const [supported, setSupported] = useState(true);
  const [info, setInfo] = useState<SceneInfo | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Keyboard reaches the scene only while the canvas is hovered or focused,
    // so typing or pressing R elsewhere on the page does nothing to it.
    let pointerOverCanvas = false;
    let canvasFocused = false;
    const isInputActive = () => pointerOverCanvas || canvasFocused;

    let interactive: ReturnType<typeof createInteractiveScene>;
    try {
      interactive = createInteractiveScene(canvas, {
        modelUrl: MODEL_URL,
        onInfo: (next: object) => setInfo(next as SceneInfo),
        isInputActive,
      });
    } catch (error) {
      // THREE.WebGLRenderer throws when the browser cannot create a WebGL context.
      console.error("[Three.js] WebGL tidak tersedia di browser ini", error);
      // One-off failure path that runs at most once, not a render cascade.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSupported(false);
      return;
    }

    actionsRef.current = interactive.actions;

    // The canvas is sized by the page layout, not the window, so its own size is observed.
    const observer = new ResizeObserver(([entry]) => {
      interactive.resize(entry.contentRect.width, entry.contentRect.height);
    });
    observer.observe(canvas);

    const onMouseEnter = () => (pointerOverCanvas = true);
    const onMouseLeave = () => (pointerOverCanvas = false);
    const onFocus = () => (canvasFocused = true);
    const onBlur = () => (canvasFocused = false);

    canvas.addEventListener("mouseenter", onMouseEnter);
    canvas.addEventListener("mouseleave", onMouseLeave);
    canvas.addEventListener("focus", onFocus);
    canvas.addEventListener("blur", onBlur);

    // React Strict Mode mounts, unmounts and remounts in development, so this
    // runs at least once per visit — including while the GLB is still loading.
    return () => {
      observer.disconnect();
      canvas.removeEventListener("mouseenter", onMouseEnter);
      canvas.removeEventListener("mouseleave", onMouseLeave);
      canvas.removeEventListener("focus", onFocus);
      canvas.removeEventListener("blur", onBlur);
      interactive.dispose();
      actionsRef.current = null;
    };
  }, []);

  if (!supported) {
    return (
      <div className="rounded-2xl border border-red-900/60 bg-red-950/30 p-10 text-center text-sm text-red-200">
        Browser ini tidak dapat membuat WebGL context, jadi Three.js tidak bisa merender scene. Coba
        Chrome, Chromium, atau Firefox versi terbaru, lalu pastikan hardware acceleration aktif.
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
        <div className="relative">
          <canvas
            ref={canvasRef}
            tabIndex={0}
            aria-label="Prototype 3D interaktif Three.js. Drag untuk orbit, scroll untuk zoom, klik object untuk memilih. Fokuskan canvas untuk memakai 1/2/3, E, C, M, Esc, dan R."
            className="block aspect-[16/10] w-full touch-none rounded-xl border border-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          />
          {/* Section 7's on-canvas HUD: pointer-events none so it never blocks a click. */}
          <div className="pointer-events-none absolute left-3 top-3 min-w-[200px] rounded-lg border border-sky-400/30 bg-slate-950/80 px-3 py-2 text-xs text-slate-200">
            <p className="mb-1 font-semibold text-white">Interactive 3D Prototype</p>
            <p>
              Hover: <span className="text-sky-300">{info?.hoverLabel ?? "-"}</span>
            </p>
            <p>
              Selected: <span className="text-amber-300">{info?.selected?.label ?? "-"}</span>
            </p>
            <p>
              Animation: <span className="text-slate-100">{info?.activeClip ?? "-"}</span>
            </p>
            <p>
              Loading:{" "}
              <span className="text-slate-100">
                {!info
                  ? "-"
                  : info.loading.state === "loaded"
                    ? "model loaded"
                    : info.loading.state === "error"
                      ? "load failed"
                      : `${info.loading.percent}%`}
              </span>
            </p>
          </div>
        </div>
        <p className="mt-3 text-center text-xs text-slate-500">
          Drag kiri: orbit &middot; drag kanan: pan &middot; scroll: zoom &middot; klik: pilih object
          (klik robot untuk melambai). Arahkan pointer ke canvas atau fokuskan dengan Tab untuk
          shortcut keyboard.
        </p>
      </div>

      <PlaygroundControls info={info} actions={actionsRef} />
    </div>
  );
}
