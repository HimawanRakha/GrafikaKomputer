// Entry point of the standalone Vite app: fills the window with the scene,
// keeps it sized to the browser, and writes the HUD into plain DOM elements.
import "./style.css";
import { createMiniScene } from "./scene.js";

const canvas = document.querySelector("#scene");

// Every HUD value lives in an element marked data-field="...".
const fields = Object.fromEntries(
  [...document.querySelectorAll("[data-field]")].map((element) => [element.dataset.field, element]),
);

/** Writes one HUD snapshot (sent 10x per second by the scene) into the page. */
function renderHud(info) {
  const { x, y, z } = info.selectedPosition;

  fields.fps.textContent = info.fps.toFixed(0);
  fields.meshCount.textContent = info.meshCount;
  fields.drawCalls.textContent = info.drawCalls;
  fields.triangles.textContent = info.triangles.toLocaleString("id-ID");
  fields.camera.textContent = info.camera;
  fields.shadow.textContent = `${info.shadowLabel} (${info.shadowMapSize}×${info.shadowMapSize})`;
  fields.light.textContent = info.lightAnimated ? "On" : "Off";
  fields.animation.textContent = info.paused ? "Paused" : "Berjalan";
  fields.selected.textContent = info.selectedName;
  fields.position.textContent = `(${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)})`;
  fields.rotation.textContent = `${info.selectedRotationDeg.toFixed(0)}°`;
  fields.scale.textContent = `${info.selectedScale.toFixed(2)}×`;
}

const miniScene = createMiniScene(canvas, { onInfo: renderHud });

/** Keeps renderer size, camera aspect and projection matrix in step with the browser. */
function onResize() {
  miniScene.resize(window.innerWidth, window.innerHeight);
}

window.addEventListener("resize", onResize);
onResize();

// During `npm run dev`, Vite hot-reloads this module; disposing first prevents
// a second animation loop and renderer from piling up on the same canvas.
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    window.removeEventListener("resize", onResize);
    miniScene.dispose();
  });
}
