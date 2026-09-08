// GLSL source for the single shader program used by every object in the scene.
//
// Both sources must start with `#version 300 es` on the very first line — the
// GLSL ES 3.00 spec allows nothing before it, not even a blank line, so the
// template literals below deliberately open right at the directive.

// Vertex shader: runs once per vertex.
//
// Positions are already written in Normalized Device Coordinates (-1..1), so
// gl_Position is just the incoming vec2 padded to a vec4. No transformation
// matrix is used here on purpose — that is the topic of Pertemuan 3.
//
// `a_color` is passed straight through to `v_color`. Anything a vertex shader
// writes to an `out` variable gets interpolated across the primitive by the
// rasterizer before the fragment shader sees it, which is what produces the
// gradient inside the triangle.
export const VERTEX_SHADER_SOURCE = `#version 300 es

in vec2 a_position;
in vec3 a_color;

// Only affects gl.POINTS draws; ignored for triangles and lines.
uniform float u_pointSize;

out vec3 v_color;

void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  gl_PointSize = u_pointSize;
  v_color = a_color;
}
`;

// Fragment shader: runs once per fragment (roughly, per pixel covered by the
// primitive). There are far more fragments than vertices, and each one receives
// an interpolated `v_color` rather than the raw per-vertex value.
export const FRAGMENT_SHADER_SOURCE = `#version 300 es

// GLSL ES has no default precision for float in fragment shaders, so one must
// be declared explicitly or the shader fails to compile.
precision highp float;

in vec3 v_color;

out vec4 outColor;

void main() {
  outColor = vec4(v_color, 1.0);
}
`;
