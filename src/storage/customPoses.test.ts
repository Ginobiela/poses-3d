import { expect, it, vi } from 'vitest';
import { saveCustomPose, loadCustomPoses, deleteCustomPose } from './customPoses';
it('guarda, renombra, recarga y elimina poses locales sin alterar el origen', () => {
  const data = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => data.set(k, v) });
  const pose = { id: 'custom-1', name: 'Mi pose', category: 'custom', date: '2026-10-03', hipsPosition: [0, 1, 0] as [number, number, number], bones: { 'mixamorig:Hips': [0, 0, 0, 1] as [number, number, number, number] } };
  saveCustomPose(pose); saveCustomPose({ ...pose, name: 'Renombrada' });
  expect(loadCustomPoses()).toHaveLength(1); expect(loadCustomPoses()[0]!.name).toBe('Renombrada'); expect(pose.name).toBe('Mi pose');
  expect(() => saveCustomPose({ ...pose, bones: { 'mixamorig:Hips': [0, 0, 0, 0] } })).toThrow();
  deleteCustomPose(pose.id); expect(loadCustomPoses()).toEqual([]); vi.unstubAllGlobals();
});
