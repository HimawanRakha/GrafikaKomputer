// Geometry, camera state and projection settings for the Pertemuan 4 scene.
// Like Pertemuan 3's scene.ts, nothing here touches the WebGL context — it
// stays pure data and maths so the camera logic can be read on its own.

import { Mat4, Vec3, degToRad, type Mat4Array, type Vec3 as Vec3Type } from "./math3d";

// ---------------------------------------------------------------------------
// CUBE GEOMETRY — 36 vertices, vec3, local space
// ---------------------------------------------------------------------------
//
// A cube has 6 faces, each face is 2 triangles, each triangle is 3 vertices:
// 6 × 2 × 3 = 36. Corners are deliberately NOT shared between faces (which
// would need only 8 vertices plus an index buffer) because each face carries
// its own flat colour — a shared corner would have to pick one face's colour
// and the other faces would bleed into it.
//
// Every face is wound counter-clockwise as seen from OUTSIDE the cube, the
// convention WebGL treats as front-facing.

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

  // Right face (x = +0.5)
  0.5, -0.5, 0.5,
  0.5, -0.5, -0.5,
  0.5, 0.5, -0.5,
  0.5, -0.5, 0.5,
  0.5, 0.5, -0.5,
  0.5, 0.5, 0.5,

  // Left face (x = -0.5)
  -0.5, -0.5, -0.5,
  -0.5, -0.5, 0.5,
  -0.5, 0.5, 0.5,
  -0.5, -0.5, -0.5,
  -0.5, 0.5, 0.5,
  -0.5, 0.5, -0.5,

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

/** One colour per face, in the same order the faces appear above. */
export const FACE_COLORS: [number, number, number][] = [
  [0.95, 0.30, 0.35], // front  — red
  [0.30, 0.80, 0.55], // back   — green
  [0.35, 0.60, 0.98], // right  — blue
  [0.98, 0.75, 0.25], // left   — amber
  [0.75, 0.45, 0.95], // top    — purple
  [0.25, 0.82, 0.88], // bottom — cyan
];

/**
 * Expands the 6 face colours into 36 per-vertex colours. Built with a loop
 * rather than written out, since all 6 vertices of a face repeat one value and
 * a hand-typed 108-number literal is a typo waiting to happen.
 */
function buildCubeColors(): Float32Array {
  const colors = new Float32Array(36 * 3);

  for (let face = 0; face < 6; face++) {
    const [r, g, b] = FACE_COLORS[face];
    for (let vertex = 0; vertex < 6; vertex++) {
      const offset = (face * 6 + vertex) * 3;
      colors[offset] = r;
      colors[offset + 1] = g;
      colors[offset + 2] = b;
    }
  }

  return colors;
}

export const CUBE_COLORS = buildCubeColors();

// ---------------------------------------------------------------------------
// CUBE INSTANCES — Challenge "tiga cube pada depth berbeda"
// ---------------------------------------------------------------------------

export interface CubeInstance {
  label: string;
  position: Vec3Type;
  scale: number;
  /** Multiplied with the vertex colour so three cubes can share one buffer yet stay distinct. */
  tint: Float32Array;
  /** Degrees per second about Y and X — different rates keep the scene readable. */
  spinSpeed: number;
  tiltSpeed: number;
}

/**
 * Listed NEAREST FIRST, and drawn in exactly this order.
 *
 * That ordering is deliberate: with the depth test ON the result is correct
 * regardless of order, but with it OFF the LAST cube drawn wins every
 * overlapping pixel — so the far cube visibly paints over the near one the
 * moment D is pressed. Drawing far-to-near instead would happen to look right
 * even without a depth buffer, hiding the very thing this scene is meant to
 * show (the painter's-algorithm failure a depth buffer exists to fix).
 */
export const CUBES: CubeInstance[] = [
  {
    label: "Cube depan",
    position: { x: -0.75, y: -0.3, z: 1.0 },
    scale: 1.1,
    tint: new Float32Array([1.0, 1.0, 1.0]),
    spinSpeed: 34,
    tiltSpeed: 19,
  },
  {
    label: "Cube tengah",
    position: { x: -0.15, y: 0.05, z: -1.5 },
    scale: 1.1,
    tint: new Float32Array([0.72, 0.88, 1.0]),
    spinSpeed: -26,
    tiltSpeed: 13,
  },
  {
    label: "Cube belakang",
    position: { x: 0.5, y: 0.4, z: -4.0 },
    scale: 1.1,
    tint: new Float32Array([1.0, 0.86, 0.66]),
    spinSpeed: 45,
    tiltSpeed: -22,
  },
];

/**
 * Model Matrix for one cube: M = T × Ry × Rx × S.
 *
 * Folded in as T, Ry, Rx, S so the point is scaled first, then tilted, then
 * spun, and only then moved into the world — the same "scale and rotate about
 * your own origin before you travel" rule as Pertemuan 3's Order A. Folding
 * these the other way round would swing each cube around the world origin
 * instead of spinning it in place.
 */
export function getCubeModelMatrix(cube: CubeInstance, seconds: number): Mat4Array {
  const t = Mat4.translation(cube.position.x, cube.position.y, cube.position.z);
  const ry = Mat4.rotationY(degToRad(seconds * cube.spinSpeed));
  const rx = Mat4.rotationX(degToRad(seconds * cube.tiltSpeed));
  const s = Mat4.scaling(cube.scale, cube.scale, cube.scale);

  let matrix = Mat4.identity();
  matrix = Mat4.multiply(matrix, t);
  matrix = Mat4.multiply(matrix, ry);
  matrix = Mat4.multiply(matrix, rx);
  matrix = Mat4.multiply(matrix, s);
  return matrix;
}

// ---------------------------------------------------------------------------
// CAMERA
// ---------------------------------------------------------------------------

export interface CameraState {
  /** Where the camera sits in world space. In orbit mode this is derived, not driven. */
  position: Vec3Type;
  /** What the camera looks at — also the centre the orbit mode revolves around. */
  target: Vec3Type;
  up: Vec3Type;
  /** Challenge: orbit camera. When true, Arrow/W/S drive the three values below instead. */
  orbit: boolean;
  azimuth: number; // degrees around Y
  elevation: number; // degrees above the horizon
  radius: number; // distance from target
}

/** Aimed at the centroid of the three cubes so the whole chain sits inside the frame. */
export const CAMERA_INITIAL: CameraState = {
  position: { x: 0, y: 0.75, z: 4.6 },
  target: { x: -0.28, y: -0.05, z: -1.45 },
  up: { x: 0, y: 1, z: 0 },
  orbit: false,
  azimuth: 0,
  elevation: 8,
  radius: 5.8,
};

/** Fresh copy of the starting camera — the nested vectors are cloned so Reset never aliases the constant. */
export function makeInitialCamera(): CameraState {
  return {
    position: { ...CAMERA_INITIAL.position },
    target: { ...CAMERA_INITIAL.target },
    up: { ...CAMERA_INITIAL.up },
    orbit: CAMERA_INITIAL.orbit,
    azimuth: CAMERA_INITIAL.azimuth,
    elevation: CAMERA_INITIAL.elevation,
    radius: CAMERA_INITIAL.radius,
  };
}

export const MOVE_SPEED = 2.6; // units / second
export const ORBIT_SPEED = 55; // degrees / second
export const ZOOM_SPEED = 3.2; // units / second
export const FOV_SPEED = 28; // degrees / second
export const MAX_DELTA_SECONDS = 0.05; // clamps deltaTime after a backgrounded tab

export const CLAMP_POSITION = 14;
export const CLAMP_RADIUS: [number, number] = [1.6, 18];
/** Elevation stops short of ±90° so `up` never becomes parallel to the view direction. */
export const CLAMP_ELEVATION = 85;

/** Position on a sphere around the target — the whole of the orbit camera, in three lines. */
export function orbitPosition(camera: CameraState): Vec3Type {
  const az = degToRad(camera.azimuth);
  const el = degToRad(camera.elevation);

  return {
    x: camera.target.x + camera.radius * Math.cos(el) * Math.sin(az),
    y: camera.target.y + camera.radius * Math.sin(el),
    z: camera.target.z + camera.radius * Math.cos(el) * Math.cos(az),
  };
}

/**
 * Inverse of orbitPosition(): reads azimuth/elevation/radius back out of wherever
 * the free camera currently is. Called when orbit mode is switched ON so the
 * camera continues from its current viewpoint instead of snapping somewhere else
 * mid-demo.
 */
export function syncOrbitFromPosition(camera: CameraState) {
  const offset = Vec3.subtract(camera.position, camera.target);
  const radius = Vec3.length(offset);
  if (radius < 1e-6) return;

  camera.radius = Math.max(CLAMP_RADIUS[0], Math.min(CLAMP_RADIUS[1], radius));
  camera.elevation = Math.max(
    -CLAMP_ELEVATION,
    Math.min(CLAMP_ELEVATION, (Math.asin(offset.y / radius) * 180) / Math.PI),
  );
  camera.azimuth = (Math.atan2(offset.x, offset.z) * 180) / Math.PI;
}

/** Keeps the free camera within reach and the orbit values inside their safe range. */
export function clampCamera(camera: CameraState) {
  camera.position.x = Math.max(-CLAMP_POSITION, Math.min(CLAMP_POSITION, camera.position.x));
  camera.position.y = Math.max(-CLAMP_POSITION, Math.min(CLAMP_POSITION, camera.position.y));
  camera.position.z = Math.max(-CLAMP_POSITION, Math.min(CLAMP_POSITION, camera.position.z));

  camera.radius = Math.max(CLAMP_RADIUS[0], Math.min(CLAMP_RADIUS[1], camera.radius));
  camera.elevation = Math.max(-CLAMP_ELEVATION, Math.min(CLAMP_ELEVATION, camera.elevation));
}

// ---------------------------------------------------------------------------
// PROJECTION
// ---------------------------------------------------------------------------

export type ProjectionMode = "perspective" | "orthographic";

export const FOV_INITIAL = 60;
export const CLAMP_FOV: [number, number] = [15, 120];

/** Challenge: FOV presets, bound to keys 1 / 2 / 3. */
export const FOV_PRESETS = [35, 60, 90];

export interface NearFarPreset {
  label: string;
  near: number;
  far: number;
}

/**
 * The first preset is the everyday "see everything" range. The other two
 * deliberately squeeze the frustum so the near and far planes slice through the
 * cubes — clipping is much easier to believe once you have watched a corner
 * disappear into the near plane.
 */
export const NEAR_FAR_PRESETS: NearFarPreset[] = [
  { label: "0.1 / 100 — longgar", near: 0.1, far: 100 },
  { label: "1 / 12 — sedang", near: 1, far: 12 },
  { label: "3.5 / 7.5 — memotong", near: 3.5, far: 7.5 },
];

export const BACKGROUND_COLOR: [number, number, number, number] = [0.012, 0.043, 0.086, 1.0];

/**
 * Builds the Projection Matrix for the active mode.
 *
 * The orthographic box is sized from the perspective frustum's height at the
 * TARGET distance, so pressing P does not make the scene jump in size. What
 * changes is only that near and far objects stop differing in scale — the
 * actual point of the comparison.
 */
export function buildProjection(
  mode: ProjectionMode,
  fovDegrees: number,
  aspect: number,
  near: number,
  far: number,
  distanceToTarget: number,
): Mat4Array {
  const fovRad = degToRad(fovDegrees);

  if (mode === "perspective") {
    return Mat4.perspective(fovRad, aspect, near, far);
  }

  const halfHeight = Math.tan(fovRad / 2) * distanceToTarget;
  const halfWidth = halfHeight * aspect;
  return Mat4.orthographic(-halfWidth, halfWidth, -halfHeight, halfHeight, near, far);
}

export const PROJECTION_LABELS: Record<ProjectionMode, string> = {
  perspective: "Perspective",
  orthographic: "Orthographic",
};
