import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { smoothShoulderWeights } from './blender/shoulder_weights.mjs';

const source = await readFile('dev/models/human-anatomy-correctives.glb');
const { bytes, report } = await smoothShoulderWeights(source, 10, true);
await mkdir('docs/audit/arms-up-preview', { recursive: true });
await writeFile('dev/models/human-arms-up-weights.glb', bytes);
await writeFile('docs/audit/arms-up-preview/weights.json', JSON.stringify(report, null, 2));
console.log(report);
