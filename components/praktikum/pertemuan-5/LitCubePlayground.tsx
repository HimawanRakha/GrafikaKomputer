"use client";

import { useEffect, useRef, useState } from "react";
import PlaygroundControls from "./PlaygroundControls";
import {
  applyFiltering,
  applyWrapping,
  bindCubeMesh,
  createCheckerTexture,
  createCubeMesh,
  createProgram,
  createShader,
  deleteCubeMesh,
  type ProgramLocations,
} from "./webgl/glUtils";
import { Mat4, degToRad, normalMatrixFromMat4 } from "./webgl/math3d";
import { FRAGMENT_SHADER_SOURCE, VERTEX_SHADER_SOURCE } from "./webgl/shaders";
import {
  AMBIENT_INITIAL,
  AMBIENT_SPEED,
  BACKGROUND_COLOR,
  CAMERA_POSITION,
  CAMERA_TARGET,
  CAMERA_UP,
  CLAMP_AMBIENT,
  CLAMP_SHININESS,
  CLAMP_UV_SCALE,
  CUBE_SPIN_X,
  CUBE_SPIN_Y,
  CUBE_UVS,
  CUBE_VERTICES,
  FAR,
  FLAT_NORMALS,
  FOV_DEGREES,
  LIGHT_COLOR,
  LIGHT_INITIAL_POSITION,
  LIGHT_SPEED,
  MAX_DELTA_SECONDS,
  NEAR,
  SHININESS_INITIAL,
  SHININESS_SPEED,
  SMOOTH_NORMALS,
  UV_SCALE_INITIAL,
  UV_SCALE_SPEED,
  WRAP_MODES,
  createCubeModelMatrix,
  type CubeState,
  type FilterMode,
  type LightingComponents,
  type ScaleMode,
  type ShadingMode,
  type WrapMode,
} from "./webgl/scene";

const CANVAS_WIDTH = 960;
const CANVAS_HEIGHT = 600;

// The HUD is refreshed 10x per second rather than every frame — the same
// reason Pertemuan 2-4 throttle theirs: pushing into React state on every
// frame would mean ~60 re-renders per second for numbers a human reads at a glance.
const HUD_INTERVAL_MS = 100;

function isFormElement(target: EventTarget | null) {
  return target instanceof HTMLElement && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

/** Everything the control panel displays. Mirrored out of the render loop, never read back into it. */
export interface HudState {
  shadingMode: ShadingMode;
  filterMode: FilterMode;
  wrapMode: WrapMode;
  uvScale: number;
  shininess: number;
  ambientStrength: number;
  lightPosition: { x: number; y: number; z: number };
  scaleMode: ScaleMode;
  components: LightingComponents;
  paused: boolean;
}

/** Actions the HTML buttons need to reach inside the WebGL effect. */
export interface ControlsApi {
  reset: () => void;
  toggleShading: () => void;
  toggleFiltering: () => void;
  cycleWrapping: () => void;
  setWrapping: (mode: WrapMode) => void;
  toggleScaleMode: () => void;
  toggleComponent: (component: keyof LightingComponents) => void;
  togglePause: () => void;
}

export default function LitCubePlayground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [supported, setSupported] = useState(true);
  const [contextLost, setContextLost] = useState(false);
  const [hud, setHud] = useState<HudState>({
    shadingMode: "FLAT",
    filterMode: "LINEAR",
    wrapMode: "REPEAT",
    uvScale: UV_SCALE_INITIAL,
    shininess: SHININESS_INITIAL,
    ambientStrength: AMBIENT_INITIAL,
    lightPosition: { ...LIGHT_INITIAL_POSITION },
    scaleMode: "UNIFORM",
    components: { ambient: true, diffuse: true, specular: true },
    paused: false,
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
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.enable(gl.DEPTH_TEST);
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
        normal: gl.getAttribLocation(program, "a_normal"),
        texCoord: gl.getAttribLocation(program, "a_texCoord"),
        model: gl.getUniformLocation(program, "u_model"),
        view: gl.getUniformLocation(program, "u_view"),
        projection: gl.getUniformLocation(program, "u_projection"),
        normalMatrix: gl.getUniformLocation(program, "u_normalMatrix"),
        uvScale: gl.getUniformLocation(program, "u_uvScale"),
        lightPosition: gl.getUniformLocation(program, "u_lightPosition"),
        lightColor: gl.getUniformLocation(program, "u_lightColor"),
        cameraPosition: gl.getUniformLocation(program, "u_cameraPosition"),
        ambientStrength: gl.getUniformLocation(program, "u_ambientStrength"),
        shininess: gl.getUniformLocation(program, "u_shininess"),
        texture: gl.getUniformLocation(program, "u_texture"),
        ambientOn: gl.getUniformLocation(program, "u_ambientOn"),
        diffuseOn: gl.getUniformLocation(program, "u_diffuseOn"),
        specularOn: gl.getUniformLocation(program, "u_specularOn"),
      };

      const cubeMesh = createCubeMesh(gl, CUBE_VERTICES, FLAT_NORMALS, SMOOTH_NORMALS, CUBE_UVS);
      const checkerTexture = createCheckerTexture(gl);
      if (!cubeMesh || !checkerTexture) return;
      // Re-bound into one fresh, never-reassigned object so every nested
      // function declaration below sees non-null types.
      const gpu = { mesh: cubeMesh, texture: checkerTexture };

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, gpu.texture);
      gl.uniform1i(locations.texture, 0);

      // Camera and projection never change in this scene (module section 51),
      // so both matrices are built once rather than every frame.
      const viewMatrix = Mat4.lookAt(CAMERA_POSITION, CAMERA_TARGET, CAMERA_UP);
      const projectionMatrix = Mat4.perspective(
        degToRad(FOV_DEGREES),
        CANVAS_WIDTH / CANVAS_HEIGHT,
        NEAR,
        FAR,
      );

      // ------------------------------------------------------------------
      // MUTABLE SCENE STATE
      // ------------------------------------------------------------------
      const cube: CubeState = { rotationX: 20, rotationY: 30, scaleMode: "UNIFORM" };
      const light = { position: { ...LIGHT_INITIAL_POSITION } };
      let ambientStrength = AMBIENT_INITIAL;
      let shininess = SHININESS_INITIAL;
      let uvScale = UV_SCALE_INITIAL;
      let shadingMode: ShadingMode = "FLAT";
      let filterMode: FilterMode = "LINEAR";
      let wrapIndex = 0;
      let paused = false;
      const components: LightingComponents = { ambient: true, diffuse: true, specular: true };

      applyFiltering(gl, gpu.texture, filterMode);
      applyWrapping(gl, gpu.texture, WRAP_MODES[wrapIndex]);

      function reset() {
        cube.rotationX = 20;
        cube.rotationY = 30;
        cube.scaleMode = "UNIFORM";
        light.position = { ...LIGHT_INITIAL_POSITION };
        ambientStrength = AMBIENT_INITIAL;
        shininess = SHININESS_INITIAL;
        uvScale = UV_SCALE_INITIAL;
        shadingMode = "FLAT";
        filterMode = "LINEAR";
        wrapIndex = 0;
        paused = false;
        components.ambient = true;
        components.diffuse = true;
        components.specular = true;
        applyFiltering(gl, gpu.texture, filterMode);
        applyWrapping(gl, gpu.texture, WRAP_MODES[wrapIndex]);
      }

      controlsApiRef.current = {
        reset,
        toggleShading: () => {
          shadingMode = shadingMode === "FLAT" ? "SMOOTH" : "FLAT";
        },
        toggleFiltering: () => {
          filterMode = filterMode === "LINEAR" ? "NEAREST" : "LINEAR";
          applyFiltering(gl, gpu.texture, filterMode);
        },
        cycleWrapping: () => {
          wrapIndex = (wrapIndex + 1) % WRAP_MODES.length;
          applyWrapping(gl, gpu.texture, WRAP_MODES[wrapIndex]);
        },
        setWrapping: (mode) => {
          const index = WRAP_MODES.indexOf(mode);
          if (index === -1) return;
          wrapIndex = index;
          applyWrapping(gl, gpu.texture, mode);
        },
        toggleScaleMode: () => {
          cube.scaleMode = cube.scaleMode === "UNIFORM" ? "NON_UNIFORM" : "UNIFORM";
        },
        toggleComponent: (component) => {
          components[component] = !components[component];
        },
        togglePause: () => {
          paused = !paused;
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

        if (event.code.startsWith("Arrow")) event.preventDefault();

        // State-based: continuous light/material tuning, applied once per
        // frame in updateLight()/updateMaterial() and scaled by deltaTime.
        keys[event.code] = true;

        // Event-based: discrete one-shot actions, guarded against key repeat.
        if (event.repeat) return;

        if (event.code === "KeyF") controlsApiRef.current?.toggleShading();
        if (event.code === "KeyT") controlsApiRef.current?.toggleFiltering();
        if (event.code === "KeyG") controlsApiRef.current?.cycleWrapping();
        if (event.code === "KeyN") controlsApiRef.current?.toggleScaleMode();
        if (event.code === "KeyP") controlsApiRef.current?.togglePause();
        if (event.code === "KeyR") reset();
        if (event.code === "Digit1") controlsApiRef.current?.toggleComponent("ambient");
        if (event.code === "Digit2") controlsApiRef.current?.toggleComponent("diffuse");
        if (event.code === "Digit3") controlsApiRef.current?.toggleComponent("specular");
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
      function updateLight(dt: number) {
        if (keys.ArrowLeft) light.position.x -= LIGHT_SPEED * dt;
        if (keys.ArrowRight) light.position.x += LIGHT_SPEED * dt;
        if (keys.ArrowUp) light.position.y += LIGHT_SPEED * dt;
        if (keys.ArrowDown) light.position.y -= LIGHT_SPEED * dt;
        if (keys.KeyW) light.position.z -= LIGHT_SPEED * dt;
        if (keys.KeyS) light.position.z += LIGHT_SPEED * dt;
      }

      function updateMaterial(dt: number) {
        if (keys.BracketLeft) uvScale -= UV_SCALE_SPEED * dt;
        if (keys.BracketRight) uvScale += UV_SCALE_SPEED * dt;
        uvScale = Math.max(CLAMP_UV_SCALE[0], Math.min(CLAMP_UV_SCALE[1], uvScale));

        if (keys.Minus) shininess -= SHININESS_SPEED * dt;
        if (keys.Equal) shininess += SHININESS_SPEED * dt;
        shininess = Math.max(CLAMP_SHININESS[0], Math.min(CLAMP_SHININESS[1], shininess));

        // Challenge B.
        if (keys.KeyA) ambientStrength += AMBIENT_SPEED * dt;
        if (keys.KeyZ) ambientStrength -= AMBIENT_SPEED * dt;
        ambientStrength = Math.max(CLAMP_AMBIENT[0], Math.min(CLAMP_AMBIENT[1], ambientStrength));
      }

      function updateCubeSpin(dt: number) {
        cube.rotationX += CUBE_SPIN_X * dt;
        cube.rotationY += CUBE_SPIN_Y * dt;
      }

      // ------------------------------------------------------------------
      // DRAW
      // ------------------------------------------------------------------
      function draw() {
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        const model = createCubeModelMatrix(cube);
        // Inverse-transpose of the Model Matrix's linear part — see
        // math3d.ts for why this, and not u_model itself, is what keeps
        // lighting correct once the cube's scale stops being uniform.
        const normalMatrix = normalMatrixFromMat4(model);

        gl.uniformMatrix4fv(locations.model, false, model);
        gl.uniformMatrix4fv(locations.view, false, viewMatrix);
        gl.uniformMatrix4fv(locations.projection, false, projectionMatrix);
        gl.uniformMatrix3fv(locations.normalMatrix, false, normalMatrix);

        gl.uniform1f(locations.uvScale, uvScale);
        gl.uniform3f(locations.lightPosition, light.position.x, light.position.y, light.position.z);
        gl.uniform3f(locations.lightColor, LIGHT_COLOR.x, LIGHT_COLOR.y, LIGHT_COLOR.z);
        gl.uniform3f(
          locations.cameraPosition,
          CAMERA_POSITION.x,
          CAMERA_POSITION.y,
          CAMERA_POSITION.z,
        );
        gl.uniform1f(locations.ambientStrength, ambientStrength);
        gl.uniform1f(locations.shininess, shininess);
        gl.uniform1f(locations.ambientOn, components.ambient ? 1 : 0);
        gl.uniform1f(locations.diffuseOn, components.diffuse ? 1 : 0);
        gl.uniform1f(locations.specularOn, components.specular ? 1 : 0);

        bindCubeMesh(gl, locations, gpu.mesh, shadingMode);
        gl.drawArrays(gl.TRIANGLES, 0, gpu.mesh.vertexCount);
      }

      // ------------------------------------------------------------------
      // RENDER LOOP
      // ------------------------------------------------------------------
      let lastTime = performance.now();
      let hudAccumMs = 0;

      function render(time: number) {
        const dt = Math.min((time - lastTime) * 0.001, MAX_DELTA_SECONDS);
        lastTime = time;

        // Light and material stay tunable while paused; only the cube's own
        // automatic spin freezes — the same "pause only stops the automatic
        // part" philosophy Pertemuan 4's camera uses.
        updateLight(dt);
        updateMaterial(dt);
        if (!paused) updateCubeSpin(dt);

        draw();

        hudAccumMs += dt * 1000;
        if (hudAccumMs >= HUD_INTERVAL_MS) {
          hudAccumMs = 0;
          setHud({
            shadingMode,
            filterMode,
            wrapMode: WRAP_MODES[wrapIndex],
            uvScale,
            shininess,
            ambientStrength,
            lightPosition: { ...light.position },
            scaleMode: cube.scaleMode,
            components: { ...components },
            paused,
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

        deleteCubeMesh(gl, gpu.mesh);
        gl.deleteTexture(gpu.texture);
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
        Seluruh buffer, shader, dan texture di GPU ikut hilang bersamanya, jadi muat ulang halaman
        untuk membangunnya kembali.
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
            aria-label="Canvas WebGL cube bertekstur dan diberi pencahayaan. Fokuskan canvas ini lalu gunakan Arrow dan W/S untuk menggerakkan posisi lampu."
            className="block h-auto w-full cursor-crosshair rounded-xl border border-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            style={{ aspectRatio: `${CANVAS_WIDTH} / ${CANVAS_HEIGHT}` }}
          />
        </div>
        <p className="mt-3 text-center text-xs text-slate-500">
          Arahkan pointer ke canvas atau fokuskan dengan Tab, lalu gerakkan lampu dengan Arrow /
          W / S dan amati diffuse serta specular highlight berubah mengikuti arahnya.
        </p>
      </div>

      <PlaygroundControls hud={hud} api={controlsApiRef} />
    </div>
  );
}
