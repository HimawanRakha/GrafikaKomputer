// GLSL source for the single shader program every cube in the scene shares.
//
// Both sources must start with `#version 300 es` on the very first line — the
// GLSL ES 3.00 spec allows nothing before it, not even a blank line, so the
// template literals below open right at the directive.

// Vertex shader: runs once per vertex.
//
// The three matrices are kept as SEPARATE uniforms instead of one pre-multiplied
// MVP. Multiplying them on the CPU would be marginally cheaper, but keeping them
// apart makes each stage of the pipeline visible in the one line that matters —
// and lets the Model, View and Projection matrices be swapped independently
// while the other two stay put.
export const VERTEX_SHADER_SOURCE = `#version 300 es

in vec3 a_position;
in vec3 a_color;

uniform mat4 u_model;       // local space  -> world space
uniform mat4 u_view;        // world space  -> camera space
uniform mat4 u_projection;  // camera space -> clip space

out vec3 v_color;

void main() {
  // Read right to left: the vertex is placed in the world, then re-expressed
  // relative to the camera, then projected. w = 1.0 marks this as a POSITION
  // (a direction would use 0.0, so the matrices' translation columns skip it).
  gl_Position = u_projection * u_view * u_model * vec4(a_position, 1.0);

  // Passed through the rasterizer, which interpolates it across the face.
  v_color = a_color;
}
`;

// Fragment shader: runs once per fragment (roughly, per pixel covered).
export const FRAGMENT_SHADER_SOURCE = `#version 300 es

precision highp float;

in vec3 v_color;

// One value per draw call. Tinting lets all three cubes share a single vertex
// buffer and still be told apart, instead of uploading three coloured copies of
// the same 36 vertices.
uniform vec3 u_tint;

out vec4 outColor;

void main() {
  outColor = vec4(v_color * u_tint, 1.0);
}
`;
