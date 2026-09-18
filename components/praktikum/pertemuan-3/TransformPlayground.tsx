"use client";

import { useEffect, useRef, useState } from "react";
import PlaygroundControls from "./PlaygroundControls";
import {
  createProgram,
  createShader,
  createStaticMesh,
  deleteMesh,
  drawMesh,
  type ProgramLocations,
} from "./webgl/glUtils";
import { FRAGMENT_SHADER_SOURCE, VERTEX_SHADER_SOURCE } from "./webgl/shaders";
import {
  AXIS_VERTICES,
  COLOR_A,
  COLOR_AXIS,
  COLOR_B,
  COLOR_DOOR,
  COLOR_PIVOT,
  DOOR_VERTICES,
  MAX_DELTA_SECONDS,
  MOVE_SPEED,
  OBJECT_A_INITIAL,
  PIVOT_MARKER_VERTEX,
  PRESETS,
  ROTATION_SPEED,
  SCALE_SPEED,
  TRIANGLE_VERTICES,
  clampTransform,
  composeOrderA,
  composeTransform,
  getDoorTransform,
  getObjectBTransform,
  type Transform,
  type TransformOrder,
} from "./webgl/scene";

const CANVAS_WIDTH = 900;
const CANVAS_HEIGHT = 600;

// The HUD is refreshed 10x per second instead of every frame, for the same
// reason Pertemuan 2 throttles its FPS counter: pushing into React state on
// every frame would mean ~60 re-renders per second for numbers a human reads
// at a glance.
const HUD_INTERVAL_MS = 100;

function isFormElement(target: EventTarget | null) {
  return target instanceof HTMLElement && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

interface HudState {
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
}

export default function TransformPlayground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // ---- UI state -------------------------------------------------------
  const [supported, setSupported] = useState(true);
  const [contextLost, setContextLost] = useState(false);
  const [order, setOrder] = useState<TransformOrder>("A");
  const [paused, setPaused] = useState(false);
  const [activePreset, setActivePreset] = useState<number | null>(null);
  const [hud, setHud] = useState<HudState>({
    x: OBJECT_A_INITIAL.x,
    y: OBJECT_A_INITIAL.y,
    rotation: OBJECT_A_INITIAL.rotation,
    scaleX: OBJECT_A_INITIAL.scaleX,
    scaleY: OBJECT_A_INITIAL.scaleY,
  });

  // ---- Refs mirroring state --------------------------------------------
  // The render loop is created once and would otherwise capture the initial
  // values forever (stale closure), so every value it reads lives in a ref.
  const orderRef = useRef(order);
  const pausedRef = useRef(paused);

  useEffect(() => {
    orderRef.current = order;
  }, [order]);
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  // Imperative bridge so HTML buttons can reach actions that live inside the
  // WebGL setup effect.
  const controlsApiRef = useRef<{
    reset: () => void;
    applyPreset: (index: number) => void;
  } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl2");
    if (!gl) {
      console.error("[WebGL] WebGL2 tidak tersedia di browser ini");
      setSupported(false);
      return;
    }

    return setup(canvas, gl);

    // Wrapped in a function so `canvas` and `gl` stay non-null for TypeScript
    // inside every nested declaration below.
    function setup(canvas: HTMLCanvasElement, gl: WebGL2RenderingContext) {
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0.012, 0.043, 0.086, 1.0); // matches the module's #030712 canvas background

      const vertexShader = createShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE);
      const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SOURCE);

      if (!vertexShader || !fragmentShader) {
        if (vertexShader) gl.deleteShader(vertexShader);
        if (fragmentShader) gl.deleteShader(fragmentShader);
        return;
      }

      const program = createProgram(gl, vertexShader, fragmentShader);

      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      if (!program) return;

      gl.useProgram(program);

      const locations: ProgramLocations = {
        position: gl.getAttribLocation(program, "a_position"),
        matrix: gl.getUniformLocation(program, "u_matrix"),
        color: gl.getUniformLocation(program, "u_color"),
        pointSize: gl.getUniformLocation(program, "u_pointSize"),
      };

      // ------------------------------------------------------------------
      // MESHES — uploaded once; only the Model Matrix ever changes after this.
      // ------------------------------------------------------------------
      const triangleMesh = createStaticMesh(gl, TRIANGLE_VERTICES, gl.TRIANGLES);
      const doorMesh = createStaticMesh(gl, DOOR_VERTICES, gl.TRIANGLES);
      const axisMesh = createStaticMesh(gl, AXIS_VERTICES, gl.LINES);
      const pivotMesh = createStaticMesh(gl, PIVOT_MARKER_VERTEX, gl.POINTS);

      if (!triangleMesh || !doorMesh || !axisMesh || !pivotMesh) return;

      // Re-bound into one fresh, never-reassigned object so every nested
      // function declaration below sees non-null types (the same reason
      // `canvas`/`gl` are parameters of setup() rather than outer consts).
      const meshes = { triangle: triangleMesh, door: doorMesh, axis: axisMesh, pivot: pivotMesh };

      // ------------------------------------------------------------------
      // OBJECT A STATE — the only object with mutable, user-controlled data.
      // Object B and the Door are pure functions of time (see webgl/scene.ts).
      // ------------------------------------------------------------------
      const objectA: Transform = { ...OBJECT_A_INITIAL };

      function resetObjectA() {
        Object.assign(objectA, OBJECT_A_INITIAL);
        setActivePreset(null);
      }

      function applyPreset(index: number) {
        const preset = PRESETS[index];
        if (!preset) return;
        Object.assign(objectA, preset.transform);
        setActivePreset(index);
      }

      controlsApiRef.current = { reset: resetObjectA, applyPreset };

      // ------------------------------------------------------------------
      // INPUT STATE
      // ------------------------------------------------------------------
      const keys: Record<string, boolean> = {};
      let pointerOverCanvas = false;
      let canvasFocused = false;
      let rafId = 0;

      /**
       * Keyboard shortcuts are live only while the canvas is hovered or
       * focused — otherwise Arrow/Q/E/R/T/1-3 would fire while the user is
       * scrolling the page or reading the notes further down.
       */
      function isCanvasActive() {
        return pointerOverCanvas || canvasFocused;
      }

      /** Clears every recorded key so a key held while focus leaves never sticks. */
      function releaseAllKeys() {
        for (const key of Object.keys(keys)) keys[key] = false;
      }

      /**
       * Converts a mouse event to NDC (Challenge D). The canvas is displayed
       * responsively, so its CSS size differs from its drawing buffer size —
       * the event position is scaled into drawing-buffer pixels first.
       */
      function toNdc(event: MouseEvent) {
        const rect = canvas.getBoundingClientRect();
        const pixelX = (event.clientX - rect.left) * (canvas.width / rect.width);
        const pixelY = (event.clientY - rect.top) * (canvas.height / rect.height);

        return {
          x: (pixelX / canvas.width) * 2 - 1,
          y: 1 - (pixelY / canvas.height) * 2,
        };
      }

      // Challenge D — click sets Object A's position directly.
      function onClick(event: MouseEvent) {
        const point = toNdc(event);
        objectA.x = point.x;
        objectA.y = point.y;
        clampTransform(objectA);
        setActivePreset(null);
      }

      function onMouseEnter() {
        pointerOverCanvas = true;
      }

      function onMouseLeave() {
        pointerOverCanvas = false;
        if (!isCanvasActive()) releaseAllKeys();
      }

      function onCanvasFocus() {
        canvasFocused = true;
      }

      function onCanvasBlur() {
        canvasFocused = false;
        if (!isCanvasActive()) releaseAllKeys();
      }

      function onKeyDown(event: KeyboardEvent) {
        if (!isCanvasActive() || isFormElement(event.target)) return;

        if (event.code.startsWith("Arrow")) event.preventDefault();

        // State-based: keydown only records that the key is held. The actual
        // change happens once per frame in updateObjectA(), scaled by deltaTime.
        keys[event.code] = true;

        // Event-based: discrete one-shot actions, guarded against key repeat.
        if (!event.repeat) {
          if (event.code === "KeyR") resetObjectA();
          if (event.code === "KeyT") setOrder((value) => (value === "A" ? "B" : "A"));
          if (event.code === "KeyP") setPaused((value) => !value);
          if (event.code === "Digit1") applyPreset(0);
          if (event.code === "Digit2") applyPreset(1);
          if (event.code === "Digit3") applyPreset(2);
        }
      }

      // Deliberately ungated: a key held while the pointer leaves the canvas
      // must still be able to clear itself.
      function onKeyUp(event: KeyboardEvent) {
        keys[event.code] = false;
      }

      function onContextLost(event: Event) {
        event.preventDefault();
        cancelAnimationFrame(rafId);
        console.warn("[WebGL] context lost");
        setContextLost(true);
      }

      canvas.addEventListener("click", onClick);
      canvas.addEventListener("mouseenter", onMouseEnter);
      canvas.addEventListener("mouseleave", onMouseLeave);
      canvas.addEventListener("focus", onCanvasFocus);
      canvas.addEventListener("blur", onCanvasBlur);
      canvas.addEventListener("webglcontextlost", onContextLost);
      window.addEventListener("keydown", onKeyDown);
      window.addEventListener("keyup", onKeyUp);
      window.addEventListener("blur", releaseAllKeys);

      // ------------------------------------------------------------------
      // UPDATE — state-based keyboard control, scaled by deltaTime (seconds)
      // ------------------------------------------------------------------
      function updateObjectA(dt: number) {
        if (keys.ArrowLeft) objectA.x -= MOVE_SPEED * dt;
        if (keys.ArrowRight) objectA.x += MOVE_SPEED * dt;
        if (keys.ArrowUp) objectA.y += MOVE_SPEED * dt;
        if (keys.ArrowDown) objectA.y -= MOVE_SPEED * dt;

        if (keys.KeyQ) objectA.rotation -= ROTATION_SPEED * dt;
        if (keys.KeyE) objectA.rotation += ROTATION_SPEED * dt;

        // Uniform scaling: both axes change together ("=" covers "+" too,
        // since event.code names the physical key regardless of Shift).
        if (keys.Equal) {
          objectA.scaleX += SCALE_SPEED * dt;
          objectA.scaleY += SCALE_SPEED * dt;
        }
        if (keys.Minus) {
          objectA.scaleX -= SCALE_SPEED * dt;
          objectA.scaleY -= SCALE_SPEED * dt;
        }

        // Non-uniform scaling: each axis changes independently.
        if (keys.KeyZ) objectA.scaleX -= SCALE_SPEED * dt;
        if (keys.KeyX) objectA.scaleX += SCALE_SPEED * dt;
        if (keys.KeyC) objectA.scaleY -= SCALE_SPEED * dt;
        if (keys.KeyV) objectA.scaleY += SCALE_SPEED * dt;

        clampTransform(objectA);
      }

      // ------------------------------------------------------------------
      // DRAW
      // ------------------------------------------------------------------
      function draw(seconds: number) {
        gl.clear(gl.COLOR_BUFFER_BIT);

        // Axes: identity matrix, so they stay fixed to the world origin
        // regardless of every other object's transform (module section 53).
        drawMesh(gl, locations, meshes.axis, Mat3Identity, COLOR_AXIS);

        // Door: always composed Scale->Rotate->Translate around its own
        // edge-pivot local origin — this object is about *where* the pivot
        // is, independent of the Order A/B comparison below.
        const doorMatrix = composeOrderA(getDoorTransform(seconds));
        drawMesh(gl, locations, meshes.door, doorMatrix, COLOR_DOOR);
        // Pivot marker: same matrix as the door, drawn at local (0,0) — since
        // rotation and scaling both fix the origin, this point always lands
        // exactly on the door's hinge in world space (module section 54).
        drawMesh(gl, locations, meshes.pivot, doorMatrix, COLOR_PIVOT, 9);

        // Object B: same triangle geometry as Object A, different Model
        // Matrix — the reuse the module asks for.
        const matrixB = composeOrderA(getObjectBTransform(seconds));
        drawMesh(gl, locations, meshes.triangle, matrixB, COLOR_B);

        // Object A: composed with whichever order Challenge C currently has active.
        const matrixA = composeTransform(objectA, orderRef.current);
        drawMesh(gl, locations, meshes.triangle, matrixA, COLOR_A);
      }

      // ------------------------------------------------------------------
      // RENDER LOOP
      // ------------------------------------------------------------------
      let lastTime = performance.now();
      // Scene-time only advances while unpaused, so pausing freezes Object
      // A's controls *and* Object B/Door's automatic animation together.
      let sceneSeconds = 0;
      let hudAccumMs = 0;

      function render(time: number) {
        const dt = Math.min((time - lastTime) * 0.001, MAX_DELTA_SECONDS);
        lastTime = time;

        if (!pausedRef.current) {
          sceneSeconds += dt;
          updateObjectA(dt);
        }

        hudAccumMs += dt * 1000;
        if (hudAccumMs >= HUD_INTERVAL_MS) {
          hudAccumMs = 0;
          setHud({
            x: objectA.x,
            y: objectA.y,
            rotation: objectA.rotation,
            scaleX: objectA.scaleX,
            scaleY: objectA.scaleY,
          });
        }

        draw(sceneSeconds);
        rafId = requestAnimationFrame(render);
      }
      rafId = requestAnimationFrame(render);

      // ------------------------------------------------------------------
      // CLEANUP — GPU resources are not garbage collected with the component.
      // ------------------------------------------------------------------
      return () => {
        cancelAnimationFrame(rafId);

        canvas.removeEventListener("click", onClick);
        canvas.removeEventListener("mouseenter", onMouseEnter);
        canvas.removeEventListener("mouseleave", onMouseLeave);
        canvas.removeEventListener("focus", onCanvasFocus);
        canvas.removeEventListener("blur", onCanvasBlur);
        canvas.removeEventListener("webglcontextlost", onContextLost);
        window.removeEventListener("keydown", onKeyDown);
        window.removeEventListener("keyup", onKeyUp);
        window.removeEventListener("blur", releaseAllKeys);

        deleteMesh(gl, meshes.triangle);
        deleteMesh(gl, meshes.door);
        deleteMesh(gl, meshes.axis);
        deleteMesh(gl, meshes.pivot);
        gl.deleteProgram(program);
        controlsApiRef.current = null;
      };
    }
  }, []);

  if (!supported) {
    return (
      <div className="rounded-2xl border border-red-900/60 bg-red-950/30 p-10 text-center text-sm text-red-200">
        Browser ini tidak menyediakan WebGL2 context. Coba Chrome, Chromium, atau Firefox versi
        terbaru, lalu pastikan hardware acceleration aktif.
      </div>
    );
  }

  if (contextLost) {
    return (
      <div className="rounded-2xl border border-amber-900/60 bg-amber-950/30 p-10 text-center text-sm text-amber-200">
        WebGL context hilang — biasanya karena driver GPU reset atau tab terlalu lama tidak aktif.
        Seluruh buffer dan shader di GPU ikut hilang bersamanya, jadi muat ulang halaman untuk
        membangunnya kembali.
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
        <div className="mx-auto w-full max-w-[900px]">
          {/* tabIndex makes the canvas reachable by Tab, so the keyboard
              controls do not depend on having a mouse to hover with. */}
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            tabIndex={0}
            aria-label="Canvas WebGL transformation playground. Fokuskan canvas ini lalu gunakan Arrow, Q/E, +/-, Z/X, C/V untuk mengubah transform Object A."
            className="block h-auto w-full cursor-crosshair rounded-xl border border-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            style={{ aspectRatio: `${CANVAS_WIDTH} / ${CANVAS_HEIGHT}` }}
          />
        </div>
        <p className="mt-3 text-center text-xs text-slate-500">
          Arahkan pointer ke canvas atau fokuskan dengan Tab, lalu pakai keyboard untuk mengubah
          transform Object A (cyan) &middot; klik canvas untuk memindahkannya langsung.
        </p>
      </div>

      <PlaygroundControls
        order={order}
        onSetOrder={setOrder}
        paused={paused}
        onTogglePause={() => setPaused((value) => !value)}
        onReset={() => controlsApiRef.current?.reset()}
        activePreset={activePreset}
        onApplyPreset={(index) => controlsApiRef.current?.applyPreset(index)}
        position={{ x: hud.x, y: hud.y }}
        rotation={hud.rotation}
        scaleX={hud.scaleX}
        scaleY={hud.scaleY}
      />
    </div>
  );
}

// Module-level constant: identical every frame, so it is created once instead
// of once per draw call.
const Mat3Identity = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);
