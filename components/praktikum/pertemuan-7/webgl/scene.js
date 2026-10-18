// Interactive 3D prototype for Pertemuan 7, kept free of React so the
// Three.js part can be read on its own (same split as Pertemuan 6).
// Nothing here touches `window` at module top level, because the portal
// imports this file on the server while prerendering.
//
// three stays pinned to r182 (see Pertemuan 6's README): from r183 the
// THREE.Clock constructor logs a deprecation warning, and the module asks for
// both THREE.Clock-style delta time and a clean console.

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const MAX_DELTA_SECONDS = 0.05; // clamps delta time after a backgrounded tab
const INFO_INTERVAL_SECONDS = 0.1; // HUD refresh rate (10x per second)
const MAX_PIXEL_RATIO = 2;

const CAMERA_FOV = 55;
const CAMERA_POSITION = new THREE.Vector3(5, 3.5, 7); // module section 12
const CAMERA_TARGET = new THREE.Vector3(-0.6, 1, -0.6);

const HOVER_SCALE = 1.06;
const SELECTED_SCALE = 1.12;
const SELECTED_SPIN = 0.6; // radians / second (Challenge G)
const DRAG_THRESHOLD_PX = 5;
const CROSSFADE_SECONDS = 0.35;

/** Eksperimen 26 — four roughness × metalness corners, plus the starting material. */
export const PBR_PRESETS = [
  { label: "Default", roughness: 0.25, metalness: 0.1 },
  { label: "A", roughness: 0.1, metalness: 0.0 },
  { label: "B", roughness: 0.8, metalness: 0.0 },
  { label: "C", roughness: 0.1, metalness: 1.0 },
  { label: "D", roughness: 0.8, metalness: 1.0 },
];

/** Challenge E — roughness varies along X, metalness along Z. */
const GALLERY_ROUGHNESS = [0.1, 0.5, 0.9];
const GALLERY_METALNESS = [0, 0.5, 1];

/** The Wave clip plays once, then the robot returns to its looping clip (Challenge B). */
const ONE_SHOT_CLIPS = new Set(["Wave"]);

/** True when a key press is aimed at a text field rather than the scene. */
function isFormElement(target) {
  return (
    typeof HTMLElement !== "undefined" &&
    target instanceof HTMLElement &&
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
  );
}

const toPlain = (vector) => ({ x: vector.x, y: vector.y, z: vector.z });

/**
 * Builds the scene on `canvas` and starts its animation loop.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {{
 *   modelUrl?: string,
 *   onInfo?: (info: object) => void,
 *   isInputActive?: () => boolean,
 * }} [options]
 *   modelUrl is where the GLB is served from; onInfo receives a HUD snapshot
 *   10x per second; isInputActive lets the host decide when keys reach the scene.
 */
export function createInteractiveScene(
  canvas,
  { modelUrl = "/praktikum-7/robot.glb", onInfo = () => {}, isInputActive = () => true } = {},
) {
  let disposed = false;

  // ------------------------------------------------------------------
  // RENDERER
  // ------------------------------------------------------------------
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO));
  renderer.shadowMap.enabled = true;
  // PCFSoftShadowMap is deprecated in r182 and would log a warning.
  renderer.shadowMap.type = THREE.PCFShadowMap;
  // ACES keeps the extra light from the environment map from blowing out highlights.
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b1020);

  // ------------------------------------------------------------------
  // ENVIRONMENT — procedural, so it works without any image asset (section 62)
  // scene.background stays a flat colour on purpose: the environment lights
  // and reflects off materials without ever being visible as a backdrop.
  // ------------------------------------------------------------------
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  const roomEnvironment = new RoomEnvironment();
  // On Windows, ANGLE's Direct3D shader compiler reports harmless precision
  // warnings (X4122 / X4008) for three's own PMREM pre-filtering shaders, and
  // three prints them as a console warning. Those shaders run only here, once,
  // so the info-log check is skipped for this step alone — every material in
  // the scene is still checked normally.
  renderer.debug.checkShaderErrors = false;
  const environmentMap = pmremGenerator.fromScene(roomEnvironment, 0.04).texture;
  renderer.debug.checkShaderErrors = true;
  roomEnvironment.traverse((object) => {
    if (object.isMesh) {
      object.geometry.dispose();
      object.material.dispose();
    }
  });
  scene.environment = environmentMap;
  let environmentOn = true;

  // ------------------------------------------------------------------
  // CAMERAS + ORBITCONTROLS (section 39.1)
  // ------------------------------------------------------------------
  const perspectiveCamera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, 0.1, 100);
  const orthographicCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  perspectiveCamera.position.copy(CAMERA_POSITION);

  let activeCamera = perspectiveCamera;
  let aspect = 1;
  let orthoHalfHeight = 1;

  function updateOrthographicFrustum() {
    orthographicCamera.left = -orthoHalfHeight * aspect;
    orthographicCamera.right = orthoHalfHeight * aspect;
    orthographicCamera.top = orthoHalfHeight;
    orthographicCamera.bottom = -orthoHalfHeight;
    orthographicCamera.updateProjectionMatrix();
  }

  /** New OrbitControls for `camera`, with the navigation limits the module asks for. */
  function createControls(camera, target) {
    const next = new OrbitControls(camera, canvas);
    next.enableDamping = true;
    next.dampingFactor = 0.08;
    next.minDistance = 3; // PerspectiveCamera
    next.maxDistance = 25;
    next.minZoom = 0.5; // OrthographicCamera
    next.maxZoom = 3;
    // Stops the orbit just short of the horizontal plane through the target.
    next.maxPolarAngle = Math.PI / 2 - 0.05;
    next.target.copy(target);
    next.update();
    return next;
  }

  let controls = createControls(activeCamera, CAMERA_TARGET);

  /**
   * Swaps perspective ↔ orthographic. Position and target are copied across
   * before the old controls are disposed, so switching never snaps the view
   * back to the centre of the scene. The orthographic box is sized from the
   * perspective frustum at the current distance, so the scene keeps its size.
   */
  function switchCamera(mode) {
    const next = mode === "Orthographic" ? orthographicCamera : perspectiveCamera;
    if (next === activeCamera) return;

    const position = activeCamera.position.clone();
    const target = controls.target.clone();
    controls.dispose();

    if (next === orthographicCamera) {
      orthoHalfHeight =
        Math.tan(THREE.MathUtils.degToRad(perspectiveCamera.fov / 2)) * position.distanceTo(target);
      orthographicCamera.zoom = 1;
      updateOrthographicFrustum();
    }

    next.position.copy(position);
    activeCamera = next;
    controls = createControls(next, target);
  }

  // ------------------------------------------------------------------
  // LIGHTS + GROUND
  // ------------------------------------------------------------------
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.45);

  const sun = new THREE.DirectionalLight(0xffffff, 2.5);
  sun.position.set(4, 7, 4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.radius = 3;
  sun.shadow.camera.left = -9;
  sun.shadow.camera.right = 9;
  sun.shadow.camera.top = 9;
  sun.shadow.camera.bottom = -9;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 25;
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.02;
  scene.add(ambientLight, sun);

  const groundGeometry = new THREE.PlaneGeometry(20, 20);
  groundGeometry.rotateX(-Math.PI / 2);
  const ground = new THREE.Mesh(
    groundGeometry,
    new THREE.MeshStandardMaterial({ color: 0x263449, roughness: 0.85, metalness: 0 }),
  );
  ground.name = "Ground";
  ground.receiveShadow = true;
  scene.add(ground);

  // ------------------------------------------------------------------
  // SELECTION BOOKKEEPING
  // ------------------------------------------------------------------
  const interactiveObjects = [];

  /**
   * Marks `object` as one selectable entity. Raycasts often hit a child mesh,
   * which findSelectableRoot() walks back up to this object. Base scale and
   * rotation are remembered so feedback and Reset never drift.
   */
  function registerSelectable(object, label) {
    object.userData.selectable = true;
    object.userData.label = label;
    object.userData.baseScale = object.scale.clone();
    object.userData.baseRotationY = object.rotation.y;
    interactiveObjects.push(object);
  }

  function findSelectableRoot(object) {
    let current = object;
    while (current) {
      if (current.userData.selectable) return current;
      current = current.parent;
    }
    return null;
  }

  function castShadows(root) {
    root.traverse((object) => {
      if (object.isMesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });
  }

  // ------------------------------------------------------------------
  // HIERARCHY DEMO — Group > body > child (sections 18-22)
  // ------------------------------------------------------------------
  const hierarchyGroup = new THREE.Group();
  hierarchyGroup.name = "Hierarchy Demo";
  hierarchyGroup.position.set(-3, 0, 0.6);
  hierarchyGroup.rotation.y = Math.PI / 6;
  scene.add(hierarchyGroup);

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 0.6, 1.0),
    new THREE.MeshStandardMaterial({ color: 0x0ea5e9, roughness: 0.45, metalness: 0.15 }),
  );
  body.name = "Body";
  body.position.y = 0.8;
  hierarchyGroup.add(body);

  const child = new THREE.Mesh(
    new THREE.BoxGeometry(0.45, 0.45, 0.45),
    new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.3, metalness: 0.1 }),
  );
  child.name = "Child Object";
  child.position.set(1.0, 0, 0); // local: relative to body, not to the world
  child.rotation.z = Math.PI / 4;
  body.add(child);

  // Four wheels make the group hold well over the three meshes Eksperimen 3 asks for.
  const wheelGeometry = new THREE.CylinderGeometry(0.22, 0.22, 0.14, 24);
  const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7, metalness: 0.4 });
  for (const [x, z] of [[-0.55, 0.52], [0.55, 0.52], [-0.55, -0.52], [0.55, -0.52]]) {
    const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
    wheel.name = "Wheel";
    wheel.position.set(x, -0.32, z);
    wheel.rotation.x = Math.PI / 2;
    body.add(wheel);
  }

  castShadows(hierarchyGroup);
  registerSelectable(hierarchyGroup, "Hierarchy Group");

  // Milestone 3 — local and world position differ once the parent is transformed.
  const childWorld = new THREE.Vector3();
  child.getWorldPosition(childWorld);
  console.log("[Pertemuan 7] Child local:", toPlain(child.position), "Child world:", toPlain(childWorld));

  // ------------------------------------------------------------------
  // PBR SPHERE (sections 23-26)
  // ------------------------------------------------------------------
  const pbrMaterial = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.25, metalness: 0.1 });
  const pbrSphere = new THREE.Mesh(new THREE.SphereGeometry(0.7, 48, 24), pbrMaterial);
  pbrSphere.name = "PBR Sphere";
  pbrSphere.position.set(-0.2, 0.8, 1.6);
  pbrSphere.castShadow = true;
  scene.add(pbrSphere);
  registerSelectable(pbrSphere, "PBR Sphere");

  let pbrPresetIndex = 0;
  function setPbrPreset(index) {
    const preset = PBR_PRESETS[index];
    if (!preset) return;
    pbrPresetIndex = index;
    pbrMaterial.roughness = preset.roughness;
    pbrMaterial.metalness = preset.metalness;
  }

  // ------------------------------------------------------------------
  // PBR GALLERY — Challenge E (each sphere is selectable on its own)
  // ------------------------------------------------------------------
  const gallery = new THREE.Group();
  gallery.name = "PBR Gallery";
  gallery.position.set(0.2, 0, -2.6);
  scene.add(gallery);

  const gallerySphere = new THREE.SphereGeometry(0.32, 40, 20);
  GALLERY_METALNESS.forEach((metalness, row) => {
    GALLERY_ROUGHNESS.forEach((roughness, column) => {
      const sphere = new THREE.Mesh(
        gallerySphere,
        new THREE.MeshStandardMaterial({ color: 0xe2b04a, roughness, metalness }),
      );
      sphere.name = `Gallery r${roughness} m${metalness}`;
      sphere.position.set((column - 1) * 0.9, 0.34, (row - 1) * 0.9);
      sphere.castShadow = true;
      gallery.add(sphere);
      registerSelectable(sphere, `Gallery — roughness ${roughness}, metalness ${metalness}`);
    });
  });

  // ------------------------------------------------------------------
  // SOLAR SYSTEM — Challenge D. Only the orbit groups rotate; the planets'
  // world positions come out of the hierarchy, never computed by hand.
  //
  // Sun └── Earth Orbit └── Earth └── Moon Orbit └── Moon
  // ------------------------------------------------------------------
  const solarSystem = new THREE.Group();
  solarSystem.name = "Solar System";
  solarSystem.position.set(-4.4, 2.6, -3.4);
  scene.add(solarSystem);

  const sunMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.42, 32, 16),
    new THREE.MeshStandardMaterial({ color: 0xffb347, emissive: 0xff8c1a, emissiveIntensity: 1.6, roughness: 0.6 }),
  );
  sunMesh.name = "Sun";
  solarSystem.add(sunMesh);

  const earthOrbit = new THREE.Group();
  earthOrbit.name = "Earth Orbit";
  sunMesh.add(earthOrbit);

  const earth = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 24, 12),
    new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.55, metalness: 0.05 }),
  );
  earth.name = "Earth";
  earth.position.x = 1.3;
  earthOrbit.add(earth);

  const moonOrbit = new THREE.Group();
  moonOrbit.name = "Moon Orbit";
  earth.add(moonOrbit);

  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(0.07, 16, 8),
    new THREE.MeshStandardMaterial({ color: 0xd1d5db, roughness: 0.9 }),
  );
  moon.name = "Moon";
  moon.position.x = 0.36;
  moonOrbit.add(moon);

  castShadows(solarSystem);
  registerSelectable(solarSystem, "Solar System");

  // ------------------------------------------------------------------
  // SELECTION RING — an outline-like helper on the ground under the
  // selected entity, sized from its bounding box every frame.
  // ------------------------------------------------------------------
  const ringGeometry = new THREE.RingGeometry(0.92, 1, 64);
  ringGeometry.rotateX(-Math.PI / 2);
  const selectionRing = new THREE.Mesh(
    ringGeometry,
    new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.85, depthWrite: false }),
  );
  selectionRing.name = "Selection Ring";
  selectionRing.visible = false;
  scene.add(selectionRing);

  const ringBox = new THREE.Box3();
  const ringCenter = new THREE.Vector3();
  const ringSize = new THREE.Vector3();

  // ------------------------------------------------------------------
  // GLB MODEL + ANIMATIONMIXER (sections 27-38)
  // ------------------------------------------------------------------
  let importedModel = null;
  let mixer = null;
  let clipActions = [];
  let activeIndex = -1;
  let loopIndex = 0;
  let loading = { state: "loading", percent: 0 };
  let modelSummary = null;

  /**
   * Challenge A — switches to clip `index` with a crossfade. One-shot clips
   * (Wave) play once and hand back to the looping clip that was running.
   */
  function playClip(index) {
    const next = clipActions[index];
    if (!next) return;

    const current = clipActions[activeIndex];
    if (next === current && next.isRunning()) return;

    const once = ONE_SHOT_CLIPS.has(next.getClip().name);
    next.reset();
    next.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity);
    next.play();
    if (current && current !== next) current.crossFadeTo(next, CROSSFADE_SECONDS, false);

    activeIndex = index;
    if (!once) loopIndex = index;
  }

  function onClipFinished(event) {
    if (event.action === clipActions[activeIndex]) playClip(loopIndex);
  }

  function disposeObject(root) {
    root.traverse((object) => {
      if (object.isMesh) {
        object.geometry.dispose();
        for (const material of [].concat(object.material)) material.dispose();
      }
    });
  }

  const loader = new GLTFLoader();
  loader.load(
    modelUrl,
    (gltf) => {
      // The component may have unmounted (or Strict Mode remounted) while
      // the download was in flight — free the result instead of adding it.
      if (disposed) {
        disposeObject(gltf.scene);
        return;
      }

      importedModel = gltf.scene;
      importedModel.name = "Imported GLB";
      importedModel.position.set(2.6, 0, 0.4);
      importedModel.rotation.y = -0.35;
      castShadows(importedModel);

      // Eksperimen 7 — what did the import actually bring in?
      let nodeCount = 0;
      let maxDepth = 0;
      const meshNames = [];
      importedModel.traverse((object) => {
        nodeCount += 1;
        let depth = 0;
        for (let parent = object.parent; parent && parent !== importedModel; parent = parent.parent) depth += 1;
        maxDepth = Math.max(maxDepth, depth);
        if (object.isMesh) meshNames.push(object.name);
      });
      modelSummary = {
        rootName: importedModel.children[0]?.name ?? importedModel.name,
        nodeCount,
        meshCount: meshNames.length,
        depth: maxDepth,
        meshNames,
      };
      console.log("[Pertemuan 7] GLB hierarchy:", modelSummary);
      console.log(
        "[Pertemuan 7] Animation clips:",
        gltf.animations.map((clip) => `${clip.name} (${clip.duration.toFixed(2)} s)`),
      );

      scene.add(importedModel);
      registerSelectable(importedModel, "Imported GLB — Robot");

      if (gltf.animations.length > 0) {
        mixer = new THREE.AnimationMixer(importedModel);
        mixer.addEventListener("finished", onClipFinished);
        clipActions = gltf.animations.map((clip) => mixer.clipAction(clip));
        playClip(0);
      }

      loading = { state: "loaded", percent: 100 };
    },
    (progress) => {
      if (progress.total > 0) {
        loading = { state: "loading", percent: Math.round((progress.loaded / progress.total) * 100) };
      }
    },
    (error) => {
      if (disposed) return;
      console.error("[Pertemuan 7] GLTF loading error:", error);
      loading = { state: "error", percent: 0 };
    },
  );

  // ------------------------------------------------------------------
  // INTERACTION STATE + VISUAL FEEDBACK (sections 50-57)
  // ------------------------------------------------------------------
  let hoveredObject = null;
  let selectedObject = null;

  /** Selected > hovered > normal — one function decides, so the two states never fight. */
  function refreshVisual(object) {
    const base = object?.userData.baseScale;
    if (!base) return;
    const factor = object === selectedObject ? SELECTED_SCALE : object === hoveredObject ? HOVER_SCALE : 1;
    object.scale.copy(base).multiplyScalar(factor);
  }

  function setHovered(next) {
    if (next === hoveredObject) return;
    const previous = hoveredObject;
    hoveredObject = next;
    refreshVisual(previous);
    refreshVisual(next);
    canvas.style.cursor = next ? "pointer" : "";
  }

  function setSelected(next) {
    if (next === selectedObject) return;
    const previous = selectedObject;
    selectedObject = next;
    refreshVisual(previous);
    refreshVisual(next);
  }

  // ------------------------------------------------------------------
  // RAYCASTING (sections 40-49)
  // ------------------------------------------------------------------
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2(); // NDC, -1..+1 on both axes
  let pointerInside = false;

  /** Screen pixels → NDC, measured against the canvas itself rather than the window. */
  function updatePointer(event) {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  /** Recursive, so a hit on a GLB child mesh still counts; mapped back to its selectable root. */
  function pick() {
    raycaster.setFromCamera(pointer, activeCamera);
    const hits = raycaster.intersectObjects(interactiveObjects, true);
    return hits.length > 0 ? findSelectableRoot(hits[0].object) : null;
  }

  // Click vs drag (section 39.1): an orbit/pan drag is followed by a click
  // event, which must not change the selection.
  let selectionGesture = null;
  let suppressSelection = false;

  function onPointerDown(event) {
    suppressSelection = event.button !== 0 || selectionGesture !== null;
    selectionGesture = { id: event.pointerId, x: event.clientX, y: event.clientY };
  }

  // Watched on window in the capture phase so the movement is still seen
  // while OrbitControls holds pointer capture during a drag.
  function onWindowPointerMove(event) {
    if (!selectionGesture || event.pointerId !== selectionGesture.id) return;
    if (Math.hypot(event.clientX - selectionGesture.x, event.clientY - selectionGesture.y) > DRAG_THRESHOLD_PX) {
      suppressSelection = true;
    }
  }

  function onWindowPointerUp(event) {
    if (event.pointerId === selectionGesture?.id) selectionGesture = null;
  }

  function onWindowPointerCancel() {
    selectionGesture = null;
    suppressSelection = true;
  }

  /** Hover: temporary feedback that follows the pointer. */
  function onCanvasPointerMove(event) {
    pointerInside = true;
    updatePointer(event);
    if (selectionGesture) return; // keep hover steady while dragging
    setHovered(pick());
  }

  function onCanvasPointerLeave() {
    pointerInside = false;
    if (!selectionGesture) setHovered(null);
  }

  /** Click: persistent selection. Clicking the robot also plays its Wave clip (Challenge B). */
  function onCanvasClick(event) {
    if (suppressSelection || event.button !== 0) return;

    updatePointer(event);
    const hit = pick();
    setSelected(hit);

    if (hit && hit === importedModel) {
      const waveIndex = clipActions.findIndex((action) => action.getClip().name === "Wave");
      if (waveIndex !== -1) playClip(waveIndex);
    }
  }

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onCanvasPointerMove);
  canvas.addEventListener("pointerleave", onCanvasPointerLeave);
  canvas.addEventListener("click", onCanvasClick);
  window.addEventListener("pointermove", onWindowPointerMove, true);
  window.addEventListener("pointerup", onWindowPointerUp);
  window.addEventListener("pointercancel", onWindowPointerCancel);

  // ------------------------------------------------------------------
  // ACTIONS — shared by keyboard shortcuts and the portal's buttons
  // ------------------------------------------------------------------
  function setEnvironment(on) {
    environmentOn = on;
    scene.environment = on ? environmentMap : null;
  }

  function reset() {
    switchCamera("Perspective");
    perspectiveCamera.fov = CAMERA_FOV;
    perspectiveCamera.zoom = 1;
    perspectiveCamera.updateProjectionMatrix();
    perspectiveCamera.position.copy(CAMERA_POSITION);
    controls.target.copy(CAMERA_TARGET);
    controls.update();
    orthographicCamera.zoom = 1;
    orthographicCamera.updateProjectionMatrix();

    setHovered(null);
    setSelected(null);
    for (const object of interactiveObjects) object.rotation.y = object.userData.baseRotationY;
    setEnvironment(true);
    setPbrPreset(0);
    playClip(0);
  }

  const actions = {
    reset,
    playClip,
    setPbrPreset,
    cyclePbrPreset() {
      setPbrPreset((pbrPresetIndex + 1) % PBR_PRESETS.length);
    },
    toggleEnvironment() {
      setEnvironment(!environmentOn);
    },
    setCamera: switchCamera,
    toggleCamera() {
      switchCamera(activeCamera === perspectiveCamera ? "Orthographic" : "Perspective");
    },
    clearSelection() {
      setSelected(null);
    },
  };

  function onKeyDown(event) {
    if (!isInputActive() || isFormElement(event.target) || event.repeat) return;

    if (event.code === "Digit1") actions.playClip(0);
    if (event.code === "Digit2") actions.playClip(1);
    if (event.code === "Digit3") actions.playClip(2);
    if (event.code === "KeyE") actions.toggleEnvironment();
    if (event.code === "KeyC") actions.toggleCamera();
    if (event.code === "KeyM") actions.cyclePbrPreset();
    if (event.code === "Escape") actions.clearSelection();
    if (event.code === "KeyR") actions.reset();
  }

  window.addEventListener("keydown", onKeyDown);

  // ------------------------------------------------------------------
  // RESIZE
  // ------------------------------------------------------------------
  function resize(width, height) {
    if (width <= 0 || height <= 0) return;
    renderer.setSize(width, height, false);
    aspect = width / height;
    perspectiveCamera.aspect = aspect;
    perspectiveCamera.updateProjectionMatrix();
    updateOrthographicFrustum();
  }

  resize(canvas.clientWidth || 1, canvas.clientHeight || 1);

  // ------------------------------------------------------------------
  // HUD SNAPSHOT
  // ------------------------------------------------------------------
  const scratch = new THREE.Vector3();

  /** Material description for the information panel (Challenge C). */
  function describeMaterial(object) {
    if (object.isMesh) {
      const material = object.material;
      return material.isMeshStandardMaterial
        ? `${material.type} (r ${material.roughness.toFixed(2)}, m ${material.metalness.toFixed(2)})`
        : material.type;
    }

    const counts = new Map();
    object.traverse((node) => {
      if (node.isMesh) {
        for (const material of [].concat(node.material)) {
          counts.set(material.type, (counts.get(material.type) ?? 0) + 1);
        }
      }
    });
    return [...counts].map(([type, count]) => `${type} ×${count}`).join(", ") || "—";
  }

  function describeSelection(object) {
    if (!object) return null;
    const rotation = object.rotation;
    return {
      label: object.userData.label,
      name: object.name,
      kind: object === importedModel ? "Imported GLB" : object.isMesh ? "Mesh" : "Group",
      position: toPlain(object.position),
      worldPosition: toPlain(object.getWorldPosition(scratch)),
      rotationDeg: {
        x: THREE.MathUtils.radToDeg(rotation.x),
        y: THREE.MathUtils.euclideanModulo(THREE.MathUtils.radToDeg(rotation.y), 360),
        z: THREE.MathUtils.radToDeg(rotation.z),
      },
      // The resting scale, without the 1.12× selection feedback on top.
      scale: toPlain(object.userData.baseScale),
      material: describeMaterial(object),
    };
  }

  function buildInfo(fps) {
    const preset = PBR_PRESETS[pbrPresetIndex];
    child.getWorldPosition(childWorld);

    return {
      fps,
      loading,
      hoverLabel: hoveredObject?.userData.label ?? null,
      selected: describeSelection(selectedObject),
      clips: clipActions.map((action) => action.getClip().name),
      activeClip: clipActions[activeIndex]?.getClip().name ?? null,
      activeClipIndex: activeIndex,
      environment: environmentOn,
      camera: activeCamera === perspectiveCamera ? "Perspective" : "Orthographic",
      zoom: activeCamera.zoom,
      distance: activeCamera.position.distanceTo(controls.target),
      pbrPresetIndex,
      pbrPreset: { label: preset.label, roughness: pbrMaterial.roughness, metalness: pbrMaterial.metalness },
      pointer: pointerInside ? { x: pointer.x, y: pointer.y } : null,
      childLocal: toPlain(child.position),
      childWorld: toPlain(childWorld),
      model: modelSummary,
    };
  }

  // ------------------------------------------------------------------
  // ANIMATION LOOP (section 66)
  // ------------------------------------------------------------------
  const clock = new THREE.Clock();
  let rafId = 0;
  let infoAccum = 0;
  let framesSinceInfo = 0;

  function updateSelectionRing() {
    if (!selectedObject) {
      selectionRing.visible = false;
      return;
    }
    ringBox.setFromObject(selectedObject);
    ringBox.getCenter(ringCenter);
    ringBox.getSize(ringSize);
    const radius = Math.max(ringSize.x, ringSize.z) * 0.62 + 0.15;
    selectionRing.position.set(ringCenter.x, 0.02, ringCenter.z);
    selectionRing.scale.setScalar(radius);
    selectionRing.visible = true;
  }

  function frame() {
    const rawDelta = clock.getDelta();
    const dt = Math.min(rawDelta, MAX_DELTA_SECONDS);

    // Without this the clip "plays" but its time never advances.
    mixer?.update(dt);

    hierarchyGroup.rotation.y += 0.25 * dt;
    child.rotation.x += 1.2 * dt;

    sunMesh.rotation.y += 0.2 * dt;
    earthOrbit.rotation.y += 0.7 * dt;
    earth.rotation.y += 1.5 * dt;
    moonOrbit.rotation.y += 2.4 * dt;

    // Challenge G — the selected entity turns slowly; deselecting stops it.
    if (selectedObject) selectedObject.rotation.y += SELECTED_SPIN * dt;

    updateSelectionRing();

    // Damping needs one update per frame, before rendering.
    controls.update();
    renderer.render(scene, activeCamera);

    framesSinceInfo += 1;
    infoAccum += rawDelta;
    if (infoAccum >= INFO_INTERVAL_SECONDS) {
      onInfo(buildInfo(framesSinceInfo / infoAccum));
      framesSinceInfo = 0;
      infoAccum = 0;
    }

    rafId = requestAnimationFrame(frame);
  }

  rafId = requestAnimationFrame(frame);

  // ------------------------------------------------------------------
  // CLEANUP — GPU resources are not garbage collected
  // ------------------------------------------------------------------
  function dispose() {
    disposed = true;
    cancelAnimationFrame(rafId);

    canvas.removeEventListener("pointerdown", onPointerDown);
    canvas.removeEventListener("pointermove", onCanvasPointerMove);
    canvas.removeEventListener("pointerleave", onCanvasPointerLeave);
    canvas.removeEventListener("click", onCanvasClick);
    window.removeEventListener("pointermove", onWindowPointerMove, true);
    window.removeEventListener("pointerup", onWindowPointerUp);
    window.removeEventListener("pointercancel", onWindowPointerCancel);
    window.removeEventListener("keydown", onKeyDown);
    canvas.style.cursor = "";

    controls.dispose();
    if (mixer) {
      mixer.removeEventListener("finished", onClipFinished);
      mixer.stopAllAction();
      mixer.uncacheRoot(importedModel);
    }

    disposeObject(scene);
    environmentMap.dispose();
    pmremGenerator.dispose();
    sun.dispose(); // frees the shadow map
    renderer.dispose();
  }

  return { resize, actions, dispose };
}
