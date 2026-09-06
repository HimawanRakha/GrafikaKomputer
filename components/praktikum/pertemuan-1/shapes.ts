// Pure drawing helpers for user-created shapes.
// Kept free of React and of component state so every function here is just
// "data in -> pixels out", mirroring the DATA -> DRAWING split of the module.

export type ShapeKind = "line" | "rect" | "circle" | "triangle" | "star";

// Every shape is stored as the two points produced by a single mouse drag.
// One uniform representation keeps dragging, live preview, and the Random
// button working through the exact same code path.
export interface UserShape {
  kind: ShapeKind;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
}

export const SHAPE_KINDS: ShapeKind[] = ["line", "rect", "circle", "triangle", "star"];

// Active canvas tool. "demo" keeps the original click behaviour of the demo
// scene (cycle the ball colour + drop a circle); every other value draws.
export type Tool = "demo" | ShapeKind;

// Human readable labels for the Shapes panel.
export const SHAPE_LABELS: Record<ShapeKind, string> = {
  line: "Line",
  rect: "Rectangle",
  circle: "Circle",
  triangle: "Triangle",
  star: "Star",
};

// Converts an HSL triplet to a hex string. Needed because the hue slider thinks
// in HSL while <input type="color"> only accepts hex, so both controls have to
// meet in one representation.
export function hslToHex(h: number, s: number, l: number): string {
  const sN = s / 100;
  const lN = l / 100;
  const a = sN * Math.min(lN, 1 - lN);
  const k = (n: number) => (n + h / 30) % 12;
  const channel = (n: number) => lN - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  const toHex = (x: number) =>
    Math.round(x * 255)
      .toString(16)
      .padStart(2, "0");

  return `#${toHex(channel(0))}${toHex(channel(8))}${toHex(channel(4))}`;
}

// Reads the hue back out of a hex colour, so picking a colour with the native
// colour input can move the hue slider to match instead of leaving it stale.
export function hexToHue(hex: string): number {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!match) return 0;

  const int = parseInt(match[1], 16);
  const r = ((int >> 16) & 255) / 255;
  const g = ((int >> 8) & 255) / 255;
  const b = (int & 255) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const chroma = max - min;
  if (chroma === 0) return 0; // grey has no meaningful hue

  let hue: number;
  if (max === r) hue = ((g - b) / chroma) % 6;
  else if (max === g) hue = (b - r) / chroma + 2;
  else hue = (r - g) / chroma + 4;

  return Math.round(((hue * 60) + 360) % 360);
}

// Axis-aligned box that contains both drag points, regardless of drag direction.
function boundingBox(shape: UserShape) {
  const x = Math.min(shape.x1, shape.x2);
  const y = Math.min(shape.y1, shape.y2);
  return { x, y, width: Math.abs(shape.x2 - shape.x1), height: Math.abs(shape.y2 - shape.y1) };
}

// Distance between the two drag points, used as a radius by circle and star.
function dragRadius(shape: UserShape) {
  return Math.hypot(shape.x2 - shape.x1, shape.y2 - shape.y1);
}

// Builds a star path by alternating between an outer and an inner radius
// every half-step around the circle. Starts at the top so the star sits upright.
export function drawStarPath(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  spikes: number,
  outerR: number,
  innerR: number,
) {
  const step = Math.PI / spikes;
  let rot = -Math.PI / 2;

  ctx.beginPath();
  ctx.moveTo(cx, cy - outerR);
  for (let i = 0; i < spikes; i++) {
    rot += step;
    ctx.lineTo(cx + Math.cos(rot) * innerR, cy + Math.sin(rot) * innerR);
    rot += step;
    ctx.lineTo(cx + Math.cos(rot) * outerR, cy + Math.sin(rot) * outerR);
  }
  ctx.closePath();
}

// Translates one stored shape into Canvas 2D commands.
export function drawUserShape(ctx: CanvasRenderingContext2D, shape: UserShape) {
  ctx.save();
  ctx.fillStyle = shape.color;
  ctx.strokeStyle = shape.color;
  ctx.lineWidth = 4;

  switch (shape.kind) {
    case "line": {
      ctx.beginPath();
      ctx.moveTo(shape.x1, shape.y1);
      ctx.lineTo(shape.x2, shape.y2);
      ctx.stroke();
      break;
    }
    case "rect": {
      const box = boundingBox(shape);
      ctx.fillRect(box.x, box.y, box.width, box.height);
      break;
    }
    case "circle": {
      ctx.beginPath();
      ctx.arc(shape.x1, shape.y1, dragRadius(shape), 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "triangle": {
      // Three explicit vertices inside the drag box: apex on top, base at the bottom.
      const box = boundingBox(shape);
      ctx.beginPath();
      ctx.moveTo(box.x + box.width / 2, box.y);
      ctx.lineTo(box.x, box.y + box.height);
      ctx.lineTo(box.x + box.width, box.y + box.height);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case "star": {
      const outerR = dragRadius(shape);
      drawStarPath(ctx, shape.x1, shape.y1, 5, outerR, outerR * 0.45);
      ctx.fill();
      break;
    }
  }

  ctx.restore();
}

// Draws the shape currently being dragged. Semi-transparent so the user can
// tell a preview apart from a committed shape.
export function drawShapePreview(ctx: CanvasRenderingContext2D, shape: UserShape) {
  ctx.save();
  ctx.globalAlpha = 0.55;
  drawUserShape(ctx, shape);
  ctx.restore();
}

// One random shape, used by the Random action.
export function randomShape(width: number, height: number): UserShape {
  const kind = SHAPE_KINDS[Math.floor(Math.random() * SHAPE_KINDS.length)];
  const x1 = Math.random() * width;
  const y1 = Math.random() * height;
  // Keep the second point near the first one so random shapes stay a sane size.
  const spread = 40 + Math.random() * 90;
  const angle = Math.random() * Math.PI * 2;

  return {
    kind,
    x1,
    y1,
    x2: x1 + Math.cos(angle) * spread,
    y2: y1 + Math.sin(angle) * spread,
    color: `hsl(${Math.floor(Math.random() * 360)}, 70%, 55%)`,
  };
}
