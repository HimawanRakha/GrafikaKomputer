// Mat4 and Vec3 helpers — the 3D counterpart of Pertemuan 3's matrix3.ts.
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
   *
   * `aspect` is width/height of the drawing buffer; passing a stale value is
   * what makes a cube look stretched after a resize.
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

  /**
   * Orthographic projection: a box mapped into the clip cube. There is no -1
   * in the w row, so w stays 1 and the perspective divide does nothing —
   * distance no longer affects on-screen size, which is exactly the visual
   * difference the P key demonstrates.
   */
  orthographic(
    left: number,
    right: number,
    bottom: number,
    top: number,
    near: number,
    far: number,
  ): Mat4Array {
    return new Float32Array([
      2 / (right - left), 0, 0, 0,
      0, 2 / (top - bottom), 0, 0,
      0, 0, -2 / (far - near), 0,
      -(right + left) / (right - left),
      -(top + bottom) / (top - bottom),
      -(far + near) / (far - near),
      1,
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
    // NaN — a black canvas. Reachable by simply holding ArrowUp, so a fallback
    // up-vector is substituted instead of letting the frame break.
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
