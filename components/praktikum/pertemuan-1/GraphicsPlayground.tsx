"use client";

import { useEffect, useRef, useState } from "react";

const CANVAS_W = 960;
const CANVAS_H = 600;

// Palet warna untuk bola & circle hasil klik (color cycling)
const PALETTE = ["#9b59b6", "#e74c3c", "#2ecc71", "#f1c40f", "#3498db"];

type Mode = "state" | "event";

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

const btnClass =
  "rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:border-indigo-500 hover:bg-slate-700";

function segClass(active: boolean) {
  return `flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
    active ? "bg-indigo-500 text-white" : "text-slate-400 hover:text-slate-200"
  }`;
}

function ControlCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
      <h3 className="mb-3 text-sm font-semibold text-white">{title}</h3>
      {children}
    </div>
  );
}

export default function GraphicsPlayground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // State yang perlu tampil di UI (React) sekaligus dibaca di dalam animation loop.
  const [mode, setMode] = useState<Mode>("state");
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState(5);
  const [trail, setTrail] = useState(false);
  const [circleCount, setCircleCount] = useState(0);

  // Disalin ke ref agar animation loop selalu membaca nilai terbaru tanpa stale closure.
  const modeRef = useRef(mode);
  const pausedRef = useRef(paused);
  const speedRef = useRef(speed);
  const trailRef = useRef(trail);

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

  // Jembatan imperatif supaya tombol HTML di luar effect bisa memanggil reset/clear.
  const controlsApiRef = useRef<{ reset: () => void; clearCircles: () => void } | null>(null);

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

    const mouse = { x: 0, y: 0 };
    const keys: Record<string, boolean> = {};
    let colorIndex = 0;
    let rafId = 0;

    // ------------------------------------------------------------
    // RESET / CLEAR — dipanggil dari tombol UI maupun tombol keyboard
    // ------------------------------------------------------------
    function resetScene() {
      movingBall.x = ballInitial.x;
      movingBall.y = ballInitial.y;
      movingBall.speedX = ballInitial.speedX;
      movingBall.speedY = ballInitial.speedY;
      player.x = playerInitial.x;
      player.y = playerInitial.y;
    }

    function clearClickedCircles() {
      clickedCircles.length = 0;
      setCircleCount(0);
    }

    controlsApiRef.current = { reset: resetScene, clearCircles: clearClickedCircles };

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

    // ------------------------------------------------------------
    // INPUT
    // ------------------------------------------------------------
    function onMouseMove(event: MouseEvent) {
      const rect = canvas.getBoundingClientRect();
      mouse.x = (event.clientX - rect.left) * (canvas.width / rect.width);
      mouse.y = (event.clientY - rect.top) * (canvas.height / rect.height);
    }

    function onClick() {
      colorIndex = (colorIndex + 1) % PALETTE.length;
      movingBall.color = PALETTE[colorIndex];
      clickedCircles.push({ x: mouse.x, y: mouse.y, radius: 14, color: PALETTE[colorIndex] });
      setCircleCount(clickedCircles.length);
    }

    function onKeyDown(event: KeyboardEvent) {
      const controlledKeys = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"];
      const isArrowKey = controlledKeys.includes(event.key);

      // Arrow keys dilewati saat fokus ada di form control (mis. speed slider)
      // supaya perilaku native-nya (menggeser slider) tidak dibajak. Tombol
      // R/C/P tetap berfungsi di mana pun karena tidak berkonflik dengan kontrol lain.
      if (isArrowKey && !isFormElement(event.target)) {
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
    canvas.addEventListener("click", onClick);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    // ------------------------------------------------------------
    // ANIMATION LOOP
    // ------------------------------------------------------------
    function animate() {
      if (!pausedRef.current) {
        updateMovingBall();
        updateSmallObjects();
        updatePlayer();
        updateFollowCircle();
      }
      drawScene();
      rafId = requestAnimationFrame(animate);
    }
    animate();

    return () => {
      cancelAnimationFrame(rafId);
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("click", onClick);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
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
            style={{ aspectRatio: `${CANVAS_W} / ${CANVAS_H}` }}
          />
        </div>
        <p className="mt-3 text-center text-xs text-slate-500">
          Arrow keys / WASD untuk menggerakkan kotak oranye &middot; klik canvas untuk ganti warna
          bola &amp; membuat circle baru.
        </p>
      </div>

      <aside className="space-y-4">
        <ControlCard title="Mode translasi keyboard">
          <div className="flex gap-1 rounded-lg border border-slate-700 bg-slate-800/60 p-1">
            <button className={segClass(mode === "state")} onClick={() => setMode("state")}>
              State-based
            </button>
            <button className={segClass(mode === "event")} onClick={() => setMode("event")}>
              Event-based
            </button>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-slate-500">
            {mode === "state"
              ? "keydown/keyup hanya mengubah keys[...]. Translasi dibaca setiap frame di updatePlayer()."
              : "keydown langsung mengubah posisi player. Tahan tombol panah dan rasakan delay/rate keyboard repeat browser."}
          </p>
        </ControlCard>

        <ControlCard title="Kontrol">
          <div className="flex gap-2">
            <button className={btnClass} onClick={() => setPaused((p) => !p)}>
              {paused ? "Resume (P)" : "Pause (P)"}
            </button>
            <button className={btnClass} onClick={() => controlsApiRef.current?.reset()}>
              Reset (R)
            </button>
          </div>

          <label className="mt-4 block text-xs text-slate-400">
            Speed player: <span className="text-slate-200">{speed}</span>
            <input
              type="range"
              min={1}
              max={10}
              value={speed}
              onChange={(event) => setSpeed(Number(event.target.value))}
              onPointerUp={(event) => event.currentTarget.blur()}
              className="mt-1 w-full accent-indigo-500"
            />
          </label>

          <label className="mt-4 flex items-center gap-2 text-xs text-slate-400">
            <input type="checkbox" checked={trail} onChange={(event) => setTrail(event.target.checked)} />
            Trail mode (canvas tidak di-clear)
          </label>

          <button
            className={`${btnClass} mt-4 w-full`}
            onClick={() => controlsApiRef.current?.clearCircles()}
          >
            Hapus circle hasil klik ({circleCount})
          </button>
        </ControlCard>

        <ControlCard title="Keterangan">
          <ul className="space-y-1.5 text-xs text-slate-400">
            <li>Kotak biru, garis merah, lingkaran hijau, segitiga oranye &mdash; primitive statis.</li>
            <li>Bola ungu memantul di dalam batas canvas (velocity + boundary check).</li>
            <li>Circle teal mengikuti posisi mouse.</li>
            <li>Circle kecil di bagian bawah &mdash; beberapa objek bergerak independen.</li>
            <li>Kotak oranye adalah player yang dikendalikan keyboard.</li>
          </ul>
        </ControlCard>
      </aside>
    </div>
  );
}
