import { describe, expect, it } from 'vitest';
import { SessionEngine } from './engine';
import { expandPlan, gesturePlan } from './plans';

it('ejecuta bloques progresivos, vuelve a la pose anterior y finaliza', () => {
  const schedule = expandPlan(gesturePlan);
  expect(schedule).toHaveLength(20); expect(schedule.reduce((a, b) => a + b)).toBe(1_560_000);
  const session = new SessionEngine(30_000, 20, schedule);
  session.start(0); session.tick(3000);
  for (let i = 0; i < 10; i++) session.advance(3000, false);
  expect(session.durationMs).toBe(60_000);
  session.previous(3000); expect(session.index).toBe(9); expect(session.durationMs).toBe(30_000);
  session.pause(4000); session.tick(500000); expect(session.state).toBe('paused');
  session.finish(500000); expect(session.state).toBe('finished');
});

describe('sesión cronometrada', () => {
  it('conserva la duración completa cuando se pausa la cuenta inicial', () => {
    const session = new SessionEngine(30_000, 2);
    session.start(1_000);
    session.pause(2_000);
    expect(session.phase).toBe('countdown');
    expect(session.remainingMs).toBe(30_000);
    session.resume(20_000);
    session.tick(22_000);
    expect(session.state).toBe('running');
    expect(session.remainingMs).toBe(30_000);
    session.tick(27_000);
    expect(session.remainingMs).toBe(25_000);
  });

  it('descuenta únicamente el tiempo activo y registra las poses omitidas', () => {
    const session = new SessionEngine(10_000, 2);
    session.start(0);
    session.tick(3_000);
    session.pause(6_000);
    session.resume(50_000);
    session.advance(52_000, false);
    expect(session.skipped).toBe(1);
    expect(session.elapsedMs).toBe(5_000);
    expect(session.index).toBe(1);
    session.tick(62_000);
    expect(session.state).toBe('finished');
    expect(session.completed).toBe(1);
    expect(session.elapsedMs).toBe(15_000);
    session.advance(62_000, false);
    expect(session.skipped).toBe(1);
  });

  it('no avanza mientras está pausada', () => {
    const session = new SessionEngine(5_000, 1);
    session.start(0);
    session.tick(3_000);
    session.pause(4_000);
    session.tick(100_000);
    session.advance(100_000, false);
    expect(session.index).toBe(0);
    expect(session.remainingMs).toBe(4_000);
  });
});
