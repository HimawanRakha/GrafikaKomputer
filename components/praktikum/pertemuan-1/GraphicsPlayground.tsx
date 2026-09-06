"use client";

import { useEffect, useRef, useState } from "react";
import PlaygroundControls, { type Mode } from "./PlaygroundControls";
import {
  drawShapePreview,
  drawUserShape,
  hexToHue,
  hslToHex,
  randomShape,
  type Tool,
  type UserShape,
} from "./shapes";

const CANVAS_W = 960;
const CANVAS_H = 600;

// Palet warna untuk bola & circle hasil klik (color cycling)
const PALETTE = ["#9b59b6", "#e74c3c", "#2ecc71", "#f1c40f", "#3498db"];

// How often the Info panel is refreshed. Pushing FPS into React state on every
// frame would force ~60 re-renders per second and lower the very number we are
// measuring, so the reading is batched instead.
const INFO_INTERVAL_MS = 250;

// How many shapes the Random action adds per click.
const RANDOM_BATCH = 5;

const DEFAULT_HUE = 28;

interface Circle {
  x: number;
  y: number;
  radius: number;
  color: string;
}

interface MovableCircle extends Circle {
  speedX: number;
  speedY: number;
}

function isFormElement(target: EventTarget | null) {
  return target instanceof HTMLElement && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

export default function GraphicsPlayground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // State yang perlu tampil di UI (React) sekaligus dibaca di dalam animation loop.
  const [mode, setMode] = useState<Mode>("state");
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState(5);
  const [trail, setTrail] = useState(false);
  const [activeTool, setActiveTool] = useState<Tool>("demo");
  const [hue, setHue] = useState(DEFAULT_HUE);
  const [color, setColor] = useState(() => hslToHex(DEFAULT_HUE, 70, 55));
  const [drawnCount, setDrawnCount] = useState(0);
  const [frameStats, setFrameStats] = useState({ fps: 0, frameTime: 0 });

  // Disalin ke ref agar animation loop selalu membaca nilai terbaru tanpa stale closure.
  const modeRef = useRef(mode);
  const pausedRef = useRef(paused);
  const speedRef = useRef(speed);
  const trailRef = useRef(trail);
  const activeToolRef = useRef(activeTool);
  const colorRef = useRef(color);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);
  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);
  useEffect(() => {
    trailRef.current = trail;
  }, [trail]);
  useEffect(() => {
    activeToolRef.current = activeTool;
  }, [activeTool]);
  useEffect(() => {
    colorRef.current = color;
  }, [color]);

  // Jembatan imperatif supaya tombol HTML di luar effect bisa memanggil aksi canvas.
  const controlsApiRef = useRef<{
    reset: () => void;
    clearAll: () => void;
    addRandomShapes: () => void;
  } | null>(null);

  // Slider hue dan color picker menulis ke state warna yang sama, dan keduanya
  // saling menyesuaikan supaya posisi slider selalu mewakili warna aktif.
  function handleHueChange(nextHue: number) {
    setHue(nextHue);
    setColor(hslToHex(nextHue, 70, 55));
  }

  function handleColorChange(nextColor: string) {
    setColor(nextColor);
    setHue(hexToHue(nextColor));
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    return setup(canvas, ctx);

    // Dibungkus dalam fungsi terpisah supaya canvas & ctx bertipe non-null
    // di semua fungsi bertingkat di bawah (TS tidak mempertahankan narrowing
    // null-check ke dalam function declaration yang di-hoist).
    function setup(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
    // ------------------------------------------------------------
    // DATA — posisi, ukuran, dan warna tiap objek disimpan terpisah dari fungsi gambar
    // ------------------------------------------------------------
    const rectangle = { x: 60, y: 60, width: 220, height: 130, color: "#3498db" };
    const line = { x1: 340, y1: 70, x2: 640, y2: 190, color: "#e74c3c" };
    const staticCircle: Circle = { x: 800, y: 140, radius: 70, color: "#2ecc71" };
    const triangle = {
      v0: { x: 190, y: 330 },
      v1: { x: 100, y: 500 },
      v2: { x: 280, y: 500 },
      fill: "#f39c12",
      stroke: "#8a5705",
    };

    const ballInitial = { x: 480, y: 330, radius: 28, speedX: 3, speedY: 2.4 };
    const movingBall: MovableCircle = { ...ballInitial, color: PALETTE[0] };

    const playerInitial = { x: 820, y: 480, width: 56, height: 56 };
    const player = { ...playerInitial, color: "#e67e22" };

    const followCircle: Circle = { x: CANVAS_W / 2, y: CANVAS_H / 2, radius: 16, color: "#1abc9c" };

    const smallObjects: MovableCircle[] = Array.from({ length: 5 }, (_, i) => ({
      x: 80 + i * 190,
      y: 560,
      radius: 10,
      speedX: i % 2 === 0 ? 1.4 + i * 0.3 : -(1.4 + i * 0.3),
      speedY: 0,
      color: PALETTE[i % PALETTE.length],
    }));

    const clickedCircles: Circle[] = [];

    // Bentuk yang digambar user lewat panel Shapes.
    const userShapes: UserShape[] = [];
    // Bentuk yang sedang di-drag; null ketika tidak ada drag berlangsung.
    let draft: UserShape | null = null;

    const mouse = { x: 0, y: 0 };
    const keys: Record<string, boolean> = {};
    let colorIndex = 0;
    let rafId = 0;

    // Keyboard hanya mengendalikan canvas ketika pointer berada di atasnya.
    // Satu flag ini menggerbangi perekaman keys sekaligus preventDefault(),
    // supaya di luar canvas tombol panah kembali men-scroll halaman seperti biasa.
    let pointerOverCanvas = false;

    // Akumulator pengukuran frame untuk panel Info.
    let lastTime = performance.now();
    let frameTimeAccum = 0;
    let frameCount = 0;
    let infoAccum = 0;

    // ------------------------------------------------------------
    // RESET / CLEAR — dipanggil dari tombol UI maupun tombol keyboard
    // ------------------------------------------------------------
    function syncDrawnCount() {
      setDrawnCount(userShapes.length + clickedCircles.length);
    }

    function resetScene() {
      movingBall.x = ballInitial.x;
      movingBall.y = ballInitial.y;
      movingBall.speedX = ballInitial.speedX;
      movingBall.speedY = ballInitial.speedY;
      player.x = playerInitial.x;
      player.y = playerInitial.y;
    }

    function clearAll() {
      userShapes.length = 0;
      clickedCircles.length = 0;
      draft = null;
      syncDrawnCount();
    }

    function addRandomShapes() {
      for (let i = 0; i < RANDOM_BATCH; i++) {
        userShapes.push(randomShape(CANVAS_W, CANVAS_H));
      }
      syncDrawnCount();
    }

    controlsApiRef.current = { reset: resetScene, clearAll, addRandomShapes };

    // Melepas semua tombol yang sedang tercatat ditekan. Dipakai ketika window
    // kehilangan fokus atau pointer meninggalkan canvas — tanpa ini keyup tidak
    // pernah sampai dan player terus bergerak sendiri.
    function releaseAllKeys() {
      for (const key of Object.keys(keys)) keys[key] = false;
    }

    // ------------------------------------------------------------
    // DRAW
    // ------------------------------------------------------------
    function clearCanvas() {
      if (trailRef.current) return; // mode trail: sengaja tidak di-clear
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    function drawRectangle() {
      ctx.fillStyle = rectangle.color;
      ctx.fillRect(rectangle.x, rectangle.y, rectangle.width, rectangle.height);
    }

    function drawLine() {
      ctx.beginPath();
      ctx.moveTo(line.x1, line.y1);
      ctx.lineTo(line.x2, line.y2);
      ctx.strokeStyle = line.color;
      ctx.lineWidth = 5;
      ctx.stroke();
    }

    function drawStaticCircle() {
      ctx.beginPath();
      ctx.arc(staticCircle.x, staticCircle.y, staticCircle.radius, 0, Math.PI * 2);
      ctx.fillStyle = staticCircle.color;
      ctx.fill();
    }

    function drawTriangle() {
      ctx.beginPath();
      ctx.moveTo(triangle.v0.x, triangle.v0.y);
      ctx.lineTo(triangle.v1.x, triangle.v1.y);
      ctx.lineTo(triangle.v2.x, triangle.v2.y);
      ctx.closePath();
      ctx.fillStyle = triangle.fill;
      ctx.fill();
      ctx.strokeStyle = triangle.stroke;
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    function drawCircleObject(circle: Circle) {
      ctx.beginPath();
      ctx.arc(circle.x, circle.y, circle.radius, 0, Math.PI * 2);
      ctx.fillStyle = circle.color;
      ctx.fill();
    }

    function drawPlayer() {
      ctx.fillStyle = player.color;
      ctx.fillRect(player.x, player.y, player.width, player.height);
    }

    function drawHUD() {
      ctx.save();
      ctx.fillStyle = "rgba(15, 23, 42, 0.78)";
      ctx.fillRect(14, 14, 260, 80);
      ctx.fillStyle = "#e2e8f0";
      ctx.font = "14px system-ui, sans-serif";
      ctx.fillText(`Mouse: (${Math.round(mouse.x)}, ${Math.round(mouse.y)})`, 26, 36);
      ctx.fillText(`Mode: ${modeRef.current === "state" ? "State-based" : "Event-based"}`, 26, 56);
      ctx.fillText(`Status: ${pausedRef.current ? "Paused" : "Berjalan"}`, 26, 76);
      ctx.restore();
    }

    function drawScene() {
      clearCanvas();
      drawRectangle();
      drawLine();
      drawStaticCircle();
      drawTriangle();
      for (const obj of smallObjects) drawCircleObject(obj);
      drawCircleObject(movingBall);
      drawCircleObject(followCircle);
      for (const c of clickedCircles) drawCircleObject(c);
      // Bentuk buatan user digambar sebelum player & HUD supaya keduanya tetap terbaca.
      for (const shape of userShapes) drawUserShape(ctx, shape);
      if (draft) drawShapePreview(ctx, draft);
      drawPlayer();
      drawHUD();
    }

    // ------------------------------------------------------------
    // UPDATE
    // ------------------------------------------------------------
    function updateMovingBall() {
      movingBall.x += movingBall.speedX;
      movingBall.y += movingBall.speedY;
      if (movingBall.x + movingBall.radius >= canvas.width || movingBall.x - movingBall.radius <= 0) {
        movingBall.speedX *= -1;
      }
      if (movingBall.y + movingBall.radius >= canvas.height || movingBall.y - movingBall.radius <= 0) {
        movingBall.speedY *= -1;
      }
    }

    function updateSmallObjects() {
      for (const obj of smallObjects) {
        obj.x += obj.speedX;
        if (obj.x + obj.radius >= CANVAS_W || obj.x - obj.radius <= 0) obj.speedX *= -1;
      }
    }

    function clampPlayer() {
      player.x = Math.max(0, Math.min(CANVAS_W - player.width, player.x));
      player.y = Math.max(0, Math.min(CANVAS_H - player.height, player.y));
    }

    function updatePlayer() {
      // State-based: translasi kontinu dibaca dari status tombol setiap frame.
      if (modeRef.current !== "state") return;
      const s = speedRef.current;
      if (keys.ArrowLeft || keys.a || keys.A) player.x -= s;
      if (keys.ArrowRight || keys.d || keys.D) player.x += s;
      if (keys.ArrowUp || keys.w || keys.W) player.y -= s;
      if (keys.ArrowDown || keys.s || keys.S) player.y += s;
      clampPlayer();
    }

    function updateFollowCircle() {
      followCircle.x = mouse.x;
      followCircle.y = mouse.y;
    }

    // Panel Info diperbarui maksimal 4x per detik, bukan tiap frame.
    function updateFrameStats(delta: number) {
      frameTimeAccum += delta;
      frameCount += 1;
      infoAccum += delta;

      if (infoAccum < INFO_INTERVAL_MS || frameCount === 0) return;

      const average = frameTimeAccum / frameCount;
      setFrameStats({
        fps: average > 0 ? Math.round(1000 / average) : 0,
        frameTime: average,
      });
      frameTimeAccum = 0;
      frameCount = 0;
      infoAccum = 0;
    }

    // ------------------------------------------------------------
    // INPUT
    // ------------------------------------------------------------
    // Menerjemahkan koordinat layar ke koordinat internal canvas. Diperlukan
    // karena canvas ditampilkan responsif, jadi ukuran CSS-nya berbeda dari
    // ukuran drawing buffer-nya.
    function toCanvasCoords(event: MouseEvent) {
      const rect = canvas.getBoundingClientRect();
      return {
        x: (event.clientX - rect.left) * (canvas.width / rect.width),
        y: (event.clientY - rect.top) * (canvas.height / rect.height),
      };
    }

    function onMouseMove(event: MouseEvent) {
      const point = toCanvasCoords(event);
      mouse.x = point.x;
      mouse.y = point.y;

      // Ujung kedua bentuk mengikuti pointer selama drag berlangsung.
      if (draft) {
        draft.x2 = point.x;
        draft.y2 = point.y;
      }
    }

    function onMouseDown() {
      const tool = activeToolRef.current;
      if (tool === "demo") return;

      draft = {
        kind: tool,
        x1: mouse.x,
        y1: mouse.y,
        x2: mouse.x,
        y2: mouse.y,
        color: colorRef.current,
      };
    }

    // Dipasang di window, bukan canvas, supaya melepas tombol mouse di luar
    // canvas tetap menyelesaikan bentuk dan tidak meninggalkan draft menggantung.
    function onMouseUp() {
      if (!draft) return;

      // Klik tanpa geser tidak menghasilkan bentuk yang terlihat, jadi dibuang.
      const dragged = Math.hypot(draft.x2 - draft.x1, draft.y2 - draft.y1) > 3;
      if (dragged) {
        userShapes.push(draft);
        syncDrawnCount();
      }
      draft = null;
    }

    function onMouseEnter() {
      pointerOverCanvas = true;
    }

    function onMouseLeave() {
      pointerOverCanvas = false;
      releaseAllKeys();
    }

    function onClick() {
      // Dengan tool gambar aktif, click tetap menyala setelah mouseup. Tanpa
      // guard ini setiap selesai menggambar akan ikut tercipta circle liar.
      if (activeToolRef.current !== "demo") return;

      colorIndex = (colorIndex + 1) % PALETTE.length;
      movingBall.color = PALETTE[colorIndex];
      clickedCircles.push({ x: mouse.x, y: mouse.y, radius: 14, color: PALETTE[colorIndex] });
      syncDrawnCount();
    }

    function onKeyDown(event: KeyboardEvent) {
      const controlledKeys = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"];
      const isArrowKey = controlledKeys.includes(event.key);

      // Arrow keys dilewati saat fokus ada di form control (mis. speed slider)
      // supaya perilaku native-nya (menggeser slider) tidak dibajak, dan saat
      // pointer berada di luar canvas supaya halaman tetap bisa di-scroll.
      // Tombol R/C/P tetap berfungsi di mana pun karena tidak berkonflik.
      if (isArrowKey && pointerOverCanvas && !isFormElement(event.target)) {
        event.preventDefault();

        // State-based: keydown hanya mencatat status tombol.
        keys[event.key] = true;

        // Event-based: translasi dijalankan langsung di sini untuk dibandingkan dengan mode state-based.
        if (modeRef.current === "event") {
          const s = speedRef.current;
          if (event.key === "ArrowLeft") player.x -= s;
          if (event.key === "ArrowRight") player.x += s;
          if (event.key === "ArrowUp") player.y -= s;
          if (event.key === "ArrowDown") player.y += s;
          clampPlayer();
        }
      }

      // Event-based: aksi diskrit sekali tekan, dijaga dengan event.repeat.
      if (!event.repeat) {
        const key = event.key.toLowerCase();
        if (key === "r") resetScene();
        if (key === "c") {
          colorIndex = (colorIndex + 1) % PALETTE.length;
          movingBall.color = PALETTE[colorIndex];
        }
        if (key === "p") setPaused((p) => !p);
      }
    }

    function onKeyUp(event: KeyboardEvent) {
      keys[event.key] = false;
    }

    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("mousedown", onMouseDown);
    canvas.addEventListener("mouseenter", onMouseEnter);
    canvas.addEventListener("mouseleave", onMouseLeave);
    canvas.addEventListener("click", onClick);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    // Alt+Tab saat tombol ditahan membuat keyup tidak pernah sampai ke halaman.
    window.addEventListener("blur", releaseAllKeys);

    // ------------------------------------------------------------
    // ANIMATION LOOP
    // ------------------------------------------------------------
    function animate(time: number) {
      updateFrameStats(time - lastTime);
      lastTime = time;

      if (!pausedRef.current) {
        updateMovingBall();
        updateSmallObjects();
        updatePlayer();
        updateFollowCircle();
      }
      drawScene();
      rafId = requestAnimationFrame(animate);
    }
    rafId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafId);
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("mousedown", onMouseDown);
      canvas.removeEventListener("mouseenter", onMouseEnter);
      canvas.removeEventListener("mouseleave", onMouseLeave);
      canvas.removeEventListener("click", onClick);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", releaseAllKeys);
    };
    }
  }, []);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
        <div className="mx-auto w-full max-w-[960px]">
          <canvas
            ref={canvasRef}
            width={CANVAS_W}
            height={CANVAS_H}
            className="block h-auto w-full rounded-xl border border-slate-700 bg-white"
            style={{
              aspectRatio: `${CANVAS_W} / ${CANVAS_H}`,
              cursor: activeTool === "demo" ? "pointer" : "crosshair",
            }}
          />
        </div>
        <p className="mt-3 text-center text-xs text-slate-500">
          {activeTool === "demo"
            ? "Klik canvas untuk ganti warna bola & membuat circle · arahkan pointer ke canvas lalu pakai Arrow keys / WASD untuk menggerakkan kotak oranye."
            : "Drag di canvas untuk menggambar · pilih tool Demo untuk kembali ke interaksi klik."}
        </p>
      </div>

      <PlaygroundControls
        activeTool={activeTool}
        onToolChange={setActiveTool}
        color={color}
        hue={hue}
        onHueChange={handleHueChange}
        onColorChange={handleColorChange}
        onClear={() => controlsApiRef.current?.clearAll()}
        onRandom={() => controlsApiRef.current?.addRandomShapes()}
        onReset={() => controlsApiRef.current?.reset()}
        animating={!paused}
        onToggleAnimate={() => setPaused((p) => !p)}
        drawnCount={drawnCount}
        fps={frameStats.fps}
        frameTime={frameStats.frameTime}
        resolution={`${CANVAS_W} × ${CANVAS_H}`}
        mode={mode}
        onModeChange={setMode}
        speed={speed}
        onSpeedChange={setSpeed}
        trail={trail}
        onTrailChange={setTrail}
      />
    </div>
  );
}
