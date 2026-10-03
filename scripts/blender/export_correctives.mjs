import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { sha, normals } from '../anatomy-candidate.mjs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export async function exportCorrectives(base, data) {
  if (sha(base) !== data.baseSHA256 || data.alignmentError > 1e-5) throw new Error('Corrective basis/vertex alignment mismatch.');
  const jsonLength = base.readUInt32LE(12);
  const json = JSON.parse(base.subarray(20, 20 + jsonLength).toString());
  const mesh = json.meshes.find(mesh => mesh.name === 'Body');
  const primitive = mesh.primitives[0];
  const vertexCount = json.accessors[primitive.attributes.POSITION].count;
  const gltf = await new GLTFLoader().parseAsync(base.buffer.slice(base.byteOffset, base.byteOffset + base.byteLength), '');
  const geometry = gltf.scene.getObjectByName('Body').geometry;
  const position = geometry.getAttribute('position'), normal = geometry.getAttribute('normal');
  const groups = new Map();
  for (let i = 0; i < vertexCount; i++) {
    const key = [position.getX(i), position.getY(i), position.getZ(i), normal.getX(i), normal.getY(i), normal.getZ(i)].map(value => Math.round(value * 1e5)).join(',');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(i);
  }
  const baselineNormals = normals(geometry, position, groups);
  let length = json.buffers[0].byteLength;
  const chunks = [base.subarray(28 + jsonLength, 28 + jsonLength + length)];
  const addView = array => {
    const pad = (4 - length % 4) % 4;
    if (pad) { chunks.push(Buffer.alloc(pad)); length += pad; }
    const bytes = Buffer.from(array.buffer);
    const view = json.bufferViews.length;
    json.bufferViews.push({ buffer: 0, byteOffset: length, byteLength: bytes.length });
    chunks.push(bytes); length += bytes.length;
    return view;
  };
  for (const corrective of data.correctives) {
    if (mesh.extras.targetNames.includes(corrective.name) || corrective.lbsAgreementError > 5e-5) throw new Error('Invalid corrective calibration.');
    const indices = [], values = [], min = [0, 0, 0], max = [0, 0, 0];
    for (const [index, ...xyz] of corrective.deltas) {
      if (!Number.isInteger(index) || index < 0 || index >= vertexCount || index <= (indices.at(-1) ?? -1) || xyz.length !== 3 || !xyz.every(Number.isFinite)) throw new Error('Invalid sparse corrective.');
      indices.push(index); values.push(...xyz);
      xyz.forEach((value, axis) => { min[axis] = Math.min(min[axis], value); max[axis] = Math.max(max[axis], value); });
    }
    if (!indices.length) throw new Error('Empty corrective.');
    const accessor = json.accessors.length;
    json.accessors.push({ componentType: 5126, count: vertexCount, type: 'VEC3', min, max,
      sparse: { count: indices.length, indices: { bufferView: addView(Uint16Array.from(indices)), componentType: 5123 }, values: { bufferView: addView(Float32Array.from(values)) } } });
    const shaped = new THREE.Float32BufferAttribute(Array.from({ length: vertexCount * 3 }, (_, i) => position.getComponent(Math.floor(i / 3), i % 3)), 3);
    for (const [index, x, y, z] of corrective.deltas) shaped.setXYZ(index, shaped.getX(index) + x, shaped.getY(index) + y, shaped.getZ(index) + z);
    const shapedNormals = normals(geometry, shaped, groups);
    const normalIndices = [], normalValues = [], normalMin = [0, 0, 0], normalMax = [0, 0, 0];
    for (let i = 0; i < vertexCount; i++) {
      const delta = [0, 1, 2].map(c => shapedNormals.getComponent(i, c) - baselineNormals.getComponent(i, c));
      if (delta.some(value => Math.abs(value) > 1e-6)) {
        normalIndices.push(i); normalValues.push(...delta);
        delta.forEach((value, c) => { normalMin[c] = Math.min(normalMin[c], value); normalMax[c] = Math.max(normalMax[c], value); });
      }
    }
    const normalAccessor = json.accessors.length;
    json.accessors.push({ componentType: 5126, count: vertexCount, type: 'VEC3', min: normalMin, max: normalMax,
      sparse: { count: normalIndices.length, indices: { bufferView: addView(Uint16Array.from(normalIndices)), componentType: 5123 }, values: { bufferView: addView(Float32Array.from(normalValues)) } } });
    primitive.targets.push({ POSITION: accessor, NORMAL: normalAccessor });
    mesh.extras.targetNames.push(corrective.name); mesh.weights.push(0);
  }
  json.asset.extras.anatomyCandidate.status = data.status ?? 'experimental-volume-correctives';
  json.asset.extras.anatomyCandidate.correctives = [...(json.asset.extras.anatomyCandidate.correctives ?? []),
    ...data.correctives.map(({ deltas, referencePositions, ...metadata }) => metadata)];
  json.buffers[0].byteLength = length;
  const text = Buffer.from(JSON.stringify(json));
  const jsonData = Buffer.concat([text, Buffer.alloc((4 - text.length % 4) % 4, 32)]);
  const binary = Buffer.concat(chunks); const binData = Buffer.concat([binary, Buffer.alloc((4 - binary.length % 4) % 4)]);
  const header = Buffer.alloc(12), jsonHeader = Buffer.alloc(8), binHeader = Buffer.alloc(8);
  header.writeUInt32LE(0x46546c67); header.writeUInt32LE(2, 4); header.writeUInt32LE(28 + jsonData.length + binData.length, 8);
  jsonHeader.writeUInt32LE(jsonData.length); jsonHeader.writeUInt32LE(0x4e4f534a, 4);
  binHeader.writeUInt32LE(binData.length); binHeader.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([header, jsonHeader, jsonData, binHeader, binData]);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const data = JSON.parse(await readFile('dev/blender/volume-correctives.json', 'utf8'));
  const bytes = await exportCorrectives(await readFile('dev/models/human-anatomy-v2.glb'), data);
  await writeFile('dev/models/human-anatomy-correctives.glb', bytes);
  await writeFile('dev/models/volume-correctives.json', JSON.stringify(data, null, 2));
  console.log('Corrective GLB', bytes.length, sha(bytes));
}
