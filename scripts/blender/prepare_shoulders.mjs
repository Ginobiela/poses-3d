import { readFile, writeFile, mkdir } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { sha } from '../anatomy-candidate.mjs';

const bytes = await readFile('dev/blender/shoulder-base.glb');
const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
const body = gltf.scene.getObjectByName('Body'), bones = new Map();
gltf.scene.traverse(o => { if (o.isBone) bones.set(o.userData.name ?? o.name, o); });
gltf.scene.updateMatrixWorld(true);
const rest = Object.fromEntries([...bones].map(([name, bone]) => [name, { position: bone.position.toArray(), quaternion: bone.quaternion.toArray(), world: bone.matrixWorld.toArray() }]));
const manifest = JSON.parse(await readFile('public/poses/manifest.json', 'utf8'));
const samples = [];
for (const entry of manifest.poses) {
  for (const [name, bone] of bones) { bone.position.fromArray(rest[name].position); bone.quaternion.fromArray(rest[name].quaternion); }
  const pose = JSON.parse(await readFile(`public/poses/${entry.file}`, 'utf8'));
  for (const [name, q] of Object.entries(pose.bones)) bones.get(name).quaternion.fromArray(q).normalize();
  for (const [name, p] of Object.entries(pose.positions ?? {})) bones.get(name).position.fromArray(p);
  gltf.scene.updateMatrixWorld(true); body.skeleton.update();
  const chest = bones.get('mixamorig:Spine2');
  const inverseChest = chest.getWorldQuaternion(new THREE.Quaternion()).invert();
  const shoulders = {};
  for (const side of ['Left', 'Right']) {
    const clavicle = bones.get(`mixamorig:${side}Shoulder`), arm = bones.get(`mixamorig:${side}Arm`), forearm = bones.get(`mixamorig:${side}ForeArm`);
    const direction = forearm.getWorldPosition(new THREE.Vector3()).sub(arm.getWorldPosition(new THREE.Vector3())).normalize().applyQuaternion(inverseChest);
    shoulders[side] = { direction: direction.toArray(), elevation: THREE.MathUtils.radToDeg(direction.angleTo(new THREE.Vector3(0, -1, 0))),
      clavicleDelta: THREE.MathUtils.radToDeg(clavicle.quaternion.angleTo(new THREE.Quaternion().fromArray(rest[`mixamorig:${side}Shoulder`].quaternion))),
      clavicleQuaternion: clavicle.quaternion.toArray(), armQuaternion: arm.quaternion.toArray() };
  }
  samples.push({ id: entry.id, name: entry.name, poseFile: entry.file, shoulders,
    world: Object.fromEntries([...bones].map(([name, bone]) => [name, bone.matrixWorld.toArray()])),
    posed: Array.from({ length: body.geometry.attributes.position.count }, (_, i) => body.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(body.matrixWorld).toArray()) });
}
await mkdir('dev/blender', { recursive: true });
await mkdir('docs/audit/shoulders', { recursive: true });
const point = new THREE.Vector3();
const data = { baseSHA256: sha(bytes), rest, samples,
  vertices: Array.from({ length: body.geometry.attributes.position.count }, (_, i) => point.fromBufferAttribute(body.geometry.attributes.position, i).applyMatrix4(body.matrixWorld).toArray()) };
await writeFile('dev/blender/shoulder-calibration.json', JSON.stringify(data));
await writeFile('docs/audit/shoulders/kinematics.json', JSON.stringify(samples.map(({ world, posed, ...sample }) => sample), null, 2));
console.log(samples.map(s => `${s.id} ${s.name}: L elevation=${s.shoulders.Left.elevation.toFixed(1)} clavicle=${s.shoulders.Left.clavicleDelta.toFixed(1)} dir=${s.shoulders.Left.direction.map(x => x.toFixed(2))}; R elevation=${s.shoulders.Right.elevation.toFixed(1)} clavicle=${s.shoulders.Right.clavicleDelta.toFixed(1)}`).join('\n'));
