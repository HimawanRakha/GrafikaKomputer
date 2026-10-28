// Stage viewer for Pertemuan 9: shows the Blender crate at each workflow
// stage (public/praktikum-9/stage-<n>.glb, exported by blender/build_scifi_crate.py).
// Kept free of React, like Pertemuan 6 and 7, and free of `window` at module
// top level because the portal imports it on the server while prerendering.
//
// Each GLB holds two copies of every part: the mesh (faces, triangulated by
// glTF) and EDGES_<part>, a line copy with Blender's real quad/n-gon edges.
// The wireframe toggle shows the edge copies, so the topology on screen is the
// one Blender has — not glTF's triangles.

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const MAX_PIXEL_RATIO = 2;
export const STAGE_COUNT = 5;

/** Object colours from the Blender script (scene-linear, like Blender's object colour). */
const PART_COLORS = [
  ["Crate_Body", [0.25, 0.42, 0.62]],
  ["Side_Panel", [0.85, 0.55, 0.15]],
  ["Handle", [0.12, 0.13, 0.16]],
  ["Vent_Slats", [0.12, 0.13, 0.16]],
  ["Foot", [0.3, 0.31, 0.34]],
];

// Blender is Z-up and the crate's front faces -Y; the glTF exporter converts
// to Y-up, so Blender -Y becomes +Z here.
const TARGET = new THREE.Vector3(0, 1.45, 0);
const VIEW_DISTANCE = 8.5;
export const VIEWS = {
  front: { label: "Front", key: "1", dir: new THREE.Vector3(0, 0, 1) }, // Numpad 1
  right: { label: "Right", key: "3", dir: new THREE.Vector3(1, 0, 0) }, // Numpad 3
  top: { label: "Top", key: "7", dir: new THREE.Vector3(0, 1, 0.0001) }, // Numpad 7
  persp: { label: "3/4", key: "0", dir: new THREE.Vector3(0.6, 0.45, 0.66) }, // like Camera_Crate
};

function colorFor(name) {
  const entry = PART_COLORS.find(([prefix]) => name.startsWith(prefix));
  const [r, g, b] = entry ? entry[1] : [0.6, 0.6, 0.6];
  return new THREE.Color().setRGB(r, g, b, THREE.LinearSRGBColorSpace);
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {{ assetBase?: string, onInfo?: (info: object) => void, isInputActive?: () => boolean }} options
 *   assetBase: URL prefix of public/praktikum-9 (includes the deploy basePath)
 */
export function createCrateViewer(
  canvas,
  { assetBase = "/praktikum-9", onInfo = () => {}, isInputActive = () => true } = {},
) {
  const stageUrl = (stage) => `${assetBase}/stage-${stage}.glb`;
  let disposed = false;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#0b1020");
  scene.add(new THREE.HemisphereLight("#dbe7ff", "#2a2f3a", 1.6));
  const key = new THREE.DirectionalLight("#ffffff", 2.2);
  key.position.set(6, 10, 7);
  scene.add(key);
  const fill = new THREE.DirectionalLight("#9fb6ff", 0.6);
  fill.position.set(-8, 4, -6);
  scene.add(fill);

  // Blender's floor grid: 1 m cells, red X axis, green Y axis (Blender Y = three -Z).
  const grid = new THREE.GridHelper(20, 20, "#334155", "#1e293b");
  scene.add(grid);
  const axes = new THREE.Group();
  const axisLine = (to, color) =>
    new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([to.clone().multiplyScalar(-10), to.clone().multiplyScalar(10)]),
      new THREE.LineBasicMaterial({ color }),
    );
  axes.add(axisLine(new THREE.Vector3(1, 0.001, 0), "#ef4444"), axisLine(new THREE.Vector3(0, 0.001, 1), "#22c55e"));
  scene.add(axes);

  // --- cameras: perspective and orthographic, Numpad 5 swaps them ---------
  const perspective = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  const orthographic = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  let camera = perspective;
  let controls = makeControls(camera);
  let aspect = 1;
  let currentView = "persp";

  function makeControls(cam) {
    const c = new OrbitControls(cam, canvas);
    c.enableDamping = true;
    c.minDistance = 4;
    c.maxDistance = 30;
    c.minZoom = 0.4;
    c.maxZoom = 4;
    c.target.copy(TARGET);
    return c;
  }

  /** Orthographic box that matches what the perspective camera shows at the target. */
  function fitOrthographic(distance) {
    const halfH = Math.tan(THREE.MathUtils.degToRad(perspective.fov / 2)) * distance;
    orthographic.left = -halfH * aspect;
    orthographic.right = halfH * aspect;
    orthographic.top = halfH;
    orthographic.bottom = -halfH;
    orthographic.updateProjectionMatrix();
  }

  function setView(name) {
    const view = VIEWS[name];
    if (!view) return;
    currentView = name;
    // Front / Right / Top are read best without perspective, as in Blender.
    const wantOrtho = name !== "persp";
    if (wantOrtho !== (camera === orthographic)) swapCamera(false);
    camera.position.copy(TARGET).addScaledVector(view.dir.clone().normalize(), VIEW_DISTANCE);
    camera.zoom = 1;
    if (camera === orthographic) fitOrthographic(VIEW_DISTANCE);
    camera.updateProjectionMatrix();
    controls.target.copy(TARGET);
    controls.update();
  }

  function swapCamera(keepView = true) {
    const from = camera;
    const to = from === perspective ? orthographic : perspective;
    to.position.copy(from.position);
    to.quaternion.copy(from.quaternion);
    const target = controls.target.clone();
    const distance = from.position.distanceTo(target) / (from === orthographic ? from.zoom : 1);
    controls.dispose();
    camera = to;
    if (to === orthographic) {
      to.zoom = 1;
      fitOrthographic(distance);
    } else {
      to.position.copy(target).add(from.position.clone().sub(target).setLength(distance));
      to.aspect = aspect;
      to.updateProjectionMatrix();
    }
    controls = makeControls(camera);
    controls.target.copy(target);
    controls.update();
    if (keepView) currentView = "custom";
  }

  // --- stages -------------------------------------------------------------
  const loader = new GLTFLoader();
  const stages = new Map(); // stage -> { root, meshes, edges, counts }
  const surfaceMaterials = new Map(); // part name -> material (shared across stages)
  const edgeMaterial = new THREE.LineBasicMaterial({ color: "#e2e8f0", transparent: true, opacity: 0.85 });
  let currentStage = STAGE_COUNT;
  let wireframe = false;
  let xray = false;
  let loading = { state: "loading", stage: currentStage };

  function materialFor(name) {
    const key = PART_COLORS.find(([prefix]) => name.startsWith(prefix))?.[0] ?? name;
    if (!surfaceMaterials.has(key)) {
      surfaceMaterials.set(
        key,
        new THREE.MeshStandardMaterial({
          color: colorFor(name),
          roughness: 0.55,
          metalness: 0.15,
          polygonOffset: true, // pushes faces back so the edge lines are not z-fighting
          polygonOffsetFactor: 1,
          polygonOffsetUnits: 1,
        }),
      );
    }
    return surfaceMaterials.get(key);
  }

  function prepare(gltf) {
    const root = gltf.scene;
    const meshes = [];
    const edges = [];
    root.traverse((object) => {
      if (object.isLineSegments || object.isLine) {
        object.material = edgeMaterial;
        edges.push(object);
      } else if (object.isMesh) {
        object.material = materialFor(object.name);
        meshes.push(object);
      }
    });
    return { root, meshes, edges };
  }

  function applyDisplay() {
    const entry = stages.get(currentStage);
    for (const [stage, value] of stages) value.root.visible = stage === currentStage;
    if (!entry) return;
    for (const edge of entry.edges) edge.visible = wireframe;
    for (const material of surfaceMaterials.values()) {
      material.transparent = xray;
      material.opacity = xray ? 0.25 : 1;
      material.depthWrite = !xray;
      material.needsUpdate = true;
    }
  }

  function setStage(stage) {
    if (stage < 1 || stage > STAGE_COUNT) return;
    currentStage = stage;
    if (stages.has(stage)) {
      loading = { state: "loaded", stage };
      applyDisplay();
      return;
    }
    loading = { state: "loading", stage };
    applyDisplay();
    loader.load(
      stageUrl(stage),
      (gltf) => {
        if (disposed) {
          disposeObject(gltf.scene);
          return;
        }
        const entry = prepare(gltf);
        stages.set(stage, entry);
        scene.add(entry.root);
        if (currentStage === stage) loading = { state: "loaded", stage };
        applyDisplay();
      },
      undefined,
      (error) => {
        console.error(`[P9] gagal memuat ${stageUrl(stage)}`, error);
        if (currentStage === stage) loading = { state: "error", stage };
      },
    );
  }

  function disposeObject(root) {
    root.traverse((object) => {
      if (object.geometry) object.geometry.dispose();
    });
  }

  // --- keyboard: the Blender viewport shortcuts that apply to a viewer -----
  function onKeyDown(event) {
    if (!isInputActive() || event.ctrlKey || event.metaKey || event.altKey) return;
    const digit = event.code.startsWith("Numpad") ? event.code.slice(6) : null;
    let handled = true;
    if (digit === "1") setView("front");
    else if (digit === "3") setView("right");
    else if (digit === "7") setView("top");
    else if (digit === "5") swapCamera();
    else if (digit === "0" || event.key === "Home") setView("persp");
    else if (event.code === "NumpadDecimal" || event.key === ".") frameSelected();
    else if (/^[1-5]$/.test(event.key) && !digit) setStage(Number(event.key));
    else if (event.key === "w" || event.key === "W") toggleWireframe();
    else if (event.key === "x" || event.key === "X") toggleXray();
    else handled = false;
    if (handled) event.preventDefault();
  }
  window.addEventListener("keydown", onKeyDown);

  function frameSelected() {
    controls.target.copy(TARGET);
    camera.position.copy(TARGET).add(camera.position.clone().sub(TARGET).setLength(VIEW_DISTANCE * 0.8));
    camera.zoom = 1.25;
    camera.updateProjectionMatrix();
    controls.update();
    currentView = "custom";
  }

  function toggleWireframe() {
    wireframe = !wireframe;
    applyDisplay();
  }

  function toggleXray() {
    xray = !xray;
    applyDisplay();
  }

  function reset() {
    wireframe = false;
    xray = false;
    setStage(STAGE_COUNT);
    setView("persp");
  }

  function resize(width, height) {
    if (!width || !height) return;
    aspect = width / height;
    renderer.setSize(width, height, false);
    perspective.aspect = aspect;
    perspective.updateProjectionMatrix();
    if (camera === orthographic) fitOrthographic(orthographic.top / Math.tan(THREE.MathUtils.degToRad(perspective.fov / 2)));
  }

  // --- loop -----------------------------------------------------------------
  let infoTimer = 0;
  let last = performance.now();
  function frame(now) {
    if (disposed) return;
    const delta = Math.min((now - last) / 1000, 0.05);
    last = now;
    controls.update();
    renderer.render(scene, camera);
    infoTimer += delta;
    if (infoTimer >= 0.1) {
      infoTimer = 0;
      onInfo({
        stage: currentStage,
        loading,
        wireframe,
        xray,
        camera: camera === perspective ? "Perspective" : "Orthographic",
        view: currentView,
      });
    }
    requestAnimationFrame(frame);
  }

  setStage(currentStage);
  setView("persp");
  requestAnimationFrame(frame);

  const actions = { setStage, setView, swapCamera: () => swapCamera(), frameSelected, toggleWireframe, toggleXray, reset };

  function dispose() {
    disposed = true;
    window.removeEventListener("keydown", onKeyDown);
    controls.dispose();
    for (const { root } of stages.values()) disposeObject(root);
    for (const material of surfaceMaterials.values()) material.dispose();
    edgeMaterial.dispose();
    grid.geometry.dispose();
    grid.material.dispose();
    axes.traverse((object) => {
      if (object.geometry) object.geometry.dispose();
      if (object.material) object.material.dispose();
    });
    renderer.dispose();
  }

  return { resize, actions, dispose };
}
