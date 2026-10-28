"use client";

import { useEffect, useRef, useState } from "react";
import { asset } from "@/lib/asset";
import { createCrateViewer } from "./webgl/viewer.js";
import ViewerControls from "./ViewerControls";

/** Snapshot the viewer sends 10x per second (see frame() in webgl/viewer.js). */
export interface ViewerInfo {
  stage: number;
  loading: { state: "loading" | "loaded" | "error"; stage: number };
  wireframe: boolean;
  xray: boolean;
  camera: "Perspective" | "Orthographic";
  view: "front" | "right" | "top" | "persp" | "custom";
}

export type ViewerActions = ReturnType<typeof createCrateViewer>["actions"];

export default function StageViewer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Bridge for the HTML buttons: they call into the running viewer through this ref.
  const actionsRef = useRef<ViewerActions | null>(null);

  const [supported, setSupported] = useState(true);
  const [info, setInfo] = useState<ViewerInfo | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Shortcuts reach the viewer only while the canvas is hovered or focused.
    let pointerOverCanvas = false;
    let canvasFocused = false;
    const isInputActive = () => pointerOverCanvas || canvasFocused;

    let viewer: ReturnType<typeof createCrateViewer>;
    try {
      viewer = createCrateViewer(canvas, {
        assetBase: asset("/praktikum-9"),
        onInfo: (next: object) => setInfo(next as ViewerInfo),
        isInputActive,
      });
    } catch (error) {
      console.error("[Three.js] WebGL tidak tersedia di browser ini", error);
      // One-off failure path that runs at most once, not a render cascade.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSupported(false);
      return;
    }

    actionsRef.current = viewer.actions;

    const observer = new ResizeObserver(([entry]) => {
      viewer.resize(entry.contentRect.width, entry.contentRect.height);
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

    return () => {
      observer.disconnect();
      canvas.removeEventListener("mouseenter", onMouseEnter);
      canvas.removeEventListener("mouseleave", onMouseLeave);
      canvas.removeEventListener("focus", onFocus);
      canvas.removeEventListener("blur", onBlur);
      viewer.dispose();
      actionsRef.current = null;
    };
  }, []);

  if (!supported) {
    return (
      <div className="rounded-2xl border border-red-900/60 bg-red-950/30 p-10 text-center text-sm text-red-200">
        Browser ini tidak dapat membuat WebGL context, jadi model 3D tidak bisa ditampilkan. Screenshot
        tiap tahap tetap tersedia di bawah.
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
            aria-label="Viewer 3D Sci-Fi Crate per tahap workflow Blender. Drag untuk orbit, scroll untuk zoom. Fokuskan canvas untuk memakai 1–5, Numpad 1/3/7/5/0/titik, W, dan X."
            className="block aspect-[16/10] w-full touch-none rounded-xl border border-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          />
          <div className="pointer-events-none absolute left-2 top-2 rounded-lg border border-sky-400/30 bg-slate-950/70 px-2.5 py-1.5 text-[11px] leading-snug text-slate-200">
            <p className="mb-1 font-semibold text-white">P09_SciFi_Crate.blend</p>
            <p>
              Tahap: <span className="text-sky-300">{info ? info.stage : "-"}</span> / 5
            </p>
            <p>
              View:{" "}
              <span className="text-slate-100">
                {info ? `${info.camera} · ${info.view === "custom" ? "bebas" : info.view}` : "-"}
              </span>
            </p>
            <p>
              Model:{" "}
              <span className="text-slate-100">
                {!info
                  ? "-"
                  : info.loading.state === "loaded"
                    ? "loaded"
                    : info.loading.state === "error"
                      ? "gagal dimuat"
                      : "memuat…"}
              </span>
            </p>
          </div>
        </div>
        <p className="mt-3 text-center text-xs text-slate-500">
          Drag kiri: orbit &middot; drag kanan: pan &middot; scroll: zoom. Model diekspor dari Blender
          (modifier sudah di-apply saat ekspor, file .blend tetap non-destructive).
        </p>
      </div>

      <ViewerControls info={info} actions={actionsRef} />
    </div>
  );
}
