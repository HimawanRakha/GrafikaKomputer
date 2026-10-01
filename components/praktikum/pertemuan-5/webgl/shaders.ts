// GLSL source for the single shader program the cube is drawn with.
//
// Both sources must start with `#version 300 es` on the very first line — the
// GLSL ES 3.00 spec allows nothing before it, not even a blank line, so the
// template literals below open right at the directive.

// Vertex shader: runs once per vertex.
//
// Three things leave this stage for the rasterizer to interpolate: world
// position (lighting needs to know where on the surface a fragment sits),
// the transformed normal (which way that point on the surface faces), and the
// UV coordinate (where to sample the texture).
export const VERTEX_SHADER_SOURCE = `#version 300 es

in vec3 a_position;
in vec3 a_normal;
in vec2 a_texCoord;

uniform mat4 u_model;
uniform mat4 u_view;
uniform mat4 u_projection;

// Inverse-transpose of u_model's linear part — see math3d.ts for why a plain
// mat3(u_model) is not safe once scaling stops being uniform.
uniform mat3 u_normalMatrix;

uniform float u_uvScale;

out vec3 v_worldPosition;
out vec3 v_normal;
out vec2 v_texCoord;

void main() {
  vec4 worldPosition = u_model * vec4(a_position, 1.0);
  v_worldPosition = worldPosition.xyz;

  v_normal = u_normalMatrix * a_normal;

  // Scaling the UV, not the texture: values that land outside 0..1 are what
  // gives TEXTURE_WRAP_S/T something to do (module section 20).
  v_texCoord = a_texCoord * u_uvScale;

  gl_Position = u_projection * u_view * worldPosition;
}
`;

// Fragment shader: runs once per fragment (roughly, per pixel covered).
//
// Lighting is computed here rather than in the vertex shader so every one of
// the ~millions of fragments gets its own normal (interpolated smoothly
// across a face under SMOOTH shading) instead of just the 36 vertices —
// module section 32.
export const FRAGMENT_SHADER_SOURCE = `#version 300 es

precision highp float;

in vec3 v_worldPosition;
in vec3 v_normal;
in vec2 v_texCoord;

uniform vec3 u_lightPosition;
uniform vec3 u_lightColor;
uniform vec3 u_cameraPosition;

uniform float u_ambientStrength;
uniform float u_shininess;

uniform sampler2D u_texture;

// Challenge F — isolate each lighting term to see its individual contribution.
uniform float u_ambientOn;
uniform float u_diffuseOn;
uniform float u_specularOn;

out vec4 outColor;

void main() {
  // Interpolating two unit vectors does not generally produce a unit vector,
  // so the normal is re-normalized here even though every vertex normal going
  // in was already unit length (module section 9).
  vec3 N = normalize(v_normal);
  vec3 L = normalize(u_lightPosition - v_worldPosition);
  vec3 V = normalize(u_cameraPosition - v_worldPosition);

  // Negative would mean the light is behind the surface — clamped to 0 so it
  // cannot subtract light instead of adding it.
  float diff = max(dot(N, L), 0.0);

  vec3 R = reflect(-L, N);
  float spec = 0.0;
  if (diff > 0.0) {
    spec = pow(max(dot(R, V), 0.0), u_shininess);
  }

  vec3 texColor = texture(u_texture, v_texCoord).rgb;

  vec3 ambient = u_ambientOn * u_ambientStrength * texColor;
  vec3 diffuse = u_diffuseOn * diff * u_lightColor * texColor;
  vec3 specular = u_specularOn * spec * u_lightColor;

  vec3 finalColor = ambient + diffuse + specular;
  outColor = vec4(finalColor, 1.0);
}
`;
