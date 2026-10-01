// Thin helpers around the raw WebGL2 API, following Pertemuan 3/4's glUtils.ts.
//
// New in this file relative to Pertemuan 4: a mesh now carries FOUR buffers
// (position, two alternative normal sets, and UV) instead of two, and there
// is a texture object alongside the geometry.

import type { FilterMode, WrapMode } from "./scene";
import { wrapModeToGLEnum } from "./scene";

/** Attribute and uniform locations, looked up once after linking. */
export interface ProgramLocations {
  position: number;
  normal: number;
  texCoord: number;
  model: WebGLUniformLocation | null;
  view: WebGLUniformLocation | null;
  projection: WebGLUniformLocation | null;
  normalMatrix: WebGLUniformLocation | null;
  uvScale: WebGLUniformLocation | null;
  lightPosition: WebGLUniformLocation | null;
  lightColor: WebGLUniformLocation | null;
  cameraPosition: WebGLUniformLocation | null;
  ambientStrength: WebGLUniformLocation | null;
  shininess: WebGLUniformLocation | null;
  texture: WebGLUniformLocation | null;
  ambientOn: WebGLUniformLocation | null;
  diffuseOn: WebGLUniformLocation | null;
  specularOn: WebGLUniformLocation | null;
}

/** A cube uploaded once to the GPU. Position/UV never change; FLAT vs SMOOTH just
 *  picks which of the two normal buffers gets bound before the draw call. */
export interface CubeMesh {
  positionBuffer: WebGLBuffer;
  flatNormalBuffer: WebGLBuffer;
  smoothNormalBuffer: WebGLBuffer;
  texCoordBuffer: WebGLBuffer;
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
 * Uploads position, both normal sets, and UV once, with STATIC_DRAW. Nothing
 * here ever re-uploads a buffer — the cube spins and resizes entirely through
 * its Model Matrix, exactly as Pertemuan 3 and 4 established.
 */
export function createCubeMesh(
  gl: WebGL2RenderingContext,
  positions: Float32Array,
  flatNormals: Float32Array,
  smoothNormals: Float32Array,
  texCoords: Float32Array,
): CubeMesh | null {
  const positionBuffer = gl.createBuffer();
  const flatNormalBuffer = gl.createBuffer();
  const smoothNormalBuffer = gl.createBuffer();
  const texCoordBuffer = gl.createBuffer();

  if (!positionBuffer || !flatNormalBuffer || !smoothNormalBuffer || !texCoordBuffer) {
    console.error("[WebGL] gl.createBuffer() returned null");
    return null;
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

  gl.bindBuffer(gl.ARRAY_BUFFER, flatNormalBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, flatNormals, gl.STATIC_DRAW);

  gl.bindBuffer(gl.ARRAY_BUFFER, smoothNormalBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, smoothNormals, gl.STATIC_DRAW);

  gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);

  return {
    positionBuffer,
    flatNormalBuffer,
    smoothNormalBuffer,
    texCoordBuffer,
    vertexCount: positions.length / 3,
  };
}

export function deleteCubeMesh(gl: WebGL2RenderingContext, mesh: CubeMesh) {
  gl.deleteBuffer(mesh.positionBuffer);
  gl.deleteBuffer(mesh.flatNormalBuffer);
  gl.deleteBuffer(mesh.smoothNormalBuffer);
  gl.deleteBuffer(mesh.texCoordBuffer);
}

/**
 * Points position/normal/UV attributes at the mesh's buffers. Which normal
 * buffer is bound is the ENTIRE difference between FLAT and SMOOTH shading —
 * the geometry and draw call are otherwise identical (module section 41/54).
 */
export function bindCubeMesh(
  gl: WebGL2RenderingContext,
  locations: ProgramLocations,
  mesh: CubeMesh,
  shadingMode: "FLAT" | "SMOOTH",
) {
  gl.bindBuffer(gl.ARRAY_BUFFER, mesh.positionBuffer);
  gl.enableVertexAttribArray(locations.position);
  gl.vertexAttribPointer(locations.position, 3, gl.FLOAT, false, 0, 0);

  const normalBuffer = shadingMode === "FLAT" ? mesh.flatNormalBuffer : mesh.smoothNormalBuffer;
  gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
  gl.enableVertexAttribArray(locations.normal);
  gl.vertexAttribPointer(locations.normal, 3, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, mesh.texCoordBuffer);
  gl.enableVertexAttribArray(locations.texCoord);
  gl.vertexAttribPointer(locations.texCoord, 2, gl.FLOAT, false, 0, 0);
}

// ---------------------------------------------------------------------------
// TEXTURE
// ---------------------------------------------------------------------------

/**
 * An 8×8 checkerboard, drawn procedurally onto an offscreen 2D canvas and
 * uploaded as a texture. No file to fetch means no CORS pitfalls and nothing
 * missing on first load — module section 21/45.
 */
export function createCheckerTexture(gl: WebGL2RenderingContext): WebGLTexture | null {
  const size = 64;
  const source = document.createElement("canvas");
  source.width = size;
  source.height = size;

  const ctx = source.getContext("2d");
  if (!ctx) {
    console.error("[WebGL] 2D context for checker texture unavailable");
    return null;
  }

  const cells = 8;
  const cellSize = size / cells;
  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < cells; x++) {
      const even = (x + y) % 2 === 0;
      ctx.fillStyle = even ? "#f8fafc" : "#0ea5e9";
      ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
    }
  }

  const texture = gl.createTexture();
  if (!texture) {
    console.error("[WebGL] gl.createTexture() returned null");
    return null;
  }

  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
  gl.generateMipmap(gl.TEXTURE_2D);

  return texture;
}

/** NEAREST keeps texels crisp (and visibly blocky up close); LINEAR blends between them. */
export function applyFiltering(gl: WebGL2RenderingContext, texture: WebGLTexture, mode: FilterMode) {
  gl.bindTexture(gl.TEXTURE_2D, texture);
  const filter = mode === "NEAREST" ? gl.NEAREST : gl.LINEAR;
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
}

/** Governs what happens once a scaled-up UV coordinate lands outside 0..1 (module section 20). */
export function applyWrapping(gl: WebGL2RenderingContext, texture: WebGLTexture, mode: WrapMode) {
  gl.bindTexture(gl.TEXTURE_2D, texture);
  const glMode = wrapModeToGLEnum(gl, mode);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, glMode);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, glMode);
}
