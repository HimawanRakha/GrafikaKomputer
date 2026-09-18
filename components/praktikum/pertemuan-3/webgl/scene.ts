// Vertex data, object state and transform composition for the Pertemuan 3
// scene. Nothing here touches the WebGL context — it stays pure data and math,
// same separation Pertemuan 2's scene.ts uses.

import { Mat3, degToRad, type Mat3Array } from "./matrix3";

export interface Transform {
  x: number;
  y: number;
  /** Degrees — Math.sin/cos only take radians, so degToRad() is applied when composing. */
  rotation: number;
  scaleX: number;
  scaleY: number;
}

export type TransformOrder = "A" | "B";

// ---------------------------------------------------------------------------
// GEOMETRY — local space, uploaded once, never rewritten (module section 9)
// ---------------------------------------------------------------------------

/** Object A and Object B's shared triangle — identical to the module's example. */
export const TRIANGLE_VERTICES = new Float32Array([
  -0.18, -0.15,
  0.18, -0.15,
  0.00, 0.22,
]);

/**
 * A "door": a unit rectangle whose LOCAL ORIGIN sits at its left-middle edge
 * instead of its centre (x runs 0..1, not -0.5..0.5). Rotating around (0,0)
 * therefore hinges the door at its edge instead of spinning it around its own
 * middle — no extra translate-to-pivot-and-back composition is needed,
 * because the geometry itself was authored around the pivot (module section
 * 55, "Eksperimen Pivot: Door Rotation").
 */
export const DOOR_VERTICES = new Float32Array([
  0, -0.5,
  1, -0.5,
  1, 0.5,

  0, -0.5,
  1, 0.5,
  0, 0.5,
]);

/** World-space X and Y axes through the origin, drawn with an identity matrix. */
export const AXIS_VERTICES = new Float32Array([
  -1, 0,
  1, 0,
  0, -1,
  0, 1,
]);

/** Single vertex at the local origin — the pivot marker (module section 54). */
export const PIVOT_MARKER_VERTEX = new Float32Array([0, 0]);

// ---------------------------------------------------------------------------
// COLOURS — sent as the u_color uniform, one per draw call
// ---------------------------------------------------------------------------

export const COLOR_A = new Float32Array([0.1, 0.75, 1.0, 1.0]);
export const COLOR_B = new Float32Array([1.0, 0.55, 0.1, 1.0]);
export const COLOR_DOOR = new Float32Array([0.65, 0.42, 0.2, 1.0]);
export const COLOR_PIVOT = new Float32Array([1.0, 0.95, 0.3, 1.0]);
export const COLOR_AXIS = new Float32Array([0.3, 0.42, 0.58, 1.0]);

// ---------------------------------------------------------------------------
// OBJECT A — keyboard/mouse controlled
// ---------------------------------------------------------------------------

export const OBJECT_A_INITIAL: Transform = { x: -0.35, y: 0, rotation: 0, scaleX: 1, scaleY: 1 };

export const MOVE_SPEED = 0.65; // units / second
export const ROTATION_SPEED = 100; // degrees / second
export const SCALE_SPEED = 0.8; // units / second
export const MAX_DELTA_SECONDS = 0.05; // clamps deltaTime after e.g. a backgrounded tab

export const CLAMP_X: [number, number] = [-0.8, 0.8];
export const CLAMP_Y: [number, number] = [-0.75, 0.75];
export const CLAMP_SCALE: [number, number] = [0.2, 2.5];

/**
 * Keeps Object A on screen and its scale sane. Negative scale is left out on
 * purpose (module section 37) so the practicum does not spill into reflection.
 */
export function clampTransform(transform: Transform) {
  transform.x = Math.max(CLAMP_X[0], Math.min(CLAMP_X[1], transform.x));
  transform.y = Math.max(CLAMP_Y[0], Math.min(CLAMP_Y[1], transform.y));
  transform.scaleX = Math.max(CLAMP_SCALE[0], Math.min(CLAMP_SCALE[1], transform.scaleX));
  transform.scaleY = Math.max(CLAMP_SCALE[0], Math.min(CLAMP_SCALE[1], transform.scaleY));
}

export interface Preset {
  label: string;
  transform: Transform;
}

/** Challenge B — three fixed transforms, selectable with the 1/2/3 keys. */
export const PRESETS: Preset[] = [
  { label: "Preset 1", transform: { x: -0.4, y: 0.2, rotation: 0, scaleX: 1, scaleY: 1 } },
  { label: "Preset 2", transform: { x: 0.0, y: 0.0, rotation: 45, scaleX: 1.5, scaleY: 1.5 } },
  { label: "Preset 3", transform: { x: 0.3, y: -0.2, rotation: 90, scaleX: 1.8, scaleY: 0.6 } },
];

// ---------------------------------------------------------------------------
// TRANSFORM ORDER COMPARISON — Challenge C
// ---------------------------------------------------------------------------
//
// Mat3.multiply(a, b) returns a × b. Folding matrices together left-to-right
// from identity — multiply(multiply(identity, X), Y) — therefore builds
// M = X × Y, and because the shader computes M × point, X (folded in first)
// ends up OUTERMOST (applied to the point LAST) while Y ends up innermost
// (applied FIRST). Composing in call-order [X, Y, Z] always yields the
// point-application order [Z, Y, X] — the reverse.
//
// The module's own createTRSMatrix folds in [S, R, T] — which by the rule
// above applies T first and S last, i.e. "Translate -> Rotate -> Scale", the
// reverse of the "Scale -> Rotate -> Translate" its own HUD label and section
// 26 diagram promise. createRTMatrix has the same reversal (folds in [T, R],
// which applies R first, then T — "Rotate -> Translate" though the label
// reads "Translate -> Rotate"). Both are fixed below by folding in the
// reverse of how each label reads, so the on-screen behaviour actually
// matches what it claims — exactly the check module section 69 ("Debugging
// Transform Order") asks you to make when an object orbits instead of
// spinning in place.

/**
 * "Scale -> Rotate -> Translate" (the point-application order): Object A
 * scales and spins around its own local origin first, and only afterwards is
 * that already-oriented shape moved to its world position. Matrix product
 * M = T × R × S, built by folding in T, then R, then S.
 */
export function composeOrderA(transform: Transform): Mat3Array {
  const t = Mat3.translation(transform.x, transform.y);
  const r = Mat3.rotation(degToRad(transform.rotation));
  const s = Mat3.scaling(transform.scaleX, transform.scaleY);

  let matrix = Mat3.identity();
  matrix = Mat3.multiply(matrix, t);
  matrix = Mat3.multiply(matrix, r);
  matrix = Mat3.multiply(matrix, s);
  return matrix;
}

/**
 * "Translate -> Rotate" (the point-application order): Object A is moved
 * away from the origin first, and that already-off-centre position is what
 * gets rotated — dragging it around the world origin instead of spinning it
 * in place (module section 51, "Mengapa Object Bisa Mengorbit?"). Matrix
 * product M = R × T, built by folding in R, then T. Scale is left out, same
 * as the module's own createRTMatrix.
 */
export function composeOrderB(transform: Transform): Mat3Array {
  const t = Mat3.translation(transform.x, transform.y);
  const r = Mat3.rotation(degToRad(transform.rotation));

  let matrix = Mat3.identity();
  matrix = Mat3.multiply(matrix, r);
  matrix = Mat3.multiply(matrix, t);
  return matrix;
}

export function composeTransform(transform: Transform, order: TransformOrder): Mat3Array {
  return order === "A" ? composeOrderA(transform) : composeOrderB(transform);
}

export const ORDER_LABELS: Record<TransformOrder, string> = {
  A: "Scale → Rotate → Translate",
  B: "Translate → Rotate (orbit)",
};

// ---------------------------------------------------------------------------
// OBJECT B — automatic animation (module section 42)
// ---------------------------------------------------------------------------

export const OBJECT_B_POSITION = { x: 0.42, y: 0 };

/** Continuous rotation plus a pulsing uniform scale; position never changes. */
export function getObjectBTransform(seconds: number): Transform {
  const rotation = seconds * 70;
  const scale = 1 + Math.sin(seconds * 2) * 0.25;
  return { x: OBJECT_B_POSITION.x, y: OBJECT_B_POSITION.y, rotation, scaleX: scale, scaleY: scale };
}

// ---------------------------------------------------------------------------
// DOOR — pivot demonstration (module section 55)
// ---------------------------------------------------------------------------

export const DOOR_POSITION = { x: 0.0, y: -0.6 };
export const DOOR_SIZE = { width: 0.5, height: 0.16 };

/** Swings back and forth like a hinged door, always composed with composeOrderA. */
export function getDoorTransform(seconds: number): Transform {
  const swing = Math.sin(seconds * 1.1) * 55;
  return {
    x: DOOR_POSITION.x,
    y: DOOR_POSITION.y,
    rotation: swing,
    scaleX: DOOR_SIZE.width,
    scaleY: DOOR_SIZE.height,
  };
}
