// Geometry, material state and lighting/texture settings for the Pertemuan 5
// scene. Like Pertemuan 3 and 4's scene.ts, nothing here touches the WebGL
// context — it stays pure data and maths.

import { Mat4, degToRad, type Mat4Array, type Vec3 } from "./math3d";

// ---------------------------------------------------------------------------
// CUBE GEOMETRY — 36 vertices, vec3 position, local space
// ---------------------------------------------------------------------------
//
// Identical layout to Pertemuan 4's cube (6 faces × 2 triangles × 3 vertices,
// corners duplicated rather than indexed) — reused here because this
// practicum is about what happens to the SAME geometry once normals, UVs,
// lighting and a texture are added on top of it.

export const CUBE_VERTICES = new Float32Array([
  // Front face (z = +0.5)
  -0.5, -0.5, 0.5,
  0.5, -0.5, 0.5,
  0.5, 0.5, 0.5,
  -0.5, -0.5, 0.5,
  0.5, 0.5, 0.5,
  -0.5, 0.5, 0.5,

  // Back face (z = -0.5)
  0.5, -0.5, -0.5,
  -0.5, -0.5, -0.5,
  -0.5, 0.5, -0.5,
  0.5, -0.5, -0.5,
  -0.5, 0.5, -0.5,
  0.5, 0.5, -0.5,

  // Left face (x = -0.5)
  -0.5, -0.5, -0.5,
  -0.5, -0.5, 0.5,
  -0.5, 0.5, 0.5,
  -0.5, -0.5, -0.5,
  -0.5, 0.5, 0.5,
  -0.5, 0.5, -0.5,

  // Right face (x = +0.5)
  0.5, -0.5, 0.5,
  0.5, -0.5, -0.5,
  0.5, 0.5, -0.5,
  0.5, -0.5, 0.5,
  0.5, 0.5, -0.5,
  0.5, 0.5, 0.5,

  // Top face (y = +0.5)
  -0.5, 0.5, 0.5,
  0.5, 0.5, 0.5,
  0.5, 0.5, -0.5,
  -0.5, 0.5, 0.5,
  0.5, 0.5, -0.5,
  -0.5, 0.5, -0.5,

  // Bottom face (y = -0.5)
  -0.5, -0.5, -0.5,
  0.5, -0.5, -0.5,
  0.5, -0.5, 0.5,
  -0.5, -0.5, -0.5,
  0.5, -0.5, 0.5,
  -0.5, -0.5, 0.5,
]);

/**
 * Face normals — FLAT shading. Every vertex of a face points the same
 * direction, so lighting is constant across that face and jumps abruptly at
 * each edge (module section 7-8).
 */
export const FLAT_NORMALS = new Float32Array([
  // Front
  0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1,
  // Back
  0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1,
  // Left
  -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0,
  // Right
  1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0,
  // Top
  0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0,
  // Bottom
  0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0,
]);

/**
 * Smooth vertex normals — direction from the cube's centre to each corner,
 * normalized. The geometry is untouched; only this buffer differs from
 * FLAT_NORMALS, which is the whole point (module section 27): swapping
 * normals alone is enough to make the same 36 vertices shade as if the cube
 * were rounder. Not a physically "correct" normal for a cube — a deliberate
 * demonstration, not an artistic ideal.
 */
function createSmoothNormals(positions: Float32Array): Float32Array {
  const normals = new Float32Array(positions.length);

  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i];
    const y = positions[i + 1];
    const z = positions[i + 2];
    const length = Math.hypot(x, y, z) || 1;

    normals[i] = x / length;
    normals[i + 1] = y / length;
    normals[i + 2] = z / length;
  }

  return normals;
}

export const SMOOTH_NORMALS = createSmoothNormals(CUBE_VERTICES);

/** One (0,0)-(1,0)-(1,1) / (0,0)-(1,1)-(0,1) quad's worth of UV, repeated per face. */
function createCubeUVs(): Float32Array {
  const faceUV = [0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1];
  const uv: number[] = [];
  for (let face = 0; face < 6; face++) uv.push(...faceUV);
  return new Float32Array(uv);
}

export const CUBE_UVS = createCubeUVs();

// ---------------------------------------------------------------------------
// CUBE STATE
// ---------------------------------------------------------------------------

export type ShadingMode = "FLAT" | "SMOOTH";
export type ScaleMode = "UNIFORM" | "NON_UNIFORM";

export interface CubeState {
  rotationX: number; // degrees
  rotationY: number; // degrees
  scaleMode: ScaleMode;
}

export const NON_UNIFORM_SCALE = { x: 1.8, y: 0.6, z: 1.0 };

export function getCubeScale(mode: ScaleMode) {
  return mode === "UNIFORM" ? { x: 1, y: 1, z: 1 } : NON_UNIFORM_SCALE;
}

/**
 * Model Matrix: M = S × Rx × Ry, folded in as S, Rx, Ry (module section 50).
 * With no translation term the cube always spins about the world origin, so
 * — unlike Pertemuan 3's Order A/B comparison — there is no "orbits instead
 * of spinning in place" distinction riding on this particular order; what
 * Experiment Wajib 9 actually tests is whether the Normal Matrix (derived
 * from this SAME matrix) keeps lighting correct once the scale stops being
 * uniform, not which rotation axis is folded in first.
 */
export function createCubeModelMatrix(cube: CubeState): Mat4Array {
  const scale = getCubeScale(cube.scaleMode);
  const s = Mat4.scaling(scale.x, scale.y, scale.z);
  const rx = Mat4.rotationX(degToRad(cube.rotationX));
  const ry = Mat4.rotationY(degToRad(cube.rotationY));

  let matrix = Mat4.identity();
  matrix = Mat4.multiply(matrix, s);
  matrix = Mat4.multiply(matrix, rx);
  matrix = Mat4.multiply(matrix, ry);
  return matrix;
}

export const CUBE_SPIN_X = 20.0; // degrees / second
export const CUBE_SPIN_Y = 35.0; // degrees / second

// ---------------------------------------------------------------------------
// CAMERA — fixed (module section 51); only the light moves interactively
// ---------------------------------------------------------------------------

export const CAMERA_POSITION: Vec3 = { x: 0.0, y: 1.4, z: 4.0 };
export const CAMERA_TARGET: Vec3 = { x: 0.0, y: 0.0, z: 0.0 };
export const CAMERA_UP: Vec3 = { x: 0.0, y: 1.0, z: 0.0 };
export const FOV_DEGREES = 60;
export const NEAR = 0.1;
export const FAR = 100.0;

// ---------------------------------------------------------------------------
// LIGHT
// ---------------------------------------------------------------------------

export interface LightState {
  position: Vec3;
  color: Vec3;
}

export const LIGHT_INITIAL_POSITION: Vec3 = { x: 2.0, y: 2.0, z: 2.0 };
export const LIGHT_COLOR: Vec3 = { x: 1.0, y: 1.0, z: 1.0 };

export const LIGHT_SPEED = 2.0; // units / second

// ---------------------------------------------------------------------------
// MATERIAL / LIGHTING PARAMETERS
// ---------------------------------------------------------------------------

export const AMBIENT_INITIAL = 0.18;
export const AMBIENT_SPEED = 0.5; // units / second (Challenge B)
export const CLAMP_AMBIENT: [number, number] = [0.0, 1.0];

export const SHININESS_INITIAL = 32.0;
export const SHININESS_SPEED = 50.0; // units / second
export const CLAMP_SHININESS: [number, number] = [2.0, 128.0];

export const UV_SCALE_INITIAL = 1.0;
export const UV_SCALE_SPEED = 1.5; // units / second
export const CLAMP_UV_SCALE: [number, number] = [0.25, 5.0];

export const MAX_DELTA_SECONDS = 0.05;

// ---------------------------------------------------------------------------
// TEXTURE FILTERING / WRAPPING
// ---------------------------------------------------------------------------

export type FilterMode = "NEAREST" | "LINEAR";

export type WrapMode = "REPEAT" | "CLAMP_TO_EDGE" | "MIRRORED_REPEAT";
export const WRAP_MODES: WrapMode[] = ["REPEAT", "CLAMP_TO_EDGE", "MIRRORED_REPEAT"];

/** Maps our mode names onto the WebGL2 constants that use the same context instance. */
export function wrapModeToGLEnum(gl: WebGL2RenderingContext, mode: WrapMode): number {
  if (mode === "CLAMP_TO_EDGE") return gl.CLAMP_TO_EDGE;
  if (mode === "MIRRORED_REPEAT") return gl.MIRRORED_REPEAT;
  return gl.REPEAT;
}

// ---------------------------------------------------------------------------
// LIGHTING COMPONENT TOGGLES — Challenge F
// ---------------------------------------------------------------------------

export interface LightingComponents {
  ambient: boolean;
  diffuse: boolean;
  specular: boolean;
}

export const BACKGROUND_COLOR: [number, number, number, number] = [0.025, 0.04, 0.08, 1.0];
