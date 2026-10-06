"use client";

import { useEffect, useRef, useState } from "react";
// The scene itself lives in the standalone Vite project, so the code that is
// submitted and the code shown in the portal are one and the same file.
import { createMiniScene } from "@/tugas-6-threejs/src/scene.js";
import PlaygroundControls from "./PlaygroundControls";

/** Snapshot the scene sends 10x per second (see buildInfo() in scene.js). */
export interface SceneInfo {
  fps: number;
  meshCount: number;
  drawCalls: number;
  triangles: number;
  camera: "Perspective" | "Orthographic";
  shadowIndex: number;
  shadowLabel: string;
  shadowMapSize: number;
  lightAnimated: boolean;
  paused: boolean;
  selectedIndex: number;
  selectedName: string;
  selectedPosition: { x: number; y: number; z: number };
  selectedRotationDeg: number;
  selectedScale: number;
  objectNames: string[];
}

export type SceneActions = ReturnType<typeof createMiniScene>["actions"];

export default function ThreeScenePlayground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Bridge for the HTML buttons: they call into the running scene through this ref.
  const actionsRef = useRef<SceneActions | null>(null);

  const [supported, setSupported] = useState(true);
  const [info, setInfo] = useState<SceneInfo | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Keyboard reaches the scene only while the canvas is hovered or focused,
    // so Arrow keys still scroll the rest of the page.
    let pointerOverCanvas = false;
    let canvasFocused = false;
    const isInputActive = () => pointerOverCanvas || canvasFocused;

    let miniScene: ReturnType<typeof createMiniScene>;
    try {
      miniScene = createMiniScene(canvas, {
        onInfo: (next: object) => setInfo(next as SceneInfo),
        isInputActive,
      });
    } catch (error) {
      // THREE.WebGLRenderer throws when the browser cannot create a WebGL context.
      console.error("[Three.js] WebGL tidak tersedia di browser ini", error);
      // One-off failure path, not a render cascade: it runs at most once, and only
      // when the browser cannot create a WebGL context at all.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSupported(false);
      return;
    }

    actionsRef.current = miniScene.actions;

    // The canvas is sized by CSS inside the page layout rather than the whole
    // window, so its own size is observed instead of the window's resize event.
    const observer = new ResizeObserver(([entry]) => {
      miniScene.resize(entry.contentRect.width, entry.contentRect.height);
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

    // Cleanup: stop the loop and free GPU memory — React Strict Mode mounts,
    // unmounts and remounts in development, so this runs at least once per visit.
    return () => {
      observer.disconnect();
      canvas.removeEventListener("mouseenter", onMouseEnter);
      canvas.removeEventListener("mouseleave", onMouseLeave);
      canvas.removeEventListener("focus", onFocus);
      canvas.removeEventListener("blur", onBlur);
      miniScene.dispose();
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
        <canvas
          ref={canvasRef}
          tabIndex={0}
          aria-label="Mini scene 3D Three.js. Fokuskan canvas ini lalu gunakan O, Arrow, Q/E, -/=, C, L, G, Space, dan R."
          className="block aspect-[16/10] w-full rounded-xl border border-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        />
        <p className="mt-3 text-center text-xs text-slate-500">
          Arahkan pointer ke canvas atau fokuskan dengan Tab, lalu pakai keyboard &middot; versi
          layar penuh ada di folder <code className="text-slate-400">tugas-6-threejs/</code> (
          <code className="text-slate-400">npm run dev</code>).
        </p>
      </div>

      <PlaygroundControls info={info} actions={actionsRef} />
    </div>
  );
}
