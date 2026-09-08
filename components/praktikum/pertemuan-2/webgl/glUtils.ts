// Thin helpers around the raw WebGL2 API.
//
// These wrap the boilerplate of the pipeline — compile, link, upload, draw —
// without hiding the individual calls, so the sequence taught in the module
// stays visible:
//
//   vertex data -> buffer -> attribute -> vertex shader -> rasterizer
//   -> fragment shader -> framebuffer -> canvas

import type { DrawMode, Geometry, Rgb } from "./scene";

/** Attribute and uniform locations, looked up once after linking. */
export interface ProgramLocations {
  position: number;
  color: number;
  pointSize: WebGLUniformLocation | null;
}

/** A geometry that has been uploaded to the GPU and can be drawn. */
export interface Drawable {
  label: string;
  /** Untranslated vertex positions; the source of truth the offset is applied to. */
  basePositions: Float32Array;
  /** Scratch array reused every upload so animation does not allocate per frame. */
  scratchPositions: Float32Array;
  colors: Float32Array;
  mode: DrawMode;
  vertexCount: number;
  positionBuffer: WebGLBuffer;
  colorBuffer: WebGLBuffer;
  pointSize: number;
  offsetX: number;
  offsetY: number;
  velocityX: number;
  velocityY: number;
  /** True when the object moves, so its position buffer is re-uploaded each frame. */
  dynamic: boolean;
}

export interface DrawableOptions {
  pointSize?: number;
  offsetX?: number;
  offsetY?: number;
  velocityX?: number;
  velocityY?: number;
  dynamic?: boolean;
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

/**
 * Links a vertex and a fragment shader into a program.
 *
 * Linking is where the two stages are checked against each other: every `out`
 * of the vertex shader must match an `in` of the fragment shader by name and
 * type, so a mismatch surfaces here rather than at compile time.
 */
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
// BUFFERS
// ---------------------------------------------------------------------------

/**
 * Uploads one geometry into a pair of GPU buffers (positions and colours).
 *
 * Static objects are uploaded once with STATIC_DRAW, which tells the driver the
 * data will not change and may be placed in memory optimised for reading.
 * Moving objects use DYNAMIC_DRAW because their positions are rewritten every
 * frame — this meeting has no transformation matrix yet, so translation means
 * literally re-sending the vertices.
 */
export function createDrawable(
  gl: WebGL2RenderingContext,
  label: string,
  geometry: Geometry,
  options: DrawableOptions = {},
): Drawable | null {
  const positionBuffer = gl.createBuffer();
  const colorBuffer = gl.createBuffer();

  if (!positionBuffer || !colorBuffer) {
    console.error(`[WebGL] failed to create buffers for "${label}"`);
    return null;
  }

  const dynamic = options.dynamic ?? false;
  const usage = dynamic ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW;

  const drawable: Drawable = {
    label,
    basePositions: geometry.positions,
    scratchPositions: new Float32Array(geometry.positions.length),
    colors: geometry.colors,
    mode: geometry.mode,
    // 2 floats per vertex, so the vertex count is half the array length.
    vertexCount: geometry.positions.length / 2,
    positionBuffer,
    colorBuffer,
    pointSize: options.pointSize ?? 8,
    offsetX: options.offsetX ?? 0,
    offsetY: options.offsetY ?? 0,
    velocityX: options.velocityX ?? 0,
    velocityY: options.velocityY ?? 0,
    dynamic,
  };

  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, applyOffset(drawable), usage);

  gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, drawable.colors, gl.STATIC_DRAW);

  return drawable;
}

/**
 * Writes `basePositions + offset` into the reusable scratch array.
 *
 * Translating by rewriting vertices is the Pertemuan 2 approach; Pertemuan 3
 * replaces it with a transformation matrix applied inside the vertex shader.
 */
function applyOffset(drawable: Drawable): Float32Array {
  const { basePositions, scratchPositions, offsetX, offsetY } = drawable;

  for (let i = 0; i < basePositions.length; i += 2) {
    scratchPositions[i] = basePositions[i] + offsetX;
    scratchPositions[i + 1] = basePositions[i + 1] + offsetY;
  }

  return scratchPositions;
}

/** Re-uploads a moving object's translated vertices to its GPU buffer. */
export function uploadPositions(gl: WebGL2RenderingContext, drawable: Drawable) {
  gl.bindBuffer(gl.ARRAY_BUFFER, drawable.positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, applyOffset(drawable), gl.DYNAMIC_DRAW);
}

/** Replaces every vertex colour of a drawable — used when the player changes colour. */
export function setDrawableColor(gl: WebGL2RenderingContext, drawable: Drawable, rgb: Rgb) {
  for (let i = 0; i < drawable.vertexCount; i++) {
    drawable.colors.set(rgb, i * 3);
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, drawable.colorBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, drawable.colors, gl.STATIC_DRAW);
}

/** Releases the GPU buffers owned by a drawable. */
export function deleteDrawable(gl: WebGL2RenderingContext, drawable: Drawable) {
  gl.deleteBuffer(drawable.positionBuffer);
  gl.deleteBuffer(drawable.colorBuffer);
}

// ---------------------------------------------------------------------------
// ATTRIBUTES & DRAWING
// ---------------------------------------------------------------------------

/**
 * Points the shader attributes at this drawable's buffers.
 *
 * An attribute does not remember a buffer by itself. vertexAttribPointer()
 * captures whichever buffer is bound to ARRAY_BUFFER *at that moment*, so the
 * bind must always come first. This is re-done per object rather than cached in
 * a Vertex Array Object, to keep the buffer -> attribute wiring explicit.
 */
export function setupAttributes(
  gl: WebGL2RenderingContext,
  locations: ProgramLocations,
  drawable: Drawable,
) {
  // Position: 2 floats per vertex.
  gl.bindBuffer(gl.ARRAY_BUFFER, drawable.positionBuffer);
  gl.enableVertexAttribArray(locations.position);
  gl.vertexAttribPointer(locations.position, 2, gl.FLOAT, false, 0, 0);

  // Colour: 3 floats per vertex.
  gl.bindBuffer(gl.ARRAY_BUFFER, drawable.colorBuffer);
  gl.enableVertexAttribArray(locations.color);
  gl.vertexAttribPointer(locations.color, 3, gl.FLOAT, false, 0, 0);
}

/** Binds a drawable's buffers and issues its draw call. */
export function drawDrawable(
  gl: WebGL2RenderingContext,
  locations: ProgramLocations,
  drawable: Drawable,
) {
  setupAttributes(gl, locations, drawable);
  gl.uniform1f(locations.pointSize, drawable.pointSize);
  gl.drawArrays(gl[drawable.mode], 0, drawable.vertexCount);
}
