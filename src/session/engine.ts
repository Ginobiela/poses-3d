export type SessionState = 'setup' | 'countdown' | 'running' | 'paused' | 'finished';

export class SessionEngine {
  state: SessionState = 'setup';
  index = 0;
  remainingMs: number;
  completed = 0;
  skipped = 0;
  elapsedMs = 0;
  countdownRemaining = 3000;
  private deadline = 0;
  private pausedPhase: 'countdown' | 'running' = 'running';

  private readonly durations: number[];
  constructor(durationMs: number, readonly count: number, schedule?: number[]) {
    if (!validDuration(durationMs) || !Number.isInteger(count) || count < 1 || count > 100 || (schedule && (schedule.length !== count || !schedule.every(validDuration)))) {
      throw new Error('Configuración de sesión inválida');
    }
    this.remainingMs = durationMs;
    this.durations = schedule ?? Array(count).fill(durationMs);
    this.remainingMs = this.durationMs;
  }
  get durationMs() { return this.durations[Math.min(this.index, this.count - 1)]!; }
  previous(now: number) {
    if ((this.state !== 'running' && this.state !== 'paused') || this.index === 0) return;
    if (this.state === 'running') this.remainingMs = Math.max(0, this.deadline - now);
    this.elapsedMs += this.durationMs - this.remainingMs;
    this.index--;
    this.remainingMs = this.durationMs;
    this.deadline = now + this.remainingMs;
  }
  finish(now: number) {
    if (this.state === 'running') this.remainingMs = Math.max(0, this.deadline - now);
    if (this.phase === 'running' && this.state !== 'finished') this.elapsedMs += this.durationMs - this.remainingMs;
    this.state = 'finished'; this.remainingMs = 0;
  }

  start(now: number) {
    if (this.state !== 'setup') return;
    this.state = 'countdown';
    this.deadline = now + this.countdownRemaining;
  }

  tick(now: number) {
    if (this.state === 'countdown') {
      this.countdownRemaining = Math.max(0, this.deadline - now);
      if (this.countdownRemaining === 0) {
        this.state = 'running';
        this.deadline = now + this.remainingMs;
      }
    }
    if (this.state === 'running') {
      this.remainingMs = Math.max(0, this.deadline - now);
      if (this.remainingMs === 0) this.advance(now, true);
    }
  }

  pause(now: number) {
    if (this.state !== 'running' && this.state !== 'countdown') return;
    this.pausedPhase = this.state;
    if (this.state === 'countdown') this.countdownRemaining = Math.max(0, this.deadline - now);
    else this.remainingMs = Math.max(0, this.deadline - now);
    this.state = 'paused';
  }

  resume(now: number) {
    if (this.state !== 'paused') return;
    this.state = this.pausedPhase;
    this.deadline = now + (this.state === 'countdown' ? this.countdownRemaining : this.remainingMs);
  }

  advance(now: number, completed: boolean) {
    if (this.state !== 'running') return;
    this.remainingMs = Math.max(0, this.deadline - now);
    this.elapsedMs += this.durationMs - this.remainingMs;
    if (completed) this.completed += 1;
    else this.skipped += 1;
    this.index += 1;
    if (this.index >= this.count) {
      this.state = 'finished';
      this.remainingMs = 0;
      return;
    }
    this.remainingMs = this.durationMs;
    this.deadline = now + this.durationMs;
  }

  get phase(): 'countdown' | 'running' {
    return this.state === 'paused' ? this.pausedPhase : this.state === 'countdown' ? 'countdown' : 'running';
  }
}

export function formatTime(ms: number) {
  const seconds = Math.ceil(Math.max(0, ms) / 1000);
  return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
}

export function validDuration(n: number) {
  return Number.isFinite(n) && n >= 5_000 && n <= 1_800_000;
}
