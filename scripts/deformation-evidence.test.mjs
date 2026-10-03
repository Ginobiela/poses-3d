import { it, expect } from 'vitest';
import { readFile, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';

it('la auditoría cubre el catálogo y sus evidencias corresponden al GLB actual', async () => {
  const manifest = JSON.parse(await readFile('public/poses/manifest.json', 'utf8'));
  const metrics = JSON.parse(await readFile('docs/audit/deformation/metrics.json', 'utf8'));
  const report = await readFile('docs/DEFORMATION_AUDIT.md', 'utf8');
  const model = await readFile('public/models/human/human.glb');
  expect(metrics.modelSha256).toBe(createHash('sha256').update(model).digest('hex'));
  expect(metrics.entries).toEqual(manifest.poses.map(({ id, name, file }) => ({ id, name, file })));
  expect(metrics.modelRequests).toBe(1); expect(metrics.poseRequests).toBe(20); expect(metrics.errors).toEqual([]);
  expect(metrics.samples).toHaveLength(80);
  for (const entry of manifest.poses) {
    const source = await readFile(`public/poses/${entry.file}`);
    expect(metrics.poseSha256[entry.id]).toBe(createHash('sha256').update(source).digest('hex'));
    expect(report).toContain(`| ${entry.id} | ${entry.name} |`);
    const records = metrics.samples.filter(sample => sample.id === entry.id);
    expect(records.map(record => record.preset)).toEqual(['neutral', 'lean', 'athletic', 'muscular']);
    for (const record of records) {
      expect(record.finite && record.validBones).toBe(true);
      expect(record.vertices).toBe(15066); expect(record.bones).toBe(52);
      for (const angle of [...record.elbows, ...record.knees]) expect(Number.isFinite(angle) && angle >= 0 && angle <= 180).toBe(true);
    }
  }
  for (const [, relative] of report.matchAll(/\]\((audit\/deformation\/[^)]+)\)/g)) await access(`docs/${relative}`);
});
