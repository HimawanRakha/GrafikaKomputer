"use client";

import { useEffect, useRef, useState } from "react";
import PlaygroundControls, { type AspectPreset } from "./PlaygroundControls";
import {
  bindMesh,
  createMesh,
  createProgram,
  createShader,
  deleteMesh,
  drawMeshInstance,
  type ProgramLocations,
} from "./webgl/glUtils";
import { Mat4, Vec3 } from "./webgl/math3d";
import { FRAGMENT_SHADER_SOURCE, VERTEX_SHADER_SOURCE } from "./webgl/shaders";
import {
  BACKGROUND_COLOR,
  CLAMP_FOV,
  CUBES,
  CUBE_COLORS,
  CUBE_VERTICES,
  FOV_INITIAL,
  FOV_PRESETS,
  FOV_SPEED,
  MAX_DELTA_SECONDS,
  MOVE_SPEED,
  NEAR_FAR_PRESETS,
  ORBIT_SPEED,
  ZOOM_SPEED,
  buildProjection,
  clampCamera,
  getCubeModelMatrix,
  makeInitialCamera,
  orbitPosition,
  syncOrbitFromPosition,
  type CameraState,
  type ProjectionMode,
} from "./webgl/scene";

// The HUD is refreshed 10x per second rather than every frame — the same reason
// Pertemuan 2 and 3 throttle theirs: pushing into React state on every frame
// would mean ~60 re-renders per second for numbers a human reads at a glance.
const HUD_INTERVAL_MS = 100;

/** Device pixel ratio is capped: a 3x display would otherwise quadruple the fill cost for no visible gain. */
const MAX_PIXEL_RATIO = 2;

function isFormElement(target: EventTarget | null) {
  return target instanceof HTMLElement && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

/** Everything the control panel displays. Mirrored out of the render loop, never read back into it. */
export interface HudState {
  camera: { x: number; y: number; z: number };
  target: { x: number; y: number; z: number };
  azimuth: number;
  elevation: number;
  radius: number;
  orbit: boolean;
  projection: ProjectionMode;
  fov: number;
  nearFarIndex: number;
  depthTest: boolean;
  paused: boolean;
  drawingBuffer: { width: number; height: number };
  aspect: number;
}

/** Actions the HTML buttons need to reach inside the WebGL effect. */
export interface ControlsApi {
  reset: () => void;
  toggleProjection: () => void;
  setProjection: (mode: ProjectionMode) => void;
  applyFovPreset: (index: number) => void;
  cycleNearFar: () => void;
  setNearFar: (index: number) => void;
  toggleDepthTest: () => void;
  toggleOrbit: () => void;
  togglePause: () => void;
}

export default function CameraPlayground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [supported, setSupported] = useState(true);
  const [contextLost, setContextLost] = useState(false);
  // Pure CSS — changing it resizes the canvas element, which the render loop
  // notices and turns into a new drawing-buffer size and aspect ratio.
  const [aspectPreset, setAspectPreset] = useState<AspectPreset>("16 / 10");

  const [hud, setHud] = useState<HudState>({
    camera: { x: 0, y: 0, z: 0 },
    target: { x: 0, y: 0, z: 0 },
    azimuth: 0,
    elevation: 0,
    radius: 0,
    orbit: false,
    projection: "perspective",
    fov: FOV_INITIAL,
    nearFarIndex: 0,
    depthTest: true,
    paused: false,
    drawingBuffer: { width: 0, height: 0 },
    aspect: 1,
  });

  const controlsApiRef = useRef<ControlsApi | null>(null);

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
      gl.clearColor(...BACKGROUND_COLOR);

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
        color: gl.getAttribLocation(program, "a_color"),
        model: gl.getUniformLocation(program, "u_model"),
        view: gl.getUniformLocation(program, "u_view"),
        projection: gl.getUniformLocation(program, "u_projection"),
        tint: gl.getUniformLocation(program, "u_tint"),
      };

      // One 36-vertex cube on the GPU, reused by all three instances — only the
      // Model Matrix and the tint differ between them.
      const cubeMesh = createMesh(gl, CUBE_VERTICES, CUBE_COLORS);
      if (!cubeMesh) return;
      const mesh = cubeMesh;

      // ------------------------------------------------------------------
      // MUTABLE SCENE STATE
      // Kept as a plain object rather than React state because the render loop
      // rewrites it up to 60x per second; React only ever sees the HUD mirror.
      // ------------------------------------------------------------------
      const view = {
        camera: makeInitialCamera() as CameraState,
        projection: "perspective" as ProjectionMode,
        fov: FOV_INITIAL,
        nearFarIndex: 0,
        depthTest: true,
        paused: false,
      };

      function reset() {
        view.camera = makeInitialCamera();
        view.projection = "perspective";
        view.fov = FOV_INITIAL;
        view.nearFarIndex = 0;
        view.depthTest = true;
        view.paused = false;
      }

      function toggleOrbit() {
        // Read the orbit angles out of wherever the free camera is right now,
        // so switching modes never teleports the viewpoint mid-demo.
        if (!view.camera.orbit) syncOrbitFromPosition(view.camera);
        view.camera.orbit = !view.camera.orbit;
      }

      controlsApiRef.current = {
        reset,
        toggleProjection: () => {
          view.projection = view.projection === "perspective" ? "orthographic" : "perspective";
        },
        setProjection: (mode) => {
          view.projection = mode;
        },
        applyFovPreset: (index) => {
          const preset = FOV_PRESETS[index];
          if (preset !== undefined) view.fov = preset;
        },
        cycleNearFar: () => {
          view.nearFarIndex = (view.nearFarIndex + 1) % NEAR_FAR_PRESETS.length;
        },
        setNearFar: (index) => {
          if (NEAR_FAR_PRESETS[index]) view.nearFarIndex = index;
        },
        toggleDepthTest: () => {
          view.depthTest = !view.depthTest;
        },
        toggleOrbit,
        togglePause: () => {
          view.paused = !view.paused;
        },
      };

      // ------------------------------------------------------------------
      // INPUT
      // ------------------------------------------------------------------
      const keys: Record<string, boolean> = {};
      let pointerOverCanvas = false;
      let canvasFocused = false;
      let rafId = 0;

      /** Shortcuts are live only while the canvas is hovered or focused, so Arrow keys still scroll the page elsewhere. */
      function isCanvasActive() {
        return pointerOverCanvas || canvasFocused;
      }

      /** Clears every recorded key, so one held while focus leaves never sticks. */
      function releaseAllKeys() {
        for (const key of Object.keys(keys)) keys[key] = false;
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

        // Arrows scroll and Space pages down by default — both would fight the camera.
        if (event.code.startsWith("Arrow") || event.code === "Space") event.preventDefault();

        // State-based: continuous camera movement, applied once per frame in
        // updateCamera() and scaled by deltaTime.
        keys[event.code] = true;

        // Event-based: discrete one-shot actions, guarded against key repeat.
        if (event.repeat) return;

        if (event.code === "KeyP") controlsApiRef.current?.toggleProjection();
        if (event.code === "KeyN") controlsApiRef.current?.cycleNearFar();
        if (event.code === "KeyD") controlsApiRef.current?.toggleDepthTest();
        if (event.code === "KeyO") toggleOrbit();
        if (event.code === "KeyR") reset();
        if (event.code === "Space") view.paused = !view.paused;
        if (event.code === "Digit1") controlsApiRef.current?.applyFovPreset(0);
        if (event.code === "Digit2") controlsApiRef.current?.applyFovPreset(1);
        if (event.code === "Digit3") controlsApiRef.current?.applyFovPreset(2);
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
      function updateCamera(dt: number) {
        const camera = view.camera;

        if (camera.orbit) {
          // Orbit mode: the same keys drive angles on a sphere instead of
          // world-space coordinates, so the camera always faces the target.
          if (keys.ArrowLeft) camera.azimuth -= ORBIT_SPEED * dt;
          if (keys.ArrowRight) camera.azimuth += ORBIT_SPEED * dt;
          if (keys.ArrowUp) camera.elevation += ORBIT_SPEED * dt;
          if (keys.ArrowDown) camera.elevation -= ORBIT_SPEED * dt;
          if (keys.KeyW) camera.radius -= ZOOM_SPEED * dt;
          if (keys.KeyS) camera.radius += ZOOM_SPEED * dt;
        } else {
          if (keys.ArrowLeft) camera.position.x -= MOVE_SPEED * dt;
          if (keys.ArrowRight) camera.position.x += MOVE_SPEED * dt;
          if (keys.ArrowUp) camera.position.y += MOVE_SPEED * dt;
          if (keys.ArrowDown) camera.position.y -= MOVE_SPEED * dt;
          if (keys.KeyW) camera.position.z -= MOVE_SPEED * dt;
          if (keys.KeyS) camera.position.z += MOVE_SPEED * dt;
        }

        if (keys.BracketLeft) view.fov -= FOV_SPEED * dt;
        if (keys.BracketRight) view.fov += FOV_SPEED * dt;
        view.fov = Math.max(CLAMP_FOV[0], Math.min(CLAMP_FOV[1], view.fov));

        clampCamera(camera);
      }

      /**
       * Matches the drawing buffer to the size the canvas is actually displayed
       * at. Without this the buffer keeps its initial size while CSS stretches
       * it, which both blurs the image and — because aspect is read from the
       * buffer — leaves the projection stretching the cubes.
       */
      function resizeToDisplaySize() {
        const ratio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
        const width = Math.max(1, Math.round(canvas.clientWidth * ratio));
        const height = Math.max(1, Math.round(canvas.clientHeight * ratio));

        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width;
          canvas.height = height;
          gl.viewport(0, 0, width, height);
        }
      }

      // ------------------------------------------------------------------
      // DRAW
      // ------------------------------------------------------------------
      function draw(seconds: number) {
        resizeToDisplaySize();
        const aspect = canvas.width / canvas.height;

        // Toggled rather than set once, so pressing D takes effect immediately.
        if (view.depthTest) gl.enable(gl.DEPTH_TEST);
        else gl.disable(gl.DEPTH_TEST);

        // The depth buffer is cleared every frame whether or not the test is
        // enabled — leftover depth values from the previous frame would reject
        // fragments that belong in this one.
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        const camera = view.camera;
        // In orbit mode the eye is derived from the angles; writing it back
        // keeps camera.position meaningful for the HUD and for the moment orbit
        // mode is switched off again.
        if (camera.orbit) camera.position = orbitPosition(camera);

        const viewMatrix = Mat4.lookAt(camera.position, camera.target, camera.up);
        const distance = Vec3.length(Vec3.subtract(camera.position, camera.target));
        const { near, far } = NEAR_FAR_PRESETS[view.nearFarIndex];
        const projectionMatrix = buildProjection(
          view.projection,
          view.fov,
          aspect,
          near,
          far,
          distance,
        );

        // View and Projection are shared by every object in the frame, so they
        // are uploaded once here rather than once per cube.
        gl.uniformMatrix4fv(locations.view, false, viewMatrix);
        gl.uniformMatrix4fv(locations.projection, false, projectionMatrix);

        bindMesh(gl, locations, mesh);

        // Drawn NEAREST FIRST on purpose — see the comment on CUBES in scene.ts.
        for (const cube of CUBES) {
          drawMeshInstance(gl, locations, mesh, getCubeModelMatrix(cube, seconds), cube.tint);
        }
      }

      // ------------------------------------------------------------------
      // RENDER LOOP
      // ------------------------------------------------------------------
      let lastTime = performance.now();
      let sceneSeconds = 0;
      let hudAccumMs = 0;

      function render(time: number) {
        const dt = Math.min((time - lastTime) * 0.001, MAX_DELTA_SECONDS);
        lastTime = time;

        // Camera control stays live while paused; only the cubes' own spin
        // freezes, so a paused scene can still be inspected from any angle.
        updateCamera(dt);
        if (!view.paused) sceneSeconds += dt;

        draw(sceneSeconds);

        hudAccumMs += dt * 1000;
        if (hudAccumMs >= HUD_INTERVAL_MS) {
          hudAccumMs = 0;
          setHud({
            camera: { ...view.camera.position },
            target: { ...view.camera.target },
            azimuth: view.camera.azimuth,
            elevation: view.camera.elevation,
            radius: view.camera.radius,
            orbit: view.camera.orbit,
            projection: view.projection,
            fov: view.fov,
            nearFarIndex: view.nearFarIndex,
            depthTest: view.depthTest,
            paused: view.paused,
            drawingBuffer: { width: canvas.width, height: canvas.height },
            aspect: canvas.width / canvas.height,
          });
        }

        rafId = requestAnimationFrame(render);
      }
      rafId = requestAnimationFrame(render);

      // ------------------------------------------------------------------
      // CLEANUP — GPU resources are not garbage collected with the component.
      // ------------------------------------------------------------------
      return () => {
        cancelAnimationFrame(rafId);

        canvas.removeEventListener("mouseenter", onMouseEnter);
        canvas.removeEventListener("mouseleave", onMouseLeave);
        canvas.removeEventListener("focus", onCanvasFocus);
        canvas.removeEventListener("blur", onCanvasBlur);
        canvas.removeEventListener("webglcontextlost", onContextLost);
        window.removeEventListener("keydown", onKeyDown);
        window.removeEventListener("keyup", onKeyUp);
        window.removeEventListener("blur", releaseAllKeys);

        deleteMesh(gl, mesh);
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
          {/* No width/height attributes: the drawing buffer is sized from the
              displayed size every frame, which is what keeps the aspect ratio
              correct when the preset below (or the window) changes. */}
          <canvas
            ref={canvasRef}
            tabIndex={0}
            aria-label="Canvas WebGL 3D cube camera playground. Fokuskan canvas ini lalu gunakan Arrow, W/S, P, [ ], N, D, O, R untuk mengubah kamera dan proyeksi."
            className="block w-full rounded-xl border border-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            style={{ aspectRatio: aspectPreset }}
          />
        </div>
        <p className="mt-3 text-center text-xs text-slate-500">
          Arahkan pointer ke canvas atau fokuskan dengan Tab, lalu gerakkan kamera dengan Arrow dan
          W/S &middot; ubah aspect ratio canvas di panel kanan untuk menguji proyeksi.
        </p>
      </div>

      <PlaygroundControls
        hud={hud}
        api={controlsApiRef}
        aspectPreset={aspectPreset}
        onSetAspectPreset={setAspectPreset}
      />
    </div>
  );
}
