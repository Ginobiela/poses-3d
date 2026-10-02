import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { filterPoses, loadPoseCatalog, poses, shuffledCycle } from './poses';

beforeAll(async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ poses: [
    { id: '01', name: 'De pie 01', category: 'standing', type: 'static', file: 'standing/standing_01.json' },
    { id: '04', name: 'Guardia 01', category: 'action', type: 'static', file: 'action/fight_01.json' },
    { id: '07', name: 'Carrera 01', category: 'dynamic', type: 'static', file: 'dynamic/run_01.json' },
  ] }) }));
  await loadPoseCatalog();
});
afterAll(() => vi.unstubAllGlobals());

describe('catálogo', () => {
  it('solo ofrece las poses riggeadas del manifiesto', () => {
    expect(poses.map(pose => pose.name)).toEqual(['De pie 01', 'Guardia 01', 'Carrera 01']);
    expect(filterPoses('De pie')).toHaveLength(1);
    expect(filterPoses('En movimiento')).toHaveLength(2);
    expect(filterPoses('Sentada')).toHaveLength(0);
  });

  it('recorre cada pose una vez y evita la última anterior', () => {
    const cycle = shuffledCycle(poses, () => 0.5, poses[0]);
    expect(new Set(cycle.map(pose => pose.id)).size).toBe(3);
    expect(cycle[0]).not.toBe(poses[0]);
  });
});
