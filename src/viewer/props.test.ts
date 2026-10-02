import { describe, expect, it } from 'vitest';
import { createProp, disposeProp, validateProps } from './props';

describe('pose props', () => {
  it('crea los cuatro tipos y valida transformaciones', () => {
    for (const type of ['chair', 'bench', 'box', 'platform'] as const) {
      const prop = createProp({ type });
      expect(prop.children.length).toBeGreaterThan(0);
      expect(prop.userData.propType).toBe(type);
      disposeProp(prop);
    }
    expect(validateProps(undefined)).toEqual([]);
    expect(() => validateProps([{ type: 'chair', scale: [0, 1, 1] }])).toThrow();
    expect(() => validateProps([{ type: 'alien' }])).toThrow();
  });
});
