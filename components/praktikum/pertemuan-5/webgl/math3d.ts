// Mat4 and Vec3 helpers — identical to Pertemuan 4's math3d.ts, reused as-is
// per this module's own instruction ("Gunakan helper matrix 4×4 seperti
// Pertemuan 4"). Lighting needs nothing new here: Normal Matrix construction
// lives in scene.ts instead, since it operates on a Model Matrix this file
// already knows how to build.
//
// Storage is column-major: column 0 lives at indices 0-3, column 1 at 4-7,
// column 2 at 8-11 and column 3 at 12-15. That is what
// gl.uniformMatrix4fv(loc, false, matrix) expects, and what the vertex
// shader's `u_projection * u_view * u_model * vec4(a_position, 1.0)` computes
// under the column-vector convention.
//
// multiply(a, b) returns a × b, exactly like Pertemuan 3's Mat3.multiply, so
// the composition rule carries over unchanged: folding matrices in
// left-to-right from identity makes the FIRST one folded in the OUTERMOST
// transform (applied to the point LAST).

export type Mat4Array = Float32Array;

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** Converts degrees to radians — trigonometry and the projection maths need radians. */
export function degToRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

// ---------------------------------------------------------------------------
// VECTOR MATH — only what lookAt() needs to build a camera basis
// ---------------------------------------------------------------------------

export const Vec3 = {
  subtract(a: Vec3, b: Vec3): Vec3 {
    return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
  },

  /** Perpendicular to both inputs — this is what turns "up" and "back" into "right". */
  cross(a: Vec3, b: Vec3): Vec3 {
    return {
      x: a.y * b.z - a.z * b.y,
      y: a.z * b.x - a.x * b.z,
      z: a.x * b.y - a.y * b.x,
    };
  },

  dot(a: Vec3, b: Vec3): number {
    return a.x * b.x + a.y * b.y + a.z * b.z;
  },

  length(v: Vec3): number {
    return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  },

  /** Unit-length copy. A (near) zero-length vector is returned as zero rather than NaN. */
  normalize(v: Vec3): Vec3 {
    const len = Vec3.length(v);
    if (len < 1e-6) return { x: 0, y: 0, z: 0 };
    return { x: v.x / len, y: v.y / len, z: v.z / len };
  },
};

// ---------------------------------------------------------------------------
// MATRIX CONSTRUCTORS
// ---------------------------------------------------------------------------

export const Mat4 = {
  identity(): Mat4Array {
    return new Float32Array([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1,
    ]);
  },

  /** Translation lives in the last column (indices 12-14) under column-major storage. */
  translation(tx: number, ty: number, tz: number): Mat4Array {
    return new Float32Array([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      tx, ty, tz, 1,
    ]);
  },

  scaling(sx: number, sy: number, sz: number): Mat4Array {
    return new Float32Array([
      sx, 0, 0, 0,
      0, sy, 0, 0,
      0, 0, sz, 0,
      0, 0, 0, 1,
    ]);
  },

  /** Rotation about the X axis — Y and Z mix, X is untouched. */
  rotationX(rad: number): Mat4Array {
    const c = Math.cos(rad);
    const s = Math.sin(rad);
    return new Float32Array([
      1, 0, 0, 0,
      0, c, s, 0,
      0, -s, c, 0,
      0, 0, 0, 1,
    ]);
  },

  /** Rotation about the Y axis — the "spinning on a turntable" one. */
  rotationY(rad: number): Mat4Array {
    const c = Math.cos(rad);
    const s = Math.sin(rad);
    return new Float32Array([
      c, 0, -s, 0,
      0, 1, 0, 0,
      s, 0, c, 0,
      0, 0, 0, 1,
    ]);
  },

  /** Rotation about the Z axis — identical to Pertemuan 3's 2D rotation, lifted to 4×4. */
  rotationZ(rad: number): Mat4Array {
    const c = Math.cos(rad);
    const s = Math.sin(rad);
    return new Float32Array([
      c, s, 0, 0,
      -s, c, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1,
    ]);
  },

  /**
   * Returns a × b (both operands column-major).
   *
   * out(row, col) = sum over k of a(row, k) * b(k, col), which in flat
   * column-major indexing is out[c*4+r] = sum_k a[k*4+r] * b[c*4+k].
   */
  multiply(a: Mat4Array, b: Mat4Array): Mat4Array {
    const out = new Float32Array(16);

    for (let c = 0; c < 4; c++) {
      for (let r = 0; r < 4; r++) {
        out[c * 4 + r] =
          a[r] * b[c * 4] +
          a[4 + r] * b[c * 4 + 1] +
          a[8 + r] * b[c * 4 + 2] +
          a[12 + r] * b[c * 4 + 3];
      }
    }

    return out;
  },

  // -------------------------------------------------------------------------
  // PROJECTION MATRICES
  // -------------------------------------------------------------------------

  /**
   * Perspective projection: a truncated pyramid (frustum) mapped into the clip
   * cube. The -1 sitting in the third column's w row is what makes this
   * "perspective" at all — it copies -z into the clip w, so the perspective
   * divide that follows shrinks distant geometry by its own depth.
   */
  perspective(fovYRad: number, aspect: number, near: number, far: number): Mat4Array {
    const f = 1 / Math.tan(fovYRad / 2);
    const rangeInv = 1 / (near - far);

    return new Float32Array([
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (far + near) * rangeInv, -1,
      0, 0, 2 * far * near * rangeInv, 0,
    ]);
  },

  // -------------------------------------------------------------------------
  // VIEW MATRIX
  // -------------------------------------------------------------------------

  /**
   * Builds the View Matrix directly (the inverse of the camera's world
   * transform), so world coordinates come out expressed relative to the camera.
   *
   * The camera basis is derived rather than stored: zAxis points from the
   * target BACK towards the eye (WebGL cameras look down their own -Z), xAxis
   * is "right", yAxis is the corrected "up". Because that basis is orthonormal,
   * its inverse is simply its transpose — which is why the three axes appear
   * laid out in ROWS below, with the translation replaced by -dot(axis, eye).
   */
  lookAt(eye: Vec3, target: Vec3, up: Vec3): Mat4Array {
    const zAxis = Vec3.normalize(Vec3.subtract(eye, target));

    // Degenerate case: looking straight down (or up) makes `up` parallel to
    // zAxis, so their cross product collapses to zero and every axis becomes
    // NaN — a black canvas. A fallback up-vector is substituted instead of
    // letting the frame break.
    let right = Vec3.cross(up, zAxis);
    if (Vec3.length(right) < 1e-6) {
      right = Vec3.cross({ x: 0, y: 0, z: 1 }, zAxis);
    }

    const xAxis = Vec3.normalize(right);
    const yAxis = Vec3.cross(zAxis, xAxis);

    return new Float32Array([
      xAxis.x, yAxis.x, zAxis.x, 0,
      xAxis.y, yAxis.y, zAxis.y, 0,
      xAxis.z, yAxis.z, zAxis.z, 0,
      -Vec3.dot(xAxis, eye), -Vec3.dot(yAxis, eye), -Vec3.dot(zAxis, eye), 1,
    ]);
  },
};

// ---------------------------------------------------------------------------
// NORMAL MATRIX — new in Pertemuan 5
// ---------------------------------------------------------------------------

/**
 * Normal Matrix = inverse-transpose of the Model Matrix's upper-left 3×3
 * (its linear part — rotation and scale, with translation dropped since a
 * direction has no position to translate).
 *
 * Why not just reuse the Model Matrix for normals? Rotation alone would be
 * fine — a rotation's inverse is its own transpose, so "inverse-transpose"
 * collapses back to the rotation itself. Uniform scale would also be fine up
 * to a constant factor. NON-uniform scale is where it breaks: scaling a
 * surface unevenly tilts it, and the normal needs to tilt by the *inverse* of
 * that, not by the same factor, to stay perpendicular to the new surface.
 * Experiment Wajib 9 makes this concrete by scaling the cube to (1.8, 0.6, 1.0)
 * and comparing against skipping this step.
 */
export function normalMatrixFromMat4(m: Mat4Array): Float32Array {
  const a00 = m[0];
  const a01 = m[1];
  const a02 = m[2];

  const a10 = m[4];
  const a11 = m[5];
  const a12 = m[6];

  const a20 = m[8];
  const a21 = m[9];
  const a22 = m[10];

  const b01 = a22 * a11 - a12 * a21;
  const b11 = -a22 * a10 + a12 * a20;
  const b21 = a21 * a10 - a11 * a20;

  let det = a00 * b01 + a01 * b11 + a02 * b21;

  if (Math.abs(det) < 0.000001) {
    return new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);
  }

  det = 1.0 / det;

  const inv00 = b01 * det;
  const inv01 = (-a22 * a01 + a02 * a21) * det;
  const inv02 = (a12 * a01 - a02 * a11) * det;

  const inv10 = b11 * det;
  const inv11 = (a22 * a00 - a02 * a20) * det;
  const inv12 = (-a12 * a00 + a02 * a10) * det;

  const inv20 = b21 * det;
  const inv21 = (-a21 * a00 + a01 * a20) * det;
  const inv22 = (a11 * a00 - a01 * a10) * det;

  // transpose(inverse): rows and columns of the inverse above swapped.
  return new Float32Array([inv00, inv10, inv20, inv01, inv11, inv21, inv02, inv12, inv22]);
}
