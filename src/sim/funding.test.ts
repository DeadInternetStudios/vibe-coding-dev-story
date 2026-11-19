import { describe, expect, it } from 'vitest';
import { buildFromSource } from '../content/runtime';
import { DILUTION } from './config';
import { Game } from './game';

const content = buildFromSource();
const newGame = () => Game.create(content, { seed: 5, company: 'Test Labs', founderName: 'Tess', origin: 'bootcamp', difficulty: 'normal' });

function askForMoney(game: Game, year: number): void {
  game.s.pending.unshift({ t: 'funding', year, valuation: 1_000_000, target: 600_000, passed: true });
}

const pct = (share: number) => `${Math.round(share * 100)}%`;

describe('outside money', () => {
  it('names the share it takes in the offer, from the same numbers the ending uses', () => {
    const g = newGame();
    askForMoney(g, 2);
    const offers = g.fundingChoices();
    expect(offers.find((o) => o.id === 'vc')!.blurb).toContain(pct(DILUTION.vc));
    expect(offers.find((o) => o.id === 'angel')!.blurb).toContain(pct(DILUTION.angel));
  });

  it('tells the founder what is still theirs after each round', () => {
    const g = newGame();
    askForMoney(g, 2);
    expect(g.takeFunding('vc')).toContain(`You keep ${pct(1 - DILUTION.vc)}`);
    askForMoney(g, 3);
    expect(g.takeFunding('angel')).toContain(`You keep ${pct(1 - DILUTION.vc - DILUTION.angel)}`);
  });

  it('takes exactly that share out of the ending score', () => {
    const g = newGame();
    const whole = g.scoreNow();
    g.s.flags.push('vc1');
    expect(g.scoreNow() / whole).toBeCloseTo(1 - DILUTION.vc, 3);
    g.s.flags.push('angel2');
    expect(g.scoreNow() / whole).toBeCloseTo(1 - DILUTION.vc - DILUTION.angel, 3);
  });
});
