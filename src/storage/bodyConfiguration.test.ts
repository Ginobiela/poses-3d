import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { BODY_CONFIGURATION_KEY, loadBodyConfiguration, saveBodyConfiguration, validateBodyConfiguration, neutralBodyConfiguration } from './bodyConfiguration';

let data: Map<string, string>;
beforeEach(() => {
  data = new Map();
  vi.stubGlobal('localStorage', { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value) });
});
afterEach(() => vi.unstubAllGlobals());

it('sin datos restaura Neutral y devuelve configuraciones independientes', () => {
  const first = loadBodyConfiguration(); first.manual.height = .02;
  expect(loadBodyConfiguration()).toEqual(neutralBodyConfiguration());
});

it('guarda preset base y overrides incluidos valores cero y negativos', () => {
  const configuration = { version: 1 as const, preset: 'muscular' as const, manual: { muscle: 0, weight: -.3, height: .02, legs: -.2 } };
  expect(saveBodyConfiguration(configuration)).toBe(true);
  expect(loadBodyConfiguration()).toEqual(configuration);
  configuration.manual.weight = .5;
  expect(loadBodyConfiguration().manual.weight).toBe(-.3);
});

it('descarta JSON corrupto, versiones desconocidas y ajustes fuera de rango', () => {
  for (const saved of ['{', 'null', '[]', '{"version":2,"preset":"neutral","manual":{}}',
    '{"version":1,"preset":"unknown","manual":{}}', '{"version":1,"preset":"neutral","manual":{"height":0.5}}',
    '{"version":1,"preset":"neutral","manual":{"muscle":null}}', '{"version":1,"preset":"neutral","manual":{"inventado":0.2}}']) {
    data.set(BODY_CONFIGURATION_KEY, saved);
    expect(loadBodyConfiguration()).toEqual(neutralBodyConfiguration());
  }
});

it('rechaza datos inválidos antes de sobrescribir la configuración anterior', () => {
  saveBodyConfiguration({ version: 1, preset: 'lean', manual: {} });
  for (const value of [NaN, Infinity, -.1, 3]) {
    expect(() => saveBodyConfiguration({ version: 1, preset: 'neutral', manual: { muscle: value } })).toThrow();
    expect(loadBodyConfiguration().preset).toBe('lean');
  }
  expect(() => validateBodyConfiguration({ version: 1, preset: 'toString', manual: {} })).toThrow();
  expect(() => validateBodyConfiguration({ version: 1, preset: 'neutral', manual: [] })).toThrow();
});

it('una lectura o escritura bloqueada no impide usar el personaje', () => {
  vi.stubGlobal('localStorage', { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('quota'); } });
  expect(loadBodyConfiguration()).toEqual(neutralBodyConfiguration());
  expect(saveBodyConfiguration(neutralBodyConfiguration())).toBe(false);
});

it('guardar Neutral elimina overrides y mantiene otros datos de la aplicación', () => {
  data.set('poses.custom.v1', 'poses guardadas');
  saveBodyConfiguration({ version: 1, preset: 'athletic', manual: { hips: .3 } });
  saveBodyConfiguration(neutralBodyConfiguration());
  expect(loadBodyConfiguration()).toEqual(neutralBodyConfiguration());
  expect(data.get('poses.custom.v1')).toBe('poses guardadas');
});
