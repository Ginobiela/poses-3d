import { readFile, writeFile } from 'node:fs/promises';
import { exportCorrectives } from './export_correctives.mjs';
import * as THREE from 'three';

const calibration = JSON.parse(await readFile('dev/blender/shoulder-calibration.json', 'utf8'));
const data = JSON.parse(await readFile('dev/blender/shoulder-correctives.json', 'utf8'));
data.status = 'rejected-shoulder-experiment';
const neutral = calibration.samples.find(s => s.id === '01');
for (const item of data.correctives) {
  const side = item.name.endsWith('_L') ? 'Left' : 'Right';
  const reference = calibration.samples.find(s => s.id === item.id).shoulders[side];
  const rotations = [
    { bone: `mixamorig:${side}Arm`, quaternion: reference.armQuaternion },
    { bone: `mixamorig:${side}Shoulder`, quaternion: reference.clavicleQuaternion },
  ];
  const distance = sample => Math.max(...rotations.map((r, i) => THREE.MathUtils.radToDeg(new THREE.Quaternion().fromArray(r.quaternion).angleTo(
    new THREE.Quaternion().fromArray(i === 0 ? sample.armQuaternion : sample.clavicleQuaternion)))));
  const alternatives = [neutral.shoulders[side], ...data.correctives.filter(c => c.name.endsWith(item.name.slice(-2)) && c.id !== item.id)
    .map(c => calibration.samples.find(s => s.id === c.id).shoulders[side])];
  // Nonoverlapping pose neighborhoods, derived from authored references.
  const radius = Math.min(...alternatives.map(distance)) / 2;
  item.config = { id: item.name, joint: `${side}Shoulder`, morph: item.name, startAngle: 180 - radius, fullAngle: 180,
    curve: 'smootherstep', measurement: { type: 'rotation-match', rotations } };
}
const base = await readFile('dev/blender/shoulder-base.glb');
const bytes = await exportCorrectives(base, data);
const budget = [];
let previous = base.length;
for (let n = 1; n <= data.correctives.length; n++) {
  const partial = await exportCorrectives(base, { ...data, correctives: data.correctives.slice(0, n) });
  budget.push({ name: data.correctives[n - 1].name, glbAddedBytes: partial.length - previous,
    cpuAttributeBytes: 14517 * 3 * 4 * 2, gpuTextureBytesBeforePadding: 14517 * 4 * 4 * 2,
    region: 'SHOULDER', visualGate: 'REJECTED: angular axilla/shoulder remains; not enabled by default' });
  previous = partial.length;
}
await writeFile('docs/audit/shoulders/budget.json', JSON.stringify({ weightAssetBytes: base.length,
  totalBytes: bytes.length, addedGLBBytes: bytes.length - base.length, correctives: budget }, null, 2));
await writeFile('dev/models/human-shoulders.glb', bytes);
await writeFile('dev/models/shoulder-correctives.json', JSON.stringify(data, null, 2));
console.log('Shoulder experiment:', bytes.length, 'bytes;', bytes.length - base.length, 'added');
