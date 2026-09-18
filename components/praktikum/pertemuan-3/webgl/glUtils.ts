// Thin helpers around the raw WebGL2 API.
//
// Every object in this scene shares one property Pertemuan 2's objects did
// not: its vertex buffer is uploaded exactly once and never rewritten. Moving,
// spinning or resizing an object only ever changes the Model Matrix uniform
// sent alongside the same static buffer.

/** Attribute and uniform locations, looked up once after linking. */
export interface ProgramLocations {
  position: number;
  matrix: WebGLUniformLocation | null;
  color: WebGLUniformLocation | null;
  pointSize: WebGLUniformLocation | null;
}

/** A geometry uploaded once to the GPU. Nothing here ever changes after creation. */
export interface StaticMesh {
  buffer: WebGLBuffer;
  vertexCount: number;
  /** A `gl.TRIANGLES` / `gl.LINES` / `gl.POINTS` constant, fixed at creation. */
  mode: number;
}

// ---------------------------------------------------------------------------
// SHADER COMPILATION
// ---------------------------------------------------------------------------

/**
 * Compiles one shader stage and reports the driver's error log on failure.
 *
 * Reading getShaderInfoLog() is the difference between "the canvas is blank"
 * and knowing exactly which GLSL line was rejected, so the log is never
 * swallowed silently.
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
// STATIC MESHES
// ---------------------------------------------------------------------------

/**
 * Uploads local-space vertex positions once, with STATIC_DRAW — this scene
 * never re-uploads a buffer, since every animation lives in the Model Matrix
 * instead (module section 9 & 15).
 */
export function createStaticMesh(
  gl: WebGL2RenderingContext,
  positions: Float32Array,
  mode: number,
): StaticMesh | null {
  const buffer = gl.createBuffer();
  if (!buffer) {
    console.error("[WebGL] gl.createBuffer() returned null");
    return null;
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

  return { buffer, vertexCount: positions.length / 2, mode };
}

export function deleteMesh(gl: WebGL2RenderingContext, mesh: StaticMesh) {
  gl.deleteBuffer(mesh.buffer);
}

// ---------------------------------------------------------------------------
// DRAWING
// ---------------------------------------------------------------------------

/**
 * Binds one mesh, uploads its Model Matrix and colour, and issues its draw
 * call. The attribute is re-pointed at this mesh's buffer every call rather
 * than cached in a Vertex Array Object, keeping the buffer -> attribute wiring
 * explicit (same trade-off Pertemuan 2 makes).
 */
export function drawMesh(
  gl: WebGL2RenderingContext,
  locations: ProgramLocations,
  mesh: StaticMesh,
  matrix: Float32Array,
  color: Float32Array,
  pointSize = 8,
) {
  gl.bindBuffer(gl.ARRAY_BUFFER, mesh.buffer);
  gl.enableVertexAttribArray(locations.position);
  gl.vertexAttribPointer(locations.position, 2, gl.FLOAT, false, 0, 0);

  // `false`: WebGL does not transpose the uniform for us, so the Float32Array
  // must already be column-major (module section 27).
  gl.uniformMatrix3fv(locations.matrix, false, matrix);
  gl.uniform4fv(locations.color, color);
  gl.uniform1f(locations.pointSize, pointSize);

  gl.drawArrays(mesh.mode, 0, mesh.vertexCount);
}
