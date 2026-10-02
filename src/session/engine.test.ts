import { describe, expect, it } from 'vitest';
import { SessionEngine } from './engine';

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
