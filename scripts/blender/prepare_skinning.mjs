import { readFile, writeFile, mkdir } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { buildCandidate, sha } from '../anatomy-candidate.mjs';

const baseline = await buildCandidate(await readFile('public/models/human/human.glb'));
await mkdir('dev/blender', { recursive: true });
await writeFile('dev/blender/base.glb', baseline);
const gltf = await new GLTFLoader().parseAsync(baseline.buffer.slice(baseline.byteOffset, baseline.byteOffset + baseline.byteLength), '');
const body = gltf.scene.getObjectByName('Body');
const bones = new Map();
gltf.scene.traverse(object => { if (object.isBone) bones.set(object.userData.name ?? object.name, object); });
gltf.scene.updateMatrixWorld(true);
const rest = Object.fromEntries([...bones].map(([name, bone]) => [name, { position: bone.position.toArray(), quaternion: bone.quaternion.toArray(), world: bone.matrixWorld.toArray() }]));
const manifest = JSON.parse(await readFile('public/poses/manifest.json', 'utf8'));
const specifications = [
  { name: 'elbowFlex_L', id: '13', pair: ['LeftArm', 'LeftForeArm'], end: 'LeftHand', startAngle: 20 },
  { name: 'elbowFlex_R', id: '20', pair: ['RightArm', 'RightForeArm'], end: 'RightHand', startAngle: 20 },
  { name: 'kneeFlex_L', id: '08', pair: ['LeftUpLeg', 'LeftLeg'], end: 'LeftFoot', startAngle: 25 },
  { name: 'kneeFlex_R', id: '06', pair: ['RightUpLeg', 'RightLeg'], end: 'RightFoot', startAngle: 25 },
];
const calibration = [];
for (const spec of specifications) {
  for (const [name, bone] of bones) { bone.position.fromArray(rest[name].position); bone.quaternion.fromArray(rest[name].quaternion); }
  const entry = manifest.poses.find(pose => pose.id === spec.id);
  const pose = JSON.parse(await readFile(`public/poses/${entry.file}`, 'utf8'));
  for (const [name, values] of Object.entries(pose.bones)) bones.get(name).quaternion.fromArray(values).normalize();
  for (const [name, values] of Object.entries(pose.positions ?? {})) bones.get(name).position.fromArray(values);
  gltf.scene.updateMatrixWorld(true); body.skeleton.update();
  const point = new THREE.Vector3();
  const posed = Array.from({ length: body.geometry.attributes.position.count }, (_, i) => body.getVertexPosition(i, point).applyMatrix4(body.matrixWorld).toArray());
  const world = name => bones.get(`mixamorig:${name}`).getWorldPosition(new THREE.Vector3());
  const joint = world(spec.pair[1]);
  const fullAngle = 180 - THREE.MathUtils.radToDeg(world(spec.pair[0]).sub(joint).angleTo(world(spec.end).sub(joint)));
  calibration.push({ ...spec, fullAngle, poseFile: entry.file,
    world: Object.fromEntries([...bones].map(([name, bone]) => [name, bone.matrixWorld.toArray()])), posed });
}
const point = new THREE.Vector3();
await writeFile('dev/blender/calibration.json', JSON.stringify({ baseSHA256: sha(baseline), rest,
  vertices: Array.from({ length: body.geometry.attributes.position.count }, (_, i) => point.fromBufferAttribute(body.geometry.attributes.position, i).applyMatrix4(body.matrixWorld).toArray()), calibration }));
console.log('Prepared four existing-pose calibrations; no generated pose angles.');
