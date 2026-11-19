import { describe, expect, it } from 'vitest';
import { buildFromSource } from '../content/runtime';
import { playBot, type Strategy } from './bot';
import { DIFFICULTIES, TOTAL_DAYS, type DifficultyId } from './config';
import { Game } from './game';
import type { PaydayReport } from './types';

const content = buildFromSource();

/** Seeds per strategy and difficulty. The sign-off run uses `MONEY_SEEDS=12`. */
const SEEDS = Number(process.env.MONEY_SEEDS ?? 1);
const STRATEGIES: Strategy[] = ['smart', 'casual', 'random', 'idle', 'yolo'];

interface Audit {
  game: Game;
  paydays: PaydayReport[];
  /** how many times the books were compared with the cash box */
  checks: number;
}

/**
 * Plays one whole game and keeps a second set of books next to the game's own: every dollar the game announced,
 * every dollar of daily revenue, every payday total. After each step the cash box has to match the books to the cent.
 */
export function audit(strategy: Strategy, seed: number, difficulty: DifficultyId): Audit {
  const start = DIFFICULTIES.find((d) => d.id === difficulty)!.cash;
  let announced = 0;
  let paydayTotals = 0;
  let checks = 0;
  const paydays: PaydayReport[] = [];

  const realDrain = Game.prototype.drain;
  Game.prototype.drain = function (this: Game) {
    const out = realDrain.call(this);
    for (const n of out) if (n.t === 'cash') announced += n.amount;
    return out;
  };
  try {
    const r = playBot(content, seed, strategy, difficulty, (g) => {
      g.drain();
      for (const p of g.s.pending) {
        if (p.t !== 'payday' || paydays.includes(p.report)) continue;
        paydays.push(p.report);
        paydayTotals += p.report.total;
        expect(Math.round(g.s.company.cash), `payday ${paydays.length}, ${strategy} seed ${seed}: the report's cash after`).toBe(p.report.cashAfter);
      }
      const books = start + announced + g.s.company.totalRevenue + paydayTotals;
      checks += 1;
      if (Math.abs(g.s.company.cash - books) > 0.01) {
        throw new Error(`${strategy} seed ${seed} ${difficulty}, day ${g.s.day}: cash box ${g.s.company.cash} but the books say ${books}`);
      }
    });
    return { game: r.game, paydays, checks };
  } finally {
    Game.prototype.drain = realDrain;
  }
}

describe('the money', () => {
  const games: Audit[] = [];
  for (const difficulty of DIFFICULTIES.map((d) => d.id)) {
    for (const strategy of STRATEGIES) {
      for (let seed = 1; seed <= SEEDS; seed++) games.push(audit(strategy, seed, difficulty));
    }
  }

  it('adds up to the cent after every step of every game', () => {
    expect(games.length).toBe(DIFFICULTIES.length * STRATEGIES.length * SEEDS);
    for (const g of games) expect(g.checks).toBeGreaterThan(100);
    const steps = games.reduce((n, g) => n + g.checks, 0);
    const paydays = games.reduce((n, g) => n + g.paydays.length, 0);
    console.log(`money: ${games.length} whole games, ${steps} step checks, ${paydays} paydays, the books matched the cash box to the cent every time`);
  });

  it('has every payday report add up to its own lines, in whole dollars', () => {
    let paydays = 0;
    for (const g of games) {
      for (const report of g.paydays) {
        paydays += 1;
        expect(report.total).toBe(report.lines.reduce((n, l) => n + l.amount, 0));
        for (const l of report.lines) expect(Number.isInteger(l.amount), `${l.label} ${l.amount}`).toBe(true);
        expect(report.lines.some((l) => l.label === 'Rent' && l.amount < 0)).toBe(true);
        expect(Number.isFinite(report.cashAfter)).toBe(true);
      }
    }
    expect(paydays).toBeGreaterThan(300);
  });

  it('only pays out money to a company that is broke, and only the two rescues', () => {
    for (const g of games) {
      for (const report of g.paydays) {
        for (const l of report.lines) {
          if (l.amount > 0) expect(['Mom', 'Strangers on Reddit']).toContain(l.label);
        }
      }
    }
  });

  it('catches a dollar that leaves the cash box without a word', () => {
    const realTick = Game.prototype.tick;
    Game.prototype.tick = function (this: Game) {
      realTick.call(this);
      if (this.s.day === 5) this.s.company.cash -= 1;
    };
    try {
      expect(() => audit('smart', 1, 'normal')).toThrow(/cash box .* but the books say/);
    } finally {
      Game.prototype.tick = realTick;
    }
  });

  it('ends every game inside the three years, and a bankruptcy leaves the company in debt', () => {
    for (const g of games) {
      const end = g.game.s.ending;
      expect(end).not.toBeNull();
      expect(g.game.s.day).toBeLessThanOrEqual(TOTAL_DAYS + 1);
      if (end!.bankrupt) expect(g.game.s.company.cash).toBeLessThan(0);
    }
  });
});
