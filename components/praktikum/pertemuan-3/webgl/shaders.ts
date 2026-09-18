// GLSL source for the single shader program used by every object in the scene.
//
// Both sources must start with `#version 300 es` on the very first line — the
// GLSL ES 3.00 spec allows nothing before it, not even a blank line, so the
// template literals below deliberately open right at the directive.

// Vertex shader: runs once per vertex.
//
// Unlike Pertemuan 2, the incoming a_position is never touched on the CPU.
// u_matrix — the object's Model Matrix (translation × rotation × scaling,
// see scene.ts) — is what places, spins and sizes it, entirely on the GPU.
export const VERTEX_SHADER_SOURCE = `#version 300 es

in vec2 a_position;

uniform mat3 u_matrix;

// Only affects gl.POINTS draws (the pivot marker); ignored for triangles and lines.
uniform float u_pointSize;

void main() {
  // vec3(a_position, 1.0) lifts the 2D vertex into homogeneous coordinates,
  // so translation can be expressed as an ordinary matrix multiplication
  // alongside rotation and scaling instead of needing special-case code.
  vec3 transformed = u_matrix * vec3(a_position, 1.0);

  gl_Position = vec4(transformed.xy, 0.0, 1.0);
  gl_PointSize = u_pointSize;
}
`;

// Fragment shader: runs once per fragment (roughly, per pixel covered by the
// primitive).
export const FRAGMENT_SHADER_SOURCE = `#version 300 es

precision highp float;

// A uniform, not an attribute: every vertex of one draw call shares the same
// colour. One object = one draw call = one colour, so there is no need for
// Pertemuan 2's per-vertex a_color attribute here (module section 11).
uniform vec4 u_color;

out vec4 outColor;

void main() {
  outColor = u_color;
}
`;
