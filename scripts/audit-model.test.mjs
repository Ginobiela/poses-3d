import { expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { auditModel, renderAudit } from './audit-model.mjs';

it('audita el GLB real y mantiene el informe sincronizado con el asset', async () => {
  const audit = await auditModel();
  expect(audit.sha256).toBe('6627588660aa6c754aaa2edb181bc01a8ca60c3b4c534efa3e87f636ce5cda18');
  expect(audit.meshCount).toBe(4); expect(audit.skinnedMeshCount).toBe(4);
  expect(audit.vertices).toBe(15066); expect(audit.triangles).toBe(27676);
  expect(audit.skins[0].bones).toHaveLength(52);
  expect(new Set(audit.skins[0].bones.map(bone => bone.name)).size).toBe(52);
  expect(audit.skins[0].bones.every(bone => bone.name.startsWith('mixamorig:'))).toBe(true);
  expect(audit.meshes.map(mesh => mesh.morphs.length)).toEqual([306, 30, 32, 27]);
  expect(audit.uniqueMorphs).toBe(306); expect(audit.morphSlots).toBe(395);
  for (const mesh of audit.meshes) {
    expect(mesh.boneCount).toBe(52);
    expect(mesh.relativeMorphs).toBe(true);
    expect(mesh.primitives[0].morphSemantics).toEqual(['POSITION']);
    expect(mesh.morphs.every(morph => morph.defaultWeight === 0 && morph.affectedVertices >= 0 && Number.isFinite(morph.maxDisplacement))).toBe(true);
    expect(mesh.minWeightSum).toBeCloseTo(1, 5); expect(mesh.maxWeightSum).toBeCloseTo(1, 5);
  }
  expect(audit.textures).toBe(0); expect(audit.images).toBe(0);
  expect(audit.meshes[0].morphs.every(morph => morph.affectedVertices > 0)).toBe(true);
  expect(audit.meshes.flatMap(mesh => mesh.morphs.filter(morph => morph.affectedVertices === 0).map(morph => `${mesh.name}/${morph.name}`))).toEqual([
    'Eyes/eyeBagsLeft', 'Eyes/jawBonesSofter', 'Eyes/headAged', 'Eyes/headYouthful',
    'Teeth/jawBonesSofter', 'Tongue/jawBonesSofter', 'Tongue/headAged',
  ]);
  expect(audit.materials.some(material => material.normalMap)).toBe(false);
  expect(audit.meshes[0].morphs.find(morph => morph.name === 'bodyMuscular').affectedVertices).toBeGreaterThan(0);
  expect(audit.meshes.filter(mesh => mesh.morphs.some(morph => morph.name === 'heightTaller')).map(mesh => mesh.name)).toEqual(['Body', 'Eyes', 'Teeth', 'Tongue']);
  expect(await readFile('docs/MODEL_AUDIT.md', 'utf8')).toBe(renderAudit(audit));
});
