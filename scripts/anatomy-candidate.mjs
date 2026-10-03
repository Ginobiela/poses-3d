import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Authored MakeHuman/MPFB2 deltas already present in the licensed source asset.
// No coordinate-based sculpt, generated muscle, changed bone or guessed skin weight.
export const RECIPE = Object.freeze({
  armsMuscular: .45, thighsMuscular: .45, calvesMuscular: .3,
  chestPectorals: .4, bellyToned: .6, torsoLatsWider: .2, gluteusBigger: .15,
});
export const SOURCE_SHA = '6627588660aa6c754aaa2edb181bc01a8ca60c3b4c534efa3e87f636ce5cda18';
export const sha = bytes => createHash('sha256').update(bytes).digest('hex');

export function normals(geometry, position, groups) {
  const copy = new THREE.BufferGeometry();
  copy.setIndex(geometry.index); copy.setAttribute('position', position);
  copy.computeVertexNormals();
  const attribute = copy.getAttribute('normal');
  // UV splits must not introduce new seams. Preserve original hard-edge groups.
  for (const vertices of groups.values()) {
    const sum = new THREE.Vector3();
    for (const vertex of vertices) sum.add(new THREE.Vector3().fromBufferAttribute(attribute, vertex));
    sum.normalize();
    for (const vertex of vertices) attribute.setXYZ(vertex, sum.x, sum.y, sum.z);
  }
  return attribute;
}

export async function buildCandidate(bytes) {
  if (sha(bytes) !== SOURCE_SHA) throw new Error('Source GLB hash changed; review the recipe before rebuilding.');
  const jsonLength = bytes.readUInt32LE(12);
  const json = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString());
  const binStart = 20 + jsonLength + 8;
  const parts = [bytes.subarray(binStart, binStart + json.buffers[0].byteLength)];
  let offset = parts[0].length;
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  const body = gltf.scene.getObjectByName('Body');
  if (!body?.isSkinnedMesh) throw new Error('Missing skinned Body.');
  const mesh = json.meshes.find(item => item.name === 'Body');
  const primitive = mesh.primitives[0];
  const geometry = body.geometry;
  const initial = geometry.getAttribute('position');
  const candidate = new THREE.Float32BufferAttribute(
    Array.from({ length: initial.count * 3 }, (_, i) => initial.getComponent(Math.floor(i / 3), i % 3)), 3);
  for (const [name, weight] of Object.entries(RECIPE)) {
    const index = body.morphTargetDictionary[name];
    if (index === undefined) throw new Error(`Missing authored morph: ${name}`);
    const delta = geometry.morphAttributes.position[index];
    for (let vertex = 0; vertex < initial.count; vertex++) {
      candidate.setXYZ(vertex, candidate.getX(vertex) + weight * delta.getX(vertex),
        candidate.getY(vertex) + weight * delta.getY(vertex), candidate.getZ(vertex) + weight * delta.getZ(vertex));
    }
  }
  const groups = new Map(); const originalNormals = geometry.getAttribute('normal');
  for (let vertex = 0; vertex < initial.count; vertex++) {
    const key = [initial.getX(vertex), initial.getY(vertex), initial.getZ(vertex),
      originalNormals.getX(vertex), originalNormals.getY(vertex), originalNormals.getZ(vertex)]
      .map(value => Math.round(value * 1e5)).join(',');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(vertex);
  }
  const append = attribute => {
    const padding = (4 - offset % 4) % 4;
    if (padding) { parts.push(Buffer.alloc(padding)); offset += padding; }
    const array = Float32Array.from(attribute.array);
    if (!array.every(Number.isFinite)) throw new Error('Non-finite candidate attribute.');
    const data = Buffer.from(array.buffer);
    const view = json.bufferViews.length;
    json.bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: data.length, target: 34962 });
    parts.push(data); offset += data.length;
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < array.length; i++) { min[i % 3] = Math.min(min[i % 3], array[i]); max[i % 3] = Math.max(max[i % 3], array[i]); }
    const accessor = json.accessors.length;
    json.accessors.push({ bufferView: view, componentType: 5126, count: attribute.count, type: 'VEC3', min, max });
    return accessor;
  };
  const appendSparse = attribute => {
    const vertices = [], values = [];
    const min = [0, 0, 0], max = [0, 0, 0];
    for (let i = 0; i < attribute.count; i++) {
      const xyz = [attribute.getX(i), attribute.getY(i), attribute.getZ(i)];
      if (!xyz.every(Number.isFinite)) throw new Error('Non-finite morph.');
      if (xyz.some(value => value !== 0)) { vertices.push(i); values.push(...xyz); }
      for (let c = 0; c < 3; c++) { min[c] = Math.min(min[c], xyz[c]); max[c] = Math.max(max[c], xyz[c]); }
    }
    const addView = data => {
      const padding = (4 - offset % 4) % 4;
      if (padding) { parts.push(Buffer.alloc(padding)); offset += padding; }
      const view = json.bufferViews.length;
      json.bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: data.length });
      parts.push(data); offset += data.length; return view;
    };
    const indices = addView(Buffer.from(Uint16Array.from(vertices).buffer));
    const sparseValues = addView(Buffer.from(Float32Array.from(values).buffer));
    const accessor = json.accessors.length;
    json.accessors.push({ componentType: 5126, count: attribute.count, type: 'VEC3', min, max,
      sparse: { count: vertices.length, indices: { bufferView: indices, componentType: 5123 }, values: { bufferView: sparseValues } } });
    return accessor;
  };
  primitive.attributes.POSITION = append(candidate);
  primitive.attributes.NORMAL = append(normals(geometry, candidate, groups));
  // Rebase selected sliders: influence 1 reaches the original authored endpoint
  // in the context of the other baked traits, rather than applying it twice.
  for (const [name, weight] of Object.entries(RECIPE)) {
    const index = body.morphTargetDictionary[name];
    const delta = geometry.morphAttributes.position[index].clone();
    for (let i = 0; i < delta.array.length; i++) delta.array[i] *= 1 - weight;
    primitive.targets[index].POSITION = appendSparse(delta);
  }
  json.asset.extras = { ...json.asset.extras, anatomyCandidate: { sourceSHA256: SOURCE_SHA, recipe: RECIPE,
    status: 'experimental-base-only', correctives: [], skinWeightsChanged: false } };
  json.buffers[0].byteLength = offset;
  const jsonData = Buffer.from(JSON.stringify(json));
  const paddedJSON = Buffer.concat([jsonData, Buffer.alloc((4 - jsonData.length % 4) % 4, 32)]);
  const binary = Buffer.concat(parts);
  const paddedBIN = Buffer.concat([binary, Buffer.alloc((4 - binary.length % 4) % 4)]);
  const header = Buffer.alloc(12), jsonHeader = Buffer.alloc(8), binHeader = Buffer.alloc(8);
  header.writeUInt32LE(0x46546c67); header.writeUInt32LE(2, 4); header.writeUInt32LE(28 + paddedJSON.length + paddedBIN.length, 8);
  jsonHeader.writeUInt32LE(paddedJSON.length); jsonHeader.writeUInt32LE(0x4e4f534a, 4);
  binHeader.writeUInt32LE(paddedBIN.length); binHeader.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([header, jsonHeader, paddedJSON, binHeader, paddedBIN]);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const source = await readFile('public/models/human/human.glb');
  const candidate = await buildCandidate(source);
  await mkdir('dev/models', { recursive: true });
  await writeFile('dev/models/human-current.glb', source);
  await writeFile('dev/models/human-anatomy-v2.glb', candidate);
  console.log(JSON.stringify({ source: sha(source), candidate: sha(candidate), bytes: candidate.length, recipe: RECIPE }, null, 2));
}
