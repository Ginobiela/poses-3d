import { describe, expect, it } from 'vitest';
import { filterPoses, poses, shuffledCycle } from './poses';

describe('catálogo', () => {
  it('contiene veinte poses con identificadores distintos y categorías utilizables', () => {
    expect(poses).toHaveLength(20);
    expect(new Set(poses.map(p => p.id)).size).toBe(20);
    for (const category of ['De pie', 'Sentada', 'Agachada', 'En movimiento']) {
      expect(filterPoses(category).length).toBeGreaterThan(0);
    }
  });

  it('recorre cada pose una vez antes de repetir y evita la última anterior', () => {
    const items = ['a', 'b', 'c'];
    const cycle = shuffledCycle(items, () => 0.5, 'a');
    expect(new Set(cycle).size).toBe(items.length);
    expect(cycle[0]).not.toBe('a');
  });
});
