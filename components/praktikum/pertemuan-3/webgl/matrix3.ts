// Matrix3 helper matching the module's own API: identity, translation,
// rotation, scaling and multiply. Used to build each object's Model Matrix on
// the CPU before it is sent to the GPU as a single mat3 uniform.
//
// Storage is column-major — column 0 lives at indices 0-2, column 1 at 3-5,
// column 2 at 6-8 — matching what gl.uniformMatrix3fv(loc, false, matrix)
// expects and what the vertex shader's `u_matrix * vec3(position, 1.0)`
// computes (column-vector convention, module section 19-20).

export type Mat3Array = Float32Array;

export const Mat3 = {
  identity(): Mat3Array {
    return new Float32Array([
      1, 0, 0,
      0, 1, 0,
      0, 0, 1,
    ]);
  },

  translation(tx: number, ty: number): Mat3Array {
    return new Float32Array([
      1, 0, 0,
      0, 1, 0,
      tx, ty, 1,
    ]);
  },

  rotation(rad: number): Mat3Array {
    const c = Math.cos(rad);
    const s = Math.sin(rad);
    return new Float32Array([
      c, s, 0,
      -s, c, 0,
      0, 0, 1,
    ]);
  },

  scaling(sx: number, sy: number): Mat3Array {
    return new Float32Array([
      sx, 0, 0,
      0, sy, 0,
      0, 0, 1,
    ]);
  },

  /**
   * Returns a × b (standard matrix product; both operands column-major).
   *
   * Because a mat3 × vec3 in the shader puts the matrix on the left of the
   * point, folding matrices together left-to-right from identity — e.g.
   * `multiply(multiply(identity, X), Y)` — means X ends up as the OUTERMOST
   * (last-applied) transform and Y as the innermost (first-applied) one.
   * See scene.ts for why that direction matters.
   */
  multiply(a: Mat3Array, b: Mat3Array): Mat3Array {
    const a00 = a[0], a01 = a[1], a02 = a[2];
    const a10 = a[3], a11 = a[4], a12 = a[5];
    const a20 = a[6], a21 = a[7], a22 = a[8];

    const b00 = b[0], b01 = b[1], b02 = b[2];
    const b10 = b[3], b11 = b[4], b12 = b[5];
    const b20 = b[6], b21 = b[7], b22 = b[8];

    return new Float32Array([
      b00 * a00 + b01 * a10 + b02 * a20,
      b00 * a01 + b01 * a11 + b02 * a21,
      b00 * a02 + b01 * a12 + b02 * a22,

      b10 * a00 + b11 * a10 + b12 * a20,
      b10 * a01 + b11 * a11 + b12 * a21,
      b10 * a02 + b11 * a12 + b12 * a22,

      b20 * a00 + b21 * a10 + b22 * a20,
      b20 * a01 + b21 * a11 + b22 * a21,
      b20 * a02 + b21 * a12 + b22 * a22,
    ]);
  },
};

/** Converts degrees to radians — Math.sin()/Math.cos() only accept radians. */
export function degToRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}
