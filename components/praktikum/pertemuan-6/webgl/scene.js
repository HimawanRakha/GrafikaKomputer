// Mini 3D scene for the Pertemuan 6 portal page, kept free of React so the
// Three.js part can be read on its own. Nothing here touches `window` at
// module top level, because the portal imports this file on the server while
// prerendering.
//
// three is pinned to r182 on purpose: from r183 the THREE.Clock constructor
// logs a deprecation warning, while the assignment requires both THREE.Clock
// and a clean console.

import * as THREE from "three";

const MAX_DELTA_SECONDS = 0.05; // clamps delta time after a backgrounded tab
const INFO_INTERVAL_SECONDS = 0.1; // HUD refresh rate (10x per second)
const MAX_PIXEL_RATIO = 2; // a 3x display would triple fill cost for no visible gain

const CAMERA_FOV = 50;
const CAMERA_POSITION = new THREE.Vector3(7, 5.5, 9);
const CAMERA_TARGET = new THREE.Vector3(0, 0.8, 0);

const LIGHT_ORBIT_RADIUS = 7;
const LIGHT_HEIGHT = 9;
const LIGHT_START_ANGLE = 0.7; // radians
const LIGHT_ORBIT_SPEED = 0.6; // radians / second

const MOVE_SPEED = 2.5; // units / second
const ROTATE_SPEED = Math.PI; // radians / second
const SCALE_SPEED = 0.8; // scale factor / second
const SCALE_LIMITS = [0.4, 2.2];
const MOVE_LIMIT = 8;

const SELECTED_EMISSIVE = 0x5a3c00;

/** Challenge "Shadow quality": bigger shadow maps give sharper, less blocky edges. */
export const SHADOW_QUALITIES = [
  { label: "Low", size: 256, radius: 1 },
  { label: "Medium", size: 1024, radius: 3 },
  { label: "High", size: 2048, radius: 4 },
];

const SHADOW_DEFAULT_INDEX = 1;

/** True when a key press is aimed at a text field rather than the scene. */
function isFormElement(target) {
  return (
    typeof HTMLElement !== "undefined" &&
    target instanceof HTMLElement &&
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
  );
}

/**
 * Builds the scene on `canvas` and starts its animation loop.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {{ onInfo?: (info: object) => void, isInputActive?: () => boolean }} [options]
 *   onInfo receives a HUD snapshot 10x per second; isInputActive lets the host
 *   page decide when keyboard input should reach the scene.
 */
export function createMiniScene(canvas, { onInfo = () => {}, isInputActive = () => true } = {}) {
  // ------------------------------------------------------------------
  // RENDERER
  // ------------------------------------------------------------------
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO));
  renderer.shadowMap.enabled = true;
  // PCFShadowMap rather than PCFSoftShadowMap: the soft variant is deprecated
  // in r182 (it logs a warning). PCF here is already softened by shadow.radius.
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b1220);
  // Fog in the background colour fades the ground's far edge into the sky.
  scene.fog = new THREE.Fog(0x0b1220, 16, 40);

  // ------------------------------------------------------------------
  // CAMERAS — perspective by default, orthographic as a challenge
  // ------------------------------------------------------------------
  const perspectiveCamera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, 0.1, 100);
  const orthographicCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);

  for (const camera of [perspectiveCamera, orthographicCamera]) {
    camera.position.copy(CAMERA_POSITION);
    camera.lookAt(CAMERA_TARGET);
  }

  let activeCamera = perspectiveCamera;
  let aspect = 1;

  /**
   * Applies the current aspect to both cameras. The orthographic box is sized
   * from the perspective frustum's height at the target distance, so switching
   * cameras does not make the scene jump in size.
   */
  function updateCameras() {
    // On a portrait screen a fixed vertical FOV leaves a very narrow horizontal
    // view and crops the scene's sides. Widening the vertical FOV by 1/aspect
    // keeps the horizontal view the same as on a square screen.
    const halfFov = Math.atan(
      Math.tan(THREE.MathUtils.degToRad(CAMERA_FOV / 2)) / Math.min(aspect, 1),
    );

    perspectiveCamera.aspect = aspect;
    perspectiveCamera.fov = THREE.MathUtils.radToDeg(halfFov * 2);
    perspectiveCamera.updateProjectionMatrix();

    const distance = CAMERA_POSITION.distanceTo(CAMERA_TARGET);
    const halfHeight = Math.tan(halfFov) * distance;
    const halfWidth = halfHeight * aspect;

    orthographicCamera.left = -halfWidth;
    orthographicCamera.right = halfWidth;
    orthographicCamera.top = halfHeight;
    orthographicCamera.bottom = -halfHeight;
    orthographicCamera.updateProjectionMatrix();
  }

  // ------------------------------------------------------------------
  // LIGHTS
  // ------------------------------------------------------------------
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.45);

  const sun = new THREE.DirectionalLight(0xffffff, 2.4);
  sun.castShadow = true;
  // The shadow camera is an orthographic box; keeping it tight around the
  // scene spends the shadow map's pixels where objects actually are.
  sun.shadow.camera.left = -8;
  sun.shadow.camera.right = 8;
  sun.shadow.camera.top = 8;
  sun.shadow.camera.bottom = -8;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 30;
  // A small bias pushes the depth comparison off the surface, which removes
  // "shadow acne" (striped self-shadowing on lit faces).
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.02;

  scene.add(ambientLight, sun);

  let lightAngle = LIGHT_START_ANGLE;
  let lightAnimated = true;

  /** Places the sun on its orbit; the shadow follows because the light moves. */
  function placeLight() {
    sun.position.set(
      Math.cos(lightAngle) * LIGHT_ORBIT_RADIUS,
      LIGHT_HEIGHT,
      Math.sin(lightAngle) * LIGHT_ORBIT_RADIUS,
    );
  }

  placeLight();

  let shadowIndex = SHADOW_DEFAULT_INDEX;

  /**
   * Changes the shadow map resolution. The existing map is disposed and set to
   * null so the renderer allocates a new one at the new size on the next frame.
   */
  function setShadowQuality(index) {
    const quality = SHADOW_QUALITIES[index];
    if (!quality) return;

    shadowIndex = index;
    sun.shadow.mapSize.set(quality.size, quality.size);
    sun.shadow.radius = quality.radius;

    if (sun.shadow.map) {
      sun.shadow.map.dispose();
      sun.shadow.map = null;
    }
  }

  setShadowQuality(shadowIndex);

  // ------------------------------------------------------------------
  // MESHES
  // ------------------------------------------------------------------

  /** Creates a shadow-casting mesh, applies its transform, and remembers it for Reset. */
  function addMesh(name, geometry, material, { position, rotation = [0, 0, 0], scale = [1, 1, 1] }) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.position.set(...position);
    mesh.rotation.set(...rotation);
    mesh.scale.set(...scale);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.initial = {
      position: mesh.position.clone(),
      rotation: mesh.rotation.clone(),
      scale: mesh.scale.clone(),
    };
    mesh.userData.scaleFactor = 1;
    scene.add(mesh);
    return mesh;
  }

  // Ground: receives shadows but casts none.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 60),
    new THREE.MeshStandardMaterial({ color: 0x2b3a4e, roughness: 1 }),
  );
  ground.name = "Ground";
  // PlaneGeometry is built in the XY plane; rotating -90° about X lays it flat.
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Box with a non-uniform scale (taller than it is wide).
  const box = addMesh(
    "Box",
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0x4f8cff, roughness: 0.5 }),
    { position: [-2.6, 0.75, -0.5], rotation: [0, 0.4, 0], scale: [1.2, 1.5, 1.2] },
  );

  const sphere = addMesh(
    "Sphere",
    new THREE.SphereGeometry(0.8, 48, 32),
    new THREE.MeshPhongMaterial({ color: 0xff7a59, shininess: 80 }),
    { position: [0, 0.8, -0.3] },
  );

  // Challenge "Tambah 2 geometry": TorusKnot and Cone.
  const torusKnot = addMesh(
    "TorusKnot",
    new THREE.TorusKnotGeometry(0.55, 0.18, 128, 16),
    new THREE.MeshStandardMaterial({ color: 0x9b6bff, metalness: 0.4, roughness: 0.3 }),
    { position: [2.6, 1.4, -0.5], rotation: [0.3, 0, 0] },
  );

  // Six radial segments make a hexagonal pyramid, so its spin is visible.
  const cone = addMesh(
    "Cone",
    new THREE.ConeGeometry(0.7, 1.6, 6),
    new THREE.MeshLambertMaterial({ color: 0x3ccf91, flatShading: true }),
    { position: [0, 0.8, -3.2], scale: [1.1, 1.1, 1.1] },
  );

  // Challenge "Material gallery": same geometry and colour, four materials.
  // MeshBasicMaterial ignores lights entirely, so it reads flat next to the others.
  const GALLERY = [
    ["Basic", THREE.MeshBasicMaterial, {}],
    ["Lambert", THREE.MeshLambertMaterial, {}],
    ["Phong", THREE.MeshPhongMaterial, { shininess: 100 }],
    ["Standard", THREE.MeshStandardMaterial, { roughness: 0.35, metalness: 0.2 }],
  ];

  GALLERY.forEach(([label, MaterialClass, extra], index) => {
    addMesh(
      `Gallery ${label}`,
      new THREE.SphereGeometry(0.45, 32, 24),
      new MaterialClass({ color: 0xf5c542, ...extra }),
      { position: [-3 + index * 2, 0.45, 2.6] },
    );
  });

  let meshCount = 0;
  scene.traverse((object) => {
    if (object.isMesh) meshCount += 1;
  });

  // ------------------------------------------------------------------
  // OBJECT CONTROL — challenge
  // ------------------------------------------------------------------
  const controllable = [box, sphere, torusKnot, cone];
  let selectedIndex = 0;

  /** Marks the selected object with a faint emissive glow. */
  function highlightSelection() {
    controllable.forEach((mesh, index) => {
      mesh.material.emissive.setHex(index === selectedIndex ? SELECTED_EMISSIVE : 0x000000);
    });
  }

  highlightSelection();

  // ------------------------------------------------------------------
  // INPUT — state-based for held keys, event-based for one-shot actions
  // ------------------------------------------------------------------
  const keys = {};
  let paused = false;
  let elapsed = 0;

  /** Restores every object, camera, light and setting to its starting state. */
  function reset() {
    for (const mesh of controllable) {
      const { position, rotation, scale } = mesh.userData.initial;
      mesh.position.copy(position);
      mesh.rotation.copy(rotation);
      mesh.scale.copy(scale);
      mesh.userData.scaleFactor = 1;
    }

    selectedIndex = 0;
    highlightSelection();
    activeCamera = perspectiveCamera;
    paused = false;
    elapsed = 0;
    lightAnimated = true;
    lightAngle = LIGHT_START_ANGLE;
    placeLight();
    setShadowQuality(SHADOW_DEFAULT_INDEX);
  }

  const actions = {
    reset,
    toggleCamera() {
      activeCamera = activeCamera === perspectiveCamera ? orthographicCamera : perspectiveCamera;
    },
    toggleLightAnimation() {
      lightAnimated = !lightAnimated;
    },
    cycleShadowQuality() {
      setShadowQuality((shadowIndex + 1) % SHADOW_QUALITIES.length);
    },
    setShadowQuality,
    toggleAnimation() {
      paused = !paused;
    },
    selectNext() {
      selectedIndex = (selectedIndex + 1) % controllable.length;
      highlightSelection();
    },
    select(index) {
      if (!controllable[index]) return;
      selectedIndex = index;
      highlightSelection();
    },
  };

  /** Records held keys and fires one-shot actions. */
  function onKeyDown(event) {
    if (!isInputActive() || isFormElement(event.target)) return;

    // Arrows scroll and Space pages down by default — both would fight the scene.
    if (event.code.startsWith("Arrow") || event.code === "Space") event.preventDefault();

    keys[event.code] = true;

    if (event.repeat) return;

    if (event.code === "KeyC") actions.toggleCamera();
    if (event.code === "KeyL") actions.toggleLightAnimation();
    if (event.code === "KeyG") actions.cycleShadowQuality();
    if (event.code === "Space") actions.toggleAnimation();
    if (event.code === "KeyO") actions.selectNext();
    if (event.code === "KeyR") actions.reset();
  }

  /** Deliberately ungated, so a key released outside the canvas still clears. */
  function onKeyUp(event) {
    keys[event.code] = false;
  }

  /** Forgets every held key, e.g. when the window loses focus mid-press. */
  function releaseAllKeys() {
    for (const code of Object.keys(keys)) keys[code] = false;
  }

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", releaseAllKeys);

  // ------------------------------------------------------------------
  // UPDATE
  // ------------------------------------------------------------------

  /** Moves, rotates and scales the selected object while keys are held. */
  function updateObjectControl(dt) {
    if (!isInputActive()) return;

    const mesh = controllable[selectedIndex];

    if (keys.ArrowLeft) mesh.position.x -= MOVE_SPEED * dt;
    if (keys.ArrowRight) mesh.position.x += MOVE_SPEED * dt;
    if (keys.ArrowUp) mesh.position.z -= MOVE_SPEED * dt;
    if (keys.ArrowDown) mesh.position.z += MOVE_SPEED * dt;
    mesh.position.x = THREE.MathUtils.clamp(mesh.position.x, -MOVE_LIMIT, MOVE_LIMIT);
    mesh.position.z = THREE.MathUtils.clamp(mesh.position.z, -MOVE_LIMIT, MOVE_LIMIT);

    if (keys.KeyQ) mesh.rotation.y += ROTATE_SPEED * dt;
    if (keys.KeyE) mesh.rotation.y -= ROTATE_SPEED * dt;

    // Scale is stored as a factor on top of the initial scale, so the box keeps
    // its non-uniform proportions while growing or shrinking.
    let factor = mesh.userData.scaleFactor;
    if (keys.Equal) factor += SCALE_SPEED * dt;
    if (keys.Minus) factor -= SCALE_SPEED * dt;
    factor = THREE.MathUtils.clamp(factor, SCALE_LIMITS[0], SCALE_LIMITS[1]);
    mesh.userData.scaleFactor = factor;
    mesh.scale.copy(mesh.userData.initial.scale).multiplyScalar(factor);
  }

  /** Automatic animation; only runs while not paused. */
  function animateObjects(dt) {
    box.rotation.y += 0.6 * dt;
    torusKnot.rotation.x += 0.8 * dt;
    torusKnot.rotation.y += 0.5 * dt;
    cone.rotation.y += 0.9 * dt;
    // Absolute sine gives a bounce: the sphere touches the ground and rises again.
    sphere.position.y = sphere.userData.initial.position.y + Math.abs(Math.sin(elapsed * 2.2)) * 0.9;
  }

  // ------------------------------------------------------------------
  // RESIZE
  // ------------------------------------------------------------------

  /** Matches the drawing buffer and both cameras to the canvas's displayed size. */
  function resize(width, height) {
    if (width <= 0 || height <= 0) return;
    // `false`: the canvas's CSS size is left to the host page's stylesheet.
    renderer.setSize(width, height, false);
    aspect = width / height;
    updateCameras();
  }

  resize(canvas.clientWidth || 1, canvas.clientHeight || 1);

  // ------------------------------------------------------------------
  // HUD SNAPSHOT — challenge "Scene information"
  // ------------------------------------------------------------------

  /** Everything the HUD shows, as plain data the host page can render however it likes. */
  function buildInfo(fps) {
    const mesh = controllable[selectedIndex];
    const quality = SHADOW_QUALITIES[shadowIndex];
    const rotationDeg = THREE.MathUtils.euclideanModulo(THREE.MathUtils.radToDeg(mesh.rotation.y), 360);

    return {
      fps,
      meshCount,
      // renderer.info is reset after the shadow pass, so these count the main render only.
      drawCalls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      camera: activeCamera === perspectiveCamera ? "Perspective" : "Orthographic",
      shadowIndex,
      shadowLabel: quality.label,
      shadowMapSize: quality.size,
      lightAnimated,
      paused,
      selectedIndex,
      selectedName: mesh.name,
      selectedPosition: { x: mesh.position.x, y: mesh.position.y, z: mesh.position.z },
      selectedRotationDeg: rotationDeg,
      selectedScale: mesh.userData.scaleFactor,
      objectNames: controllable.map((item) => item.name),
    };
  }

  // ------------------------------------------------------------------
  // ANIMATION LOOP
  // ------------------------------------------------------------------
  const clock = new THREE.Clock();
  let rafId = 0;
  let infoAccum = 0;
  let framesSinceInfo = 0;

  /** One frame: read delta time, update, render, and report to the HUD. */
  function frame() {
    const rawDelta = clock.getDelta();
    const dt = Math.min(rawDelta, MAX_DELTA_SECONDS);

    updateObjectControl(dt);

    if (!paused) {
      elapsed += dt;
      animateObjects(dt);
    }

    if (lightAnimated) {
      lightAngle += LIGHT_ORBIT_SPEED * dt;
      placeLight();
    }

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

  /** Stops the loop and frees every GPU resource this scene created. */
  function dispose() {
    cancelAnimationFrame(rafId);

    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    window.removeEventListener("blur", releaseAllKeys);

    scene.traverse((object) => {
      if (object.isMesh) {
        object.geometry.dispose();
        object.material.dispose();
      }
    });

    sun.dispose(); // frees the shadow map
    renderer.dispose();
  }

  return { resize, actions, dispose };
}
