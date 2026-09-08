// Vertex data builders for the Pertemuan 2 scene.
//
// Everything here is pure JavaScript/TypeScript: each function returns plain
// Float32Array data in Normalized Device Coordinates. Nothing in this file
// touches the WebGL context, which keeps "what to draw" separate from "how to
// upload and draw it" (see glUtils.ts).

export type DrawMode = "TRIANGLES" | "LINE_LOOP" | "POINTS";

export const DRAW_MODES: DrawMode[] = ["TRIANGLES", "LINE_LOOP", "POINTS"];

export const DRAW_MODE_LABELS: Record<DrawMode, string> = {
  TRIANGLES: "Triangles",
  LINE_LOOP: "Lines",
  POINTS: "Points",
};

/** RGB in the 0..1 range that shaders expect — not the 0..255 range CSS uses. */
export type Rgb = [number, number, number];

/** Raw vertex data, before it has been uploaded to a GPU buffer. */
export interface Geometry {
  positions: Float32Array; // 2 floats per vertex (x, y) in NDC
  colors: Float32Array; // 3 floats per vertex (r, g, b) in 0..1
  mode: DrawMode;
}

// The canvas drawing buffer is 960x600, so one NDC unit spans 1.6x more pixels
// horizontally than vertically. NDC itself has no notion of aspect ratio: a
// shape built from a circle of radius r would come out as a wide ellipse. The
// procedural builders below divide their x component by this value so that
// round shapes stay round on screen.
export const CANVAS_WIDTH = 960;
export const CANVAS_HEIGHT = 600;
export const ASPECT = CANVAS_WIDTH / CANVAS_HEIGHT;

// ---------------------------------------------------------------------------
// COLOR HELPERS
// ---------------------------------------------------------------------------

/** Palette offered in the control panel, as hex so the swatches can use it directly. */
export const PALETTE = ["#ff5252", "#4ade80", "#38bdf8", "#22d3ee", "#f472b6", "#facc15"];

/** Converts a "#rrggbb" string into the 0..1 RGB triple shaders expect. */
export function hexToRgb(hex: string): Rgb {
  const value = parseInt(hex.replace("#", ""), 16);
  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
}

/** Picks a random palette entry; used by the "Random" colour button. */
export function randomPaletteColor(): string {
  return PALETTE[Math.floor(Math.random() * PALETTE.length)];
}

/**
 * Simple HSL -> RGB conversion, used to sweep hues around procedural shapes so
 * their vertex colours vary smoothly instead of being picked by hand.
 */
export function hslToRgb(h: number, s: number, l: number): Rgb {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)];
}

/** Repeats one colour for every vertex — used by solid, single-colour objects. */
function solidColors(vertexCount: number, rgb: Rgb): Float32Array {
  const colors = new Float32Array(vertexCount * 3);
  for (let i = 0; i < vertexCount; i++) {
    colors.set(rgb, i * 3);
  }
  return colors;
}

// ---------------------------------------------------------------------------
// GEOMETRY BUILDERS
// ---------------------------------------------------------------------------

/**
 * An isoceles triangle centred on (cx, cy). `halfW`/`halfH` are given in NDC
 * units, so the caller controls both size and proportions.
 */
export function makeTriangle(
  cx: number,
  cy: number,
  halfW: number,
  halfH: number,
  colors: [Rgb, Rgb, Rgb],
): Geometry {
  return {
    positions: new Float32Array([
      cx - halfW, cy - halfH, // V0 bottom-left
      cx + halfW, cy - halfH, // V1 bottom-right
      cx,         cy + halfH, // V2 apex
    ]),
    colors: new Float32Array([...colors[0], ...colors[1], ...colors[2]]),
    mode: "TRIANGLES",
  };
}

/** Convenience wrapper for triangles that use one colour on all three vertices. */
export function makeSolidTriangle(
  cx: number,
  cy: number,
  halfW: number,
  halfH: number,
  rgb: Rgb,
): Geometry {
  return makeTriangle(cx, cy, halfW, halfH, [rgb, rgb, rgb]);
}

/**
 * A rectangle assembled from two triangles (6 vertices, corners repeated).
 *
 * The GPU only rasterizes points, lines and triangles, so a quad has to be
 * split along one diagonal. Each corner keeps its own colour, and because the
 * shared diagonal vertices carry the same colours in both triangles, the
 * interpolation runs across the seam without a visible edge.
 */
export function makeRectangle(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  cornerColors: { bl: Rgb; br: Rgb; tl: Rgb; tr: Rgb },
): Geometry {
  const { bl, br, tl, tr } = cornerColors;
  return {
    positions: new Float32Array([
      // Triangle 1: bottom-left, bottom-right, top-left
      x0, y0,
      x1, y0,
      x0, y1,
      // Triangle 2: top-left, bottom-right, top-right
      x0, y1,
      x1, y0,
      x1, y1,
    ]),
    colors: new Float32Array([...bl, ...br, ...tl, ...tl, ...br, ...tr]),
    mode: "TRIANGLES",
  };
}

/**
 * A star outline built procedurally: `points * 2` vertices alternating between
 * an outer and an inner radius, drawn with LINE_LOOP so WebGL closes the ring
 * back to the first vertex automatically.
 */
export function makeStar(
  cx: number,
  cy: number,
  outerRadius: number,
  points = 5,
  innerRatio = 0.45,
): Geometry {
  const vertexCount = points * 2;
  const positions = new Float32Array(vertexCount * 2);
  const colors = new Float32Array(vertexCount * 3);

  for (let i = 0; i < vertexCount; i++) {
    const radius = i % 2 === 0 ? outerRadius : outerRadius * innerRatio;
    // Start at the top (-90 degrees) and step half a segment at a time.
    const angle = -Math.PI / 2 + (i * Math.PI) / points;

    positions[i * 2] = cx + (Math.cos(angle) * radius) / ASPECT;
    positions[i * 2 + 1] = cy + Math.sin(angle) * radius;

    // Sweep the hue around the loop so the colour interpolates along each edge.
    colors.set(hslToRgb((i / vertexCount) * 360, 0.75, 0.6), i * 3);
  }

  return { positions, colors, mode: "LINE_LOOP" };
}

/**
 * A regular polygon outline, used for spawned LINE_LOOP primitives.
 */
export function makePolygon(
  cx: number,
  cy: number,
  radius: number,
  sides: number,
  rgb: Rgb,
): Geometry {
  const positions = new Float32Array(sides * 2);

  for (let i = 0; i < sides; i++) {
    const angle = -Math.PI / 2 + (i * Math.PI * 2) / sides;
    positions[i * 2] = cx + (Math.cos(angle) * radius) / ASPECT;
    positions[i * 2 + 1] = cy + Math.sin(angle) * radius;
  }

  return { positions, colors: solidColors(sides, rgb), mode: "LINE_LOOP" };
}

/**
 * A grid of points generated with nested loops — the procedural pattern the
 * module asks for. Hue varies by column and lightness by row, so the grid
 * doubles as a demonstration that POINTS also receive per-vertex colour.
 */
export function makePointGrid(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  cols: number,
  rows: number,
): Geometry {
  const vertexCount = cols * rows;
  const positions = new Float32Array(vertexCount * 2);
  const colors = new Float32Array(vertexCount * 3);

  let i = 0;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      // Guard against division by zero when a grid is only one cell wide/tall.
      const u = cols > 1 ? col / (cols - 1) : 0;
      const v = rows > 1 ? row / (rows - 1) : 0;

      positions[i * 2] = x0 + (x1 - x0) * u;
      positions[i * 2 + 1] = y0 + (y1 - y0) * v;
      colors.set(hslToRgb(u * 300, 0.8, 0.45 + v * 0.25), i * 3);
      i++;
    }
  }

  return { positions, colors, mode: "POINTS" };
}

/**
 * A ring of points, used when a POINTS primitive is spawned by clicking. A
 * single point would be too small to read as a deliberate object.
 */
export function makePointRing(cx: number, cy: number, radius: number, count: number, rgb: Rgb): Geometry {
  const positions = new Float32Array(count * 2);

  for (let i = 0; i < count; i++) {
    const angle = (i * Math.PI * 2) / count;
    positions[i * 2] = cx + (Math.cos(angle) * radius) / ASPECT;
    positions[i * 2 + 1] = cy + Math.sin(angle) * radius;
  }

  return { positions, colors: solidColors(count, rgb), mode: "POINTS" };
}

/**
 * Geometry for a primitive spawned at the click position (Challenge C).
 * The shape produced follows whichever draw mode is currently selected.
 */
export function makeSpawnGeometry(mode: DrawMode, cx: number, cy: number, rgb: Rgb): Geometry {
  if (mode === "TRIANGLES") return makeSolidTriangle(cx, cy, 0.05, 0.07, rgb);
  if (mode === "LINE_LOOP") return makePolygon(cx, cy, 0.08, 6, rgb);
  return makePointRing(cx, cy, 0.07, 10, rgb);
}

// ---------------------------------------------------------------------------
// THE SHOWCASE SCENE
// ---------------------------------------------------------------------------

// Layout in NDC, arranged so the static objects never overlap each other and
// the moving objects get room to travel through:
//
//   +1 +------------------------------+
//      |↕ gradient       rectangle    |   y  0.20 .. 0.72
//    0 |↕ <--- bouncing triangle ---> |   y -0.12 .. 0.12
//      |↕ star           point grid   |   y -0.72 .. -0.20
//   -1 |↕         player       ⬈ hex  |   y -0.96 .. -0.80
//      +------------------------------+
//
// The vertical mover (↕) travels along x = -0.90, a lane the static objects do
// not reach. The diagonal mover (⬈) does cross them — Challenge D asks for three
// objects bouncing off the canvas border, so it cannot be confined to a lane.
// The "must not overlap" rule of Tugas Inti 1 applies to the static primitives.

const RED: Rgb = [1, 0.2, 0.2];
const GREEN: Rgb = [0.2, 1, 0.35];
const BLUE: Rgb = [0.25, 0.5, 1];

/** Triangle with three different vertex colours — the clearest interpolation demo. */
export function buildGradientTriangle(): Geometry {
  return makeTriangle(-0.55, 0.46, 0.25, 0.26, [RED, GREEN, BLUE]);
}

/** Rectangle built from two triangles, each corner a different colour. */
export function buildGradientRectangle(): Geometry {
  return makeRectangle(0.28, 0.22, 0.82, 0.68, {
    bl: [0.13, 0.83, 0.93], // cyan
    br: [0.96, 0.45, 0.71], // pink
    tl: [0.98, 0.8, 0.24], // amber
    tr: [0.55, 0.36, 0.96], // violet
  });
}

/** Line-based shape drawn with LINE_LOOP. */
export function buildStar(): Geometry {
  return makeStar(-0.55, -0.46, 0.28, 5, 0.45);
}

/** Procedural grid drawn with POINTS. */
export function buildPointGrid(): Geometry {
  return makePointGrid(0.32, -0.66, 0.82, -0.24, 7, 5);
}

// ---------------------------------------------------------------------------
// MOVING OBJECTS (Challenge D)
// ---------------------------------------------------------------------------

/**
 * One bouncing object: its geometry plus the starting position and velocity.
 *
 * These values double as the reset state, so `R` restores the whole set to the
 * exact arrangement it had on load.
 */
export interface MoverSpec {
  label: string;
  geometry: Geometry;
  offsetX: number;
  offsetY: number;
  velocityX: number;
  velocityY: number;
}

/**
 * The three moving objects Challenge D asks for, deliberately differing in all
 * three respects the module lists: starting position, speed, and direction.
 *
 * Velocities are expressed per 60fps frame and scaled by the real frame delta
 * in the render loop, so the speeds stay proportional on any refresh rate.
 */
export function buildMovers(): MoverSpec[] {
  return [
    {
      // Horizontal, fastest, travels the empty corridor across the middle.
      label: "Bouncing triangle",
      geometry: makeSolidTriangle(0, 0, 0.09, 0.11, [1, 0.55, 0.15]),
      offsetX: -0.7,
      offsetY: 0,
      velocityX: 0.007,
      velocityY: 0,
    },
    {
      // Vertical, slowest, confined to the empty lane at the left edge.
      label: "Vertical triangle",
      geometry: makeSolidTriangle(0, 0, 0.05, 0.07, [0.13, 0.83, 0.93]),
      offsetX: -0.9,
      offsetY: -0.4,
      velocityX: 0,
      velocityY: 0.005,
    },
    {
      // Diagonal, and drawn with LINE_LOOP so a moving object also demonstrates
      // a draw mode other than TRIANGLES.
      label: "Diagonal hexagon",
      geometry: makePolygon(0, 0, 0.07, 6, [0.65, 0.45, 0.98]),
      offsetX: 0.55,
      offsetY: -0.05,
      velocityX: 0.004,
      velocityY: 0.0065,
    },
  ];
}
