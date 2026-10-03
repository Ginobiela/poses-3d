import { readFile, writeFile } from 'node:fs/promises';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { sha } from '../anatomy-candidate.mjs';

export async function smoothShoulderWeights(bytes, passes = 3, correctNeck = false) {
  if (!Number.isInteger(passes) || passes < 1 || passes > 10) throw new Error('Weight diffusion requires 1–10 integer passes.');
  const jsonLength = bytes.readUInt32LE(12), json = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString());
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  const body = gltf.scene.getObjectByName('Body'), g = body.geometry, p = g.attributes.position;
  const names = body.skeleton.bones.map(b => b.userData.name ?? b.name);
  const weights = [], vertices = new Map(), keys = [];
  for (let i = 0; i < p.count; i++) {
    const key = [p.getX(i), p.getY(i), p.getZ(i)].map(v => Math.round(v * 1e6)).join(',');
    if (!vertices.has(key)) vertices.set(key, []);
    vertices.get(key).push(i); keys.push(key);
    const w = new Map();
    for (let c = 0; c < 4; c++) if (g.attributes.skinWeight.getComponent(i, c) > 1e-8) w.set(g.attributes.skinIndex.getComponent(i, c), g.attributes.skinWeight.getComponent(i, c));
    weights.push(w);
  }
  const adjacency = new Map([...vertices.keys()].map(k => [k, new Set()]));
  const faces = g.index.array;
  for (let i = 0; i < faces.length; i += 3) for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) {
    if (a !== b && keys[faces[i + a]] !== keys[faces[i + b]]) adjacency.get(keys[faces[i + a]]).add(keys[faces[i + b]]);
  }
  const changed = new Set();
  let reassignedNeckVertices = 0;
  if (correctNeck) {
    const neck = names.indexOf('mixamorig:Neck');
    for (const side of ['Left', 'Right']) {
      const arm = names.indexOf(`mixamorig:${side}Arm`), clavicle = names.indexOf(`mixamorig:${side}Shoulder`);
      for (let i = 0; i < weights.length; i++) {
        const w = weights[i];
        if (w.has(arm) && w.has(clavicle) && w.has(neck)) {
          w.set(clavicle, w.get(clavicle) + w.get(neck)); w.delete(neck); reassignedNeckVertices++; changed.add(i);
        }
      }
    }
  }
  for (const side of ['Left', 'Right']) {
    const allowed = new Set([`mixamorig:${side}Arm`, `mixamorig:${side}Shoulder`, 'mixamorig:Spine2'].map(n => names.indexOf(n)));
    if (allowed.has(-1)) throw new Error('Shoulder rig missing');
    const arm = names.indexOf(`mixamorig:${side}Arm`);
    const compatible = key => [...weights[vertices.get(key)[0]].keys()].every(n => allowed.has(n));
    const seeds = [...vertices.keys()].filter(k => compatible(k) && weights[vertices.get(k)[0]].size > 1 && weights[vertices.get(k)[0]].has(arm));
    const patch = new Set(seeds);
    // One ring of adjacent vertices avoids introducing a hard support boundary.
    for (const key of seeds) for (const neighbor of adjacency.get(key)) if (compatible(neighbor)) patch.add(neighbor);
    for (let pass = 0; pass < passes; pass++) {
      const updates = new Map();
      for (const key of patch) {
        const neighbors = [...adjacency.get(key)].filter(compatible);
        if (!neighbors.length) continue;
        const current = weights[vertices.get(key)[0]], next = new Map();
        for (const index of allowed) {
          const average = neighbors.reduce((sum, k) => sum + (weights[vertices.get(k)[0]].get(index) ?? 0), 0) / neighbors.length;
          next.set(index, .5 * ((current.get(index) ?? 0) + average));
        }
        updates.set(key, next);
      }
      for (const [key, next] of updates) for (const vertex of vertices.get(key)) { weights[vertex] = new Map(next); changed.add(vertex); }
    }
  }
  const indices = new Uint16Array(p.count * 4), values = new Float32Array(p.count * 4);
  let maxWeightDelta = 0;
  for (let i = 0; i < p.count; i++) {
    if (!changed.has(i)) {
      for (let c = 0; c < 4; c++) { indices[i * 4 + c] = g.attributes.skinIndex.getComponent(i, c); values[i * 4 + c] = g.attributes.skinWeight.getComponent(i, c); }
      continue;
    }
    const sorted = [...weights[i]].filter(([, w]) => w > 1e-8).sort((a, b) => b[1] - a[1]);
    const sum = sorted.reduce((s, [, w]) => s + w, 0);
    if (sorted.length > 4 || !Number.isFinite(sum) || sum <= 0) throw new Error('Invalid weight smoothing');
    for (let c = 0; c < sorted.length; c++) {
      const [index, w] = sorted[c]; indices[i * 4 + c] = index; values[i * 4 + c] = w / sum;
      let previous = 0;
      for (let j = 0; j < 4; j++) if (g.attributes.skinIndex.getComponent(i, j) === index) previous += g.attributes.skinWeight.getComponent(i, j);
      maxWeightDelta = Math.max(maxWeightDelta, Math.abs(previous - w / sum));
    }
  }
  let length = json.buffers[0].byteLength;
  const chunks = [bytes.subarray(28 + jsonLength, 28 + jsonLength + length)];
  const append = (array, componentType) => {
    const pad = (4 - length % 4) % 4;
    if (pad) { chunks.push(Buffer.alloc(pad)); length += pad; }
    const view = json.bufferViews.length, accessor = json.accessors.length;
    json.bufferViews.push({ buffer: 0, byteOffset: length, byteLength: array.byteLength });
    chunks.push(Buffer.from(array.buffer)); length += array.byteLength;
    json.accessors.push({ bufferView: view, componentType, count: p.count, type: 'VEC4' });
    return accessor;
  };
  const primitive = json.meshes.find(m => m.name === 'Body').primitives[0];
  if (correctNeck) {
    chunks[0] = Buffer.from(chunks[0]);
    for (const [name, array, componentType] of [['JOINTS_0', indices, 5123], ['WEIGHTS_0', values, 5126]]) {
      const accessor = json.accessors[primitive.attributes[name]], view = json.bufferViews[accessor.bufferView];
      if (accessor.componentType !== componentType || accessor.sparse || accessor.normalized || accessor.type !== 'VEC4') throw new Error('Unsupported shoulder weight layout.');
      const rowBytes = array.BYTES_PER_ELEMENT * 4, stride = view.byteStride ?? rowBytes;
      const packed = Buffer.from(array.buffer);
      for (const vertex of changed) packed.copy(chunks[0], (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0) + vertex * stride, vertex * rowBytes, (vertex + 1) * rowBytes);
    }
  } else {
    primitive.attributes.JOINTS_0 = append(indices, 5123);
    primitive.attributes.WEIGHTS_0 = append(values, 5126);
  }
  const report = { sourceSHA256: sha(bytes), passes, factor: .5, method: correctNeck ? 'shoulder neck reassignment and seam-aware topology diffusion' : 'seam-aware topology weight diffusion', vertices: changed.size, maxWeightDelta, skinWeightsChanged: true,
    ...(correctNeck ? { reassignedNeckVertices } : {}) };
  json.asset.extras.anatomyCandidate.shoulderWeights = report;
  json.asset.extras.anatomyCandidate.skinWeightsChanged = true;
  json.buffers[0].byteLength = length;
  const j = Buffer.from(JSON.stringify(json)), binary = Buffer.concat(chunks);
  const jp = Buffer.concat([j, Buffer.alloc((4 - j.length % 4) % 4, 32)]), bp = Buffer.concat([binary, Buffer.alloc((4 - binary.length % 4) % 4)]);
  const h = Buffer.alloc(12), jh = Buffer.alloc(8), bh = Buffer.alloc(8);
  h.writeUInt32LE(0x46546c67); h.writeUInt32LE(2, 4); h.writeUInt32LE(28 + jp.length + bp.length, 8);
  jh.writeUInt32LE(jp.length); jh.writeUInt32LE(0x4e4f534a, 4); bh.writeUInt32LE(bp.length); bh.writeUInt32LE(0x004e4942, 4);
  return { bytes: Buffer.concat([h, jh, jp, bh, bp]), report };
}
if (process.argv[1]?.endsWith('shoulder_weights.mjs')) {
  const result = await smoothShoulderWeights(await readFile('dev/models/human-anatomy-correctives.glb'), Number(process.argv[2] ?? 3));
  await writeFile('dev/blender/shoulder-base.glb', result.bytes);
  await writeFile('docs/audit/shoulders/weights.json', JSON.stringify(result.report, null, 2));
  console.log(result.report);
}
