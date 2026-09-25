// Thin helpers around the raw WebGL2 API, following Pertemuan 3's glUtils.ts.
//
// The difference here is that a mesh carries TWO buffers — positions and
// per-vertex colours — and that positions are vec3 rather than vec2, because
// the scene finally has a depth axis to place things along.

/** Attribute and uniform locations, looked up once after linking. */
export interface ProgramLocations {
  position: number;
  color: number;
  model: WebGLUniformLocation | null;
  view: WebGLUniformLocation | null;
  projection: WebGLUniformLocation | null;
  tint: WebGLUniformLocation | null;
}

/** A geometry uploaded once to the GPU. Nothing here changes after creation. */
export interface Mesh {
  positionBuffer: WebGLBuffer;
  colorBuffer: WebGLBuffer;
  vertexCount: number;
}

// ---------------------------------------------------------------------------
// SHADER COMPILATION
// ---------------------------------------------------------------------------

/**
 * Compiles one shader stage and reports the driver's error log on failure.
 * Reading getShaderInfoLog() is the difference between "the canvas is blank"
 * and knowing which GLSL line was rejected, so the log is never swallowed.
 */
export function createShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) {
    console.error("[WebGL] gl.createShader() returned null");
    return null;
  }

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const stage = type === gl.VERTEX_SHADER ? "vertex" : "fragment";
    console.error(`[WebGL] ${stage} shader failed to compile:\n`, gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}

/** Links a vertex and a fragment shader into a program. */
export function createProgram(
  gl: WebGL2RenderingContext,
  vertexShader: WebGLShader,
  fragmentShader: WebGLShader,
): WebGLProgram | null {
  const program = gl.createProgram();
  if (!program) {
    console.error("[WebGL] gl.createProgram() returned null");
    return null;
  }

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error("[WebGL] program failed to link:\n", gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }

  return program;
}

// ---------------------------------------------------------------------------
// MESH
// ---------------------------------------------------------------------------

/**
 * Uploads positions and colours once, with STATIC_DRAW. Nothing in this scene
 * ever re-uploads a buffer: movement lives entirely in the matrices, exactly as
 * Pertemuan 3 established.
 */
export function createMesh(
  gl: WebGL2RenderingContext,
  positions: Float32Array,
  colors: Float32Array,
): Mesh | null {
  const positionBuffer = gl.createBuffer();
  const colorBuffer = gl.createBuffer();

  if (!positionBuffer || !colorBuffer) {
    console.error("[WebGL] gl.createBuffer() returned null");
    if (positionBuffer) gl.deleteBuffer(positionBuffer);
    if (colorBuffer) gl.deleteBuffer(colorBuffer);
    return null;
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

  gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, colors, gl.STATIC_DRAW);

  // 3 floats per vertex, since positions are now vec3.
  return { positionBuffer, colorBuffer, vertexCount: positions.length / 3 };
}

export function deleteMesh(gl: WebGL2RenderingContext, mesh: Mesh) {
  gl.deleteBuffer(mesh.positionBuffer);
  gl.deleteBuffer(mesh.colorBuffer);
}

// ---------------------------------------------------------------------------
// DRAWING
// ---------------------------------------------------------------------------

/**
 * Points both attributes at the mesh's buffers. Called once per frame rather
 * than cached in a Vertex Array Object, keeping the buffer -> attribute wiring
 * explicit — the same trade-off Pertemuan 2 and 3 make.
 */
export function bindMesh(gl: WebGL2RenderingContext, locations: ProgramLocations, mesh: Mesh) {
  gl.bindBuffer(gl.ARRAY_BUFFER, mesh.positionBuffer);
  gl.enableVertexAttribArray(locations.position);
  gl.vertexAttribPointer(locations.position, 3, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, mesh.colorBuffer);
  gl.enableVertexAttribArray(locations.color);
  gl.vertexAttribPointer(locations.color, 3, gl.FLOAT, false, 0, 0);
}

/**
 * Draws one instance of an already-bound mesh: upload its Model Matrix and
 * tint, then issue the draw call. View and Projection are uploaded once per
 * frame by the caller, since every object in a frame shares them.
 *
 * `false` on uniformMatrix4fv: WebGL does not transpose for us, so the
 * Float32Array must already be column-major.
 */
export function drawMeshInstance(
  gl: WebGL2RenderingContext,
  locations: ProgramLocations,
  mesh: Mesh,
  modelMatrix: Float32Array,
  tint: Float32Array,
) {
  gl.uniformMatrix4fv(locations.model, false, modelMatrix);
  gl.uniform3fv(locations.tint, tint);
  gl.drawArrays(gl.TRIANGLES, 0, mesh.vertexCount);
}
