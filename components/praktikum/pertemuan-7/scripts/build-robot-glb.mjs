// Generates public/praktikum-7/robot.glb — the GLB asset Pertemuan 7 loads.
//
// The module leaves the GLB up to the student, and asks for one that has a
// hierarchy, materials and at least one animation clip. Rather than pull an
// asset of unknown licence from the internet, the model is authored here with
// Three.js itself and exported with GLTFExporter, so its source is plain code
// that can be read, changed and re-run from the repo root:
//
//   npm run build:model:p7

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as THREE from "three";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";

// GLTFExporter turns its Blob into an ArrayBuffer through FileReader, which
// Node does not have. Blob.arrayBuffer() does the same job.
globalThis.FileReader ??= class FileReader {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((buffer) => {
      this.result = buffer;
      this.onloadend?.();
    });
  }
};

const here = dirname(fileURLToPath(import.meta.url));
const OUTPUT = resolve(here, "../../../../public/praktikum-7/robot.glb");

// ---------------------------------------------------------------------------
// MATERIALS — PBR (MeshStandardMaterial exports as glTF metallic-roughness)
// ---------------------------------------------------------------------------
const shell = new THREE.MeshStandardMaterial({ name: "Shell", color: 0x3b82f6, roughness: 0.35, metalness: 0.6 });
const joint = new THREE.MeshStandardMaterial({ name: "Joint", color: 0x1e293b, roughness: 0.55, metalness: 0.8 });
const visor = new THREE.MeshStandardMaterial({
  name: "Visor",
  color: 0x0f172a,
  emissive: 0x22d3ee,
  emissiveIntensity: 1.4,
  roughness: 0.15,
  metalness: 0.2,
});
const accent = new THREE.MeshStandardMaterial({ name: "Accent", color: 0xf59e0b, roughness: 0.4, metalness: 0.3 });

function mesh(name, geometry, material, position = [0, 0, 0]) {
  const object = new THREE.Mesh(geometry, material);
  object.name = name;
  object.position.set(...position);
  return object;
}

function group(name, position = [0, 0, 0]) {
  const object = new THREE.Group();
  object.name = name;
  object.position.set(...position);
  return object;
}

// ---------------------------------------------------------------------------
// HIERARCHY
//
// Robot
// └── Hips
//     ├── Torso
//     │   ├── Head ── HeadMesh, Visor, Antenna ── AntennaTip
//     │   ├── ShoulderL ── ArmL ── HandL
//     │   └── ShoulderR ── ArmR ── HandR
//     ├── LegL ── LegMeshL ── FootL
//     └── LegR ── LegMeshR ── FootR
//
// Joints (Shoulder, Leg, Head) are empty Groups placed at the pivot, with the
// mesh hanging off them — rotating the joint swings the limb from the
// shoulder/hip instead of spinning it about its own middle.
// ---------------------------------------------------------------------------
const robot = group("Robot");

const hips = group("Hips", [0, 0.95, 0]);
robot.add(hips);

const torso = mesh("Torso", new THREE.BoxGeometry(0.7, 0.8, 0.42), shell, [0, 0.45, 0]);
hips.add(torso);
torso.add(mesh("ChestLight", new THREE.CylinderGeometry(0.09, 0.09, 0.04, 24), accent, [0, 0.1, 0.22]));
torso.children.at(-1).rotation.x = Math.PI / 2;

const head = group("Head", [0, 0.42, 0]);
torso.add(head);
head.add(mesh("HeadMesh", new THREE.BoxGeometry(0.46, 0.38, 0.4), shell, [0, 0.22, 0]));
head.add(mesh("Visor", new THREE.BoxGeometry(0.36, 0.12, 0.05), visor, [0, 0.25, 0.2]));
const antenna = mesh("Antenna", new THREE.CylinderGeometry(0.02, 0.02, 0.22, 12), joint, [0, 0.52, 0]);
head.add(antenna);
antenna.add(mesh("AntennaTip", new THREE.SphereGeometry(0.05, 16, 12), visor, [0, 0.13, 0]));

for (const [side, x] of [["L", -0.45], ["R", 0.45]]) {
  const shoulder = group(`Shoulder${side}`, [x, 0.3, 0]);
  torso.add(shoulder);
  shoulder.add(mesh(`ShoulderBall${side}`, new THREE.SphereGeometry(0.1, 20, 14), joint));
  const arm = mesh(`Arm${side}`, new THREE.BoxGeometry(0.16, 0.55, 0.16), shell, [0, -0.32, 0]);
  shoulder.add(arm);
  arm.add(mesh(`Hand${side}`, new THREE.SphereGeometry(0.1, 20, 14), accent, [0, -0.32, 0]));
}

for (const [side, x] of [["L", -0.18], ["R", 0.18]]) {
  const leg = group(`Leg${side}`, [x, 0.02, 0]);
  hips.add(leg);
  const legMesh = mesh(`LegMesh${side}`, new THREE.BoxGeometry(0.2, 0.7, 0.22), joint, [0, -0.4, 0]);
  leg.add(legMesh);
  legMesh.add(mesh(`Foot${side}`, new THREE.BoxGeometry(0.24, 0.1, 0.34), accent, [0, -0.38, 0.05]));
}

// ---------------------------------------------------------------------------
// ANIMATION CLIPS
// ---------------------------------------------------------------------------
const euler = new THREE.Euler();
const quaternion = new THREE.Quaternion();

/** Rotation keyframes from Euler angles (radians), stored as quaternions like glTF expects. */
function rotationTrack(nodeName, times, angles) {
  const values = angles.flatMap(([x, y, z]) => quaternion.setFromEuler(euler.set(x, y, z)).toArray());
  return new THREE.QuaternionKeyframeTrack(`${nodeName}.quaternion`, times, values);
}

function positionTrack(nodeName, times, positions) {
  return new THREE.VectorKeyframeTrack(`${nodeName}.position`, times, positions.flat());
}

const idle = new THREE.AnimationClip("Idle", 2, [
  positionTrack("Hips", [0, 1, 2], [[0, 0.95, 0], [0, 0.99, 0], [0, 0.95, 0]]),
  rotationTrack("Head", [0, 0.5, 1, 1.5, 2], [[0, 0, 0], [0, 0.3, 0], [0, 0, 0], [0, -0.3, 0], [0, 0, 0]]),
  rotationTrack("ShoulderL", [0, 1, 2], [[0, 0, -0.08], [0, 0, -0.16], [0, 0, -0.08]]),
  rotationTrack("ShoulderR", [0, 1, 2], [[0, 0, 0.08], [0, 0, 0.16], [0, 0, 0.08]]),
]);

const walk = new THREE.AnimationClip("Walk", 1, [
  positionTrack("Hips", [0, 0.25, 0.5, 0.75, 1], [[0, 0.95, 0], [0, 1.0, 0], [0, 0.95, 0], [0, 1.0, 0], [0, 0.95, 0]]),
  rotationTrack("LegL", [0, 0.5, 1], [[0.55, 0, 0], [-0.55, 0, 0], [0.55, 0, 0]]),
  rotationTrack("LegR", [0, 0.5, 1], [[-0.55, 0, 0], [0.55, 0, 0], [-0.55, 0, 0]]),
  rotationTrack("ShoulderL", [0, 0.5, 1], [[-0.5, 0, -0.08], [0.5, 0, -0.08], [-0.5, 0, -0.08]]),
  rotationTrack("ShoulderR", [0, 0.5, 1], [[0.5, 0, 0.08], [-0.5, 0, 0.08], [0.5, 0, 0.08]]),
]);

// Played once when the robot is clicked (Challenge B). The right arm (on +X)
// hangs along -Y; rotating its shoulder about +Z swings it out and up.
const wave = new THREE.AnimationClip("Wave", 1.6, [
  rotationTrack("ShoulderR", [0, 0.3, 0.55, 0.8, 1.05, 1.3, 1.6], [
    [0, 0, 0.08], [0, 0, 2.6], [0, 0, 2.15], [0, 0, 2.75], [0, 0, 2.15], [0, 0, 2.6], [0, 0, 0.08],
  ]),
  rotationTrack("Head", [0, 0.4, 1.2, 1.6], [[0, 0, 0], [0, 0.2, -0.18], [0, 0.2, -0.18], [0, 0, 0]]),
]);

// ---------------------------------------------------------------------------
// EXPORT
// ---------------------------------------------------------------------------
const glb = await new GLTFExporter().parseAsync(robot, { binary: true, animations: [idle, walk, wave] });

await mkdir(dirname(OUTPUT), { recursive: true });
await writeFile(OUTPUT, Buffer.from(glb));
console.log(`wrote ${OUTPUT} (${glb.byteLength} bytes)`);
