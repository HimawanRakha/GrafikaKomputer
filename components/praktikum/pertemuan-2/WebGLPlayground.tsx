"use client";

import { useEffect, useRef, useState } from "react";
import PlaygroundControls from "./PlaygroundControls";
import {
  createDrawable,
  createProgram,
  createShader,
  deleteDrawable,
  drawDrawable,
  setDrawableColor,
  uploadPositions,
  type Drawable,
  type ProgramLocations,
} from "./webgl/glUtils";
import { FRAGMENT_SHADER_SOURCE, VERTEX_SHADER_SOURCE } from "./webgl/shaders";
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  PALETTE,
  buildGradientRectangle,
  buildGradientTriangle,
  buildMovers,
  buildPointGrid,
  buildStar,
  hexToRgb,
  makeSolidTriangle,
  makeSpawnGeometry,
  randomPaletteColor,
  type DrawMode,
  type MoverSpec,
} from "./webgl/scene";

// The HUD is refreshed 4x per second instead of every frame. Pushing FPS into
// React state on each frame would trigger ~60 re-renders per second and drag
// down the very number being measured.
const INFO_INTERVAL_MS = 250;

// Movement is expressed per 60fps frame, then scaled by the real frame delta so
// the scene runs at the same speed on 60Hz and 144Hz displays.
const TARGET_FRAME_MS = 1000 / 60;

const DEFAULT_SPEED = 0.014;

// Every primitive spawned by clicking keeps two GPU buffers and one draw call
// per frame for as long as it exists, so the list is capped and recycled.
const MAX_SPAWNED = 200;

/**
 * Movement keys listed by physical key *code* rather than by `event.key`.
 *
 * `event.key` reports the character produced, which changes with Shift and
 * CapsLock: a key pressed as "d" but released as "D" would leave its keydown
 * entry set forever and the player would never stop moving. `event.code`
 * names the physical key, so keydown and keyup always match.
 */
const MOVEMENT_CODES = [
  "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown",
  "KeyA", "KeyD", "KeyW", "KeyS",
];

/** Bounding box of a set of NDC vertex positions, used for bouncing and clamping. */
function measureBounds(positions: Float32Array) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (let i = 0; i < positions.length; i += 2) {
    minX = Math.min(minX, positions[i]);
    maxX = Math.max(maxX, positions[i]);
    minY = Math.min(minY, positions[i + 1]);
    maxY = Math.max(maxY, positions[i + 1]);
  }

  return { minX, maxX, minY, maxY };
}

type Bounds = ReturnType<typeof measureBounds>;

/** A bouncing object plus the data needed to move and reset it. */
interface Mover {
  drawable: Drawable;
  /** Measured once from the untranslated vertices; the shape never changes. */
  bounds: Bounds;
  /** Starting position and velocity, replayed on reset. */
  spec: MoverSpec;
}

function isFormElement(target: EventTarget | null) {
  return target instanceof HTMLElement && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

export default function WebGLPlayground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // ---- UI state -----------------------------------------------------------
  const [supported, setSupported] = useState(true);
  const [contextLost, setContextLost] = useState(false);
  const [drawMode, setDrawMode] = useState<DrawMode>("TRIANGLES");
  const [color, setColor] = useState(PALETTE[0]);
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState(DEFAULT_SPEED);
  const [info, setInfo] = useState({
    fps: 0,
    frameTime: 0,
    spawnedCount: 0,
    primitiveCount: 0,
    vertexCount: 0,
    mouseNdc: { x: 0, y: 0 },
  });

  // ---- Refs mirroring state ----------------------------------------------
  // The render loop is created once and would otherwise capture the initial
  // values forever (stale closure), so every value it reads lives in a ref.
  const drawModeRef = useRef(drawMode);
  const colorRef = useRef(color);
  const pausedRef = useRef(paused);
  const speedRef = useRef(speed);

  useEffect(() => {
    drawModeRef.current = drawMode;
  }, [drawMode]);
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);
  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  // Imperative bridge so HTML buttons can reach actions that live inside the
  // WebGL setup effect.
  const controlsApiRef = useRef<{
    reset: () => void;
    clearSpawned: () => void;
    setPlayerColor: (hex: string) => void;
  } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // --------------------------------------------------------------------
    // initializeWebGL()
    // --------------------------------------------------------------------
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
      // Maps the clip-space output of the pipeline onto the framebuffer.
      gl.viewport(0, 0, canvas.width, canvas.height);
      // Non-default background (module section 9).
      gl.clearColor(0.04, 0.06, 0.12, 1.0);

      // ------------------------------------------------------------------
      // createShaders() + createProgram()
      // ------------------------------------------------------------------
      const vertexShader = createShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE);
      const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SOURCE);

      // One stage can compile while the other fails, so release whichever
      // succeeded instead of leaving an orphaned shader object behind.
      if (!vertexShader || !fragmentShader) {
        if (vertexShader) gl.deleteShader(vertexShader);
        if (fragmentShader) gl.deleteShader(fragmentShader);
        return;
      }

      const program = createProgram(gl, vertexShader, fragmentShader);

      // The linked program keeps its own copy of the compiled stages, so the
      // shader objects can be released immediately after linking.
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      if (!program) return;

      gl.useProgram(program);

      const locations: ProgramLocations = {
        position: gl.getAttribLocation(program, "a_position"),
        color: gl.getAttribLocation(program, "a_color"),
        pointSize: gl.getUniformLocation(program, "u_pointSize"),
      };

      // ------------------------------------------------------------------
      // createBuffers()
      // ------------------------------------------------------------------
      const playerBase = makeSolidTriangle(0, 0, 0.07, 0.09, hexToRgb(colorRef.current));

      const showcase: Drawable[] = [];

      // Static objects: uploaded once with STATIC_DRAW.
      // The rectangle is kept in its own binding because the draw mode selector
      // redraws it on demand — see draw().
      const modeDemo = createDrawable(gl, "Gradient rectangle", buildGradientRectangle());
      const statics = [
        createDrawable(gl, "Gradient triangle", buildGradientTriangle()),
        modeDemo,
        createDrawable(gl, "Star (LINE_LOOP)", buildStar()),
        createDrawable(gl, "Point grid", buildPointGrid(), { pointSize: 10 }),
      ];

      // Challenge D — three moving objects, each with its own starting
      // position, speed and direction. Re-uploaded every frame with
      // DYNAMIC_DRAW because translation here means rewriting vertices.
      const movers: Mover[] = [];
      for (const spec of buildMovers()) {
        const drawable = createDrawable(gl, spec.label, spec.geometry, {
          dynamic: true,
          offsetX: spec.offsetX,
          offsetY: spec.offsetY,
          velocityX: spec.velocityX,
          velocityY: spec.velocityY,
        });

        if (drawable) {
          movers.push({ drawable, bounds: measureBounds(spec.geometry.positions), spec });
        }
      }

      const player = createDrawable(gl, "Player", playerBase, {
        dynamic: true,
        offsetY: -0.88,
      });

      for (const item of [...statics, ...movers.map((mover) => mover.drawable), player]) {
        if (item) showcase.push(item);
      }

      // Primitives created by clicking the canvas (Challenge C).
      const spawned: Drawable[] = [];

      const playerBounds = measureBounds(playerBase.positions);

      // ------------------------------------------------------------------
      // RUNTIME STATE
      // ------------------------------------------------------------------
      const keys: Record<string, boolean> = {};
      const mouseNdc = { x: 0, y: 0 };
      let pointerOverCanvas = false;
      let canvasFocused = false;
      let rafId = 0;

      /**
       * Keyboard shortcuts are live only while the canvas is hovered or focused.
       *
       * Hover alone would lock out anyone navigating without a mouse, and an
       * always-on listener would let R/C/P fire while the user is reading the
       * notes further down the page.
       */
      function isCanvasActive() {
        return pointerOverCanvas || canvasFocused;
      }

      let lastTime = performance.now();
      let frameTimeAccum = 0;
      let frameCount = 0;
      let infoAccum = 0;

      // ------------------------------------------------------------------
      // ACTIONS exposed to the control panel
      // ------------------------------------------------------------------
      function resetScene() {
        // Velocities are restored too, not just positions — a mover that has
        // already bounced carries a flipped sign that would otherwise persist.
        for (const { drawable, spec } of movers) {
          drawable.offsetX = spec.offsetX;
          drawable.offsetY = spec.offsetY;
          drawable.velocityX = spec.velocityX;
          drawable.velocityY = spec.velocityY;
        }

        if (player) {
          player.offsetX = 0;
          player.offsetY = -0.88;
        }
      }

      function clearSpawned() {
        for (const item of spawned) deleteDrawable(gl, item);
        spawned.length = 0;
      }

      function setPlayerColor(hex: string) {
        if (player) setDrawableColor(gl, player, hexToRgb(hex));
      }

      controlsApiRef.current = { reset: resetScene, clearSpawned, setPlayerColor };

      /** Clears every recorded key. Without this a key held while the window
       *  loses focus never receives its keyup and the player drifts forever. */
      function releaseAllKeys() {
        for (const key of Object.keys(keys)) keys[key] = false;
      }

      // ------------------------------------------------------------------
      // INPUT
      // ------------------------------------------------------------------
      /**
       * Converts a mouse event to NDC.
       *
       * The canvas is displayed responsively, so its CSS size differs from its
       * drawing buffer size. The event position is first scaled into drawing
       * buffer pixels, then mapped to -1..1. Y is flipped because page pixels
       * grow downwards while NDC grows upwards.
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

      function onMouseMove(event: MouseEvent) {
        const point = toNdc(event);
        mouseNdc.x = point.x;
        mouseNdc.y = point.y;
      }

      // Challenge C — spawn a primitive at the click position.
      function onClick(event: MouseEvent) {
        const point = toNdc(event);
        const geometry = makeSpawnGeometry(
          drawModeRef.current,
          point.x,
          point.y,
          hexToRgb(colorRef.current),
        );
        const drawable = createDrawable(gl, "Spawned", geometry, { pointSize: 9 });
        if (!drawable) return;

        // Recycle oldest-first once the cap is reached, so holding down the
        // mouse can never grow the per-frame draw call count without bound.
        if (spawned.length >= MAX_SPAWNED) {
          const oldest = spawned.shift();
          if (oldest) deleteDrawable(gl, oldest);
        }

        spawned.push(drawable);
      }

      function onMouseEnter() {
        pointerOverCanvas = true;
      }

      // Held keys are dropped only once the canvas stops being active
      // altogether. Clicking the canvas also focuses it, so a canvas that is
      // still focused keeps responding after the pointer wanders off.
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
        // Both shortcut families share one gate, so the page keeps its normal
        // keyboard behaviour — including arrow-key scrolling — everywhere else.
        if (!isCanvasActive() || isFormElement(event.target)) return;

        if (MOVEMENT_CODES.includes(event.code)) {
          if (event.code.startsWith("Arrow")) event.preventDefault();
          // State-based: keydown only records that the key is held. The actual
          // movement happens once per frame in updateKeyboard().
          keys[event.code] = true;
        }

        // Event-based: discrete one-shot actions, guarded against key repeat.
        if (!event.repeat) {
          if (event.code === "KeyR") resetScene();
          // Advance the active colour to the next palette entry. The functional
          // updater keeps this correct without capturing the current colour.
          if (event.code === "KeyC") {
            setColor((current) => PALETTE[(PALETTE.indexOf(current) + 1) % PALETTE.length]);
          }
          if (event.code === "KeyP") setPaused((value) => !value);
        }
      }

      // Deliberately ungated: a key held while the pointer leaves the canvas
      // must still be able to clear itself.
      function onKeyUp(event: KeyboardEvent) {
        keys[event.code] = false;
      }

      function onContextLost(event: Event) {
        // Without preventDefault the context is never eligible for restoration.
        event.preventDefault();
        // Every gl.* call is a silent no-op from here on, so stop the loop
        // rather than burning frames on nothing, and surface the failure
        // instead of leaving a frozen black canvas.
        cancelAnimationFrame(rafId);
        console.warn("[WebGL] context lost");
        setContextLost(true);
      }

      canvas.addEventListener("mousemove", onMouseMove);
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
      // UPDATE
      // ------------------------------------------------------------------
      /** State-based movement: the held-key state is read once per frame. */
      function updateKeyboard(frameScale: number) {
        if (!player) return;

        const step = speedRef.current * frameScale;
        if (keys.ArrowLeft || keys.KeyA) player.offsetX -= step;
        if (keys.ArrowRight || keys.KeyD) player.offsetX += step;
        if (keys.ArrowUp || keys.KeyW) player.offsetY += step;
        if (keys.ArrowDown || keys.KeyS) player.offsetY -= step;

        // Keep the whole triangle inside NDC.
        player.offsetX = Math.max(-1 - playerBounds.minX, Math.min(1 - playerBounds.maxX, player.offsetX));
        player.offsetY = Math.max(-1 - playerBounds.minY, Math.min(1 - playerBounds.maxY, player.offsetY));
      }

      /**
       * Moves every bouncing object and reflects it at the NDC boundary.
       *
       * Both axes are handled the same way, so an object moving diagonally
       * bounces off the side and the top independently — hitting a corner
       * simply flips both velocities in the same frame.
       */
      function update(frameScale: number) {
        for (const { drawable, bounds } of movers) {
          drawable.offsetX += drawable.velocityX * frameScale;
          drawable.offsetY += drawable.velocityY * frameScale;

          // Bounce once the leading edge — not the centre — reaches the border,
          // and clamp back to it so a large frame delta cannot bury the shape
          // outside the boundary and leave it flipping every frame.
          if (drawable.offsetX + bounds.maxX >= 1) {
            drawable.offsetX = 1 - bounds.maxX;
            drawable.velocityX *= -1;
          } else if (drawable.offsetX + bounds.minX <= -1) {
            drawable.offsetX = -1 - bounds.minX;
            drawable.velocityX *= -1;
          }

          if (drawable.offsetY + bounds.maxY >= 1) {
            drawable.offsetY = 1 - bounds.maxY;
            drawable.velocityY *= -1;
          } else if (drawable.offsetY + bounds.minY <= -1) {
            drawable.offsetY = -1 - bounds.minY;
            drawable.velocityY *= -1;
          }
        }
      }

      /** Batched HUD refresh; see INFO_INTERVAL_MS. */
      function updateInfo(delta: number) {
        frameTimeAccum += delta;
        frameCount += 1;
        infoAccum += delta;

        if (infoAccum < INFO_INTERVAL_MS || frameCount === 0) return;

        const average = frameTimeAccum / frameCount;
        const all = [...showcase, ...spawned];

        setInfo({
          fps: average > 0 ? Math.round(1000 / average) : 0,
          frameTime: average,
          spawnedCount: spawned.length,
          primitiveCount: all.length,
          vertexCount: all.reduce((total, item) => total + item.vertexCount, 0),
          mouseNdc: { x: mouseNdc.x, y: mouseNdc.y },
        });

        frameTimeAccum = 0;
        frameCount = 0;
        infoAccum = 0;
      }

      // ------------------------------------------------------------------
      // DRAW
      // ------------------------------------------------------------------
      function draw() {
        gl.clear(gl.COLOR_BUFFER_BIT);

        // Eksperimen 3 in the module: redraw one object under the selected mode
        // without touching its vertex data. The same 6 vertices become 2 filled
        // triangles, a closed line loop, or 6 points — which is exactly the
        // point, since only primitive assembly changes, never the buffer.
        if (modeDemo) modeDemo.mode = drawModeRef.current;

        for (const item of showcase) {
          // Only moving objects pay the cost of re-uploading their vertices.
          if (item.dynamic) uploadPositions(gl, item);
          drawDrawable(gl, locations, item);
        }

        for (const item of spawned) {
          drawDrawable(gl, locations, item);
        }
      }

      // ------------------------------------------------------------------
      // render() — the rendering loop
      // ------------------------------------------------------------------
      function render(time: number) {
        const delta = time - lastTime;
        lastTime = time;

        // Clamped so returning from a background tab does not teleport objects.
        const frameScale = Math.min(delta / TARGET_FRAME_MS, 3);

        updateInfo(delta);

        if (!pausedRef.current) {
          updateKeyboard(frameScale);
          update(frameScale);
        }

        draw();
        rafId = requestAnimationFrame(render);
      }
      rafId = requestAnimationFrame(render);

      // ------------------------------------------------------------------
      // CLEANUP — GPU resources are not garbage collected with the component.
      // ------------------------------------------------------------------
      return () => {
        cancelAnimationFrame(rafId);

        canvas.removeEventListener("mousemove", onMouseMove);
        canvas.removeEventListener("click", onClick);
        canvas.removeEventListener("mouseenter", onMouseEnter);
        canvas.removeEventListener("mouseleave", onMouseLeave);
        canvas.removeEventListener("focus", onCanvasFocus);
        canvas.removeEventListener("blur", onCanvasBlur);
        canvas.removeEventListener("webglcontextlost", onContextLost);
        window.removeEventListener("keydown", onKeyDown);
        window.removeEventListener("keyup", onKeyUp);
        window.removeEventListener("blur", releaseAllKeys);

        for (const item of [...showcase, ...spawned]) deleteDrawable(gl, item);
        gl.deleteProgram(program);
        controlsApiRef.current = null;
      };
    }
  }, []);

  // Keeps the colour ref in sync and repaints the player whenever the active
  // colour changes, from either the palette or the `C` key.
  useEffect(() => {
    colorRef.current = color;
    controlsApiRef.current?.setPlayerColor(color);
  }, [color]);

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
        <div className="mx-auto w-full max-w-[960px]">
          {/* tabIndex makes the canvas reachable by Tab, so the keyboard
              controls do not depend on having a mouse to hover with. */}
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            tabIndex={0}
            aria-label="Canvas WebGL playground. Fokuskan canvas ini lalu gunakan Arrow keys atau WASD untuk menggerakkan segitiga player."
            className="block h-auto w-full cursor-crosshair rounded-xl border border-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            style={{ aspectRatio: `${CANVAS_WIDTH} / ${CANVAS_HEIGHT}` }}
          />
        </div>
        <p className="mt-3 text-center text-xs text-slate-500">
          Klik canvas untuk membuat primitive baru sesuai draw mode aktif · arahkan pointer ke
          canvas atau fokuskan dengan Tab, lalu pakai Arrow keys / WASD untuk menggerakkan
          segitiga player.
        </p>
      </div>

      <PlaygroundControls
        drawMode={drawMode}
        onDrawModeChange={setDrawMode}
        color={color}
        onColorChange={setColor}
        onRandomColor={() => setColor(randomPaletteColor())}
        paused={paused}
        onTogglePause={() => setPaused((value) => !value)}
        onReset={() => controlsApiRef.current?.reset()}
        onClearSpawned={() => controlsApiRef.current?.clearSpawned()}
        speed={speed}
        onSpeedChange={setSpeed}
        fps={info.fps}
        frameTime={info.frameTime}
        spawnedCount={info.spawnedCount}
        primitiveCount={info.primitiveCount}
        vertexCount={info.vertexCount}
        mouseNdc={info.mouseNdc}
      />
    </div>
  );
}
