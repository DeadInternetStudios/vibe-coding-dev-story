import { SKILL_KEYS, type SkillKey, type StaffArchetype } from '../content/types';
import type { Content } from './content';
import { SALARY_SCALE, YEAR_MULT } from './config';
import { clamp, lerp, yearOf } from './format';
import { personName } from './names';
import type { Rng } from './rng';
import type { Candidate, Look, Staff } from './types';

export function randomLook(rng: Rng, a: StaffArchetype): Look {
  const pick = (xs: readonly number[], fallback: number) => (xs.length ? rng.pick(xs) : fallback);
  return {
    skin: rng.int(0, 5),
    hair: pick(a.look.hair, rng.int(0, 7)),
    hairColor: rng.int(0, 9),
    outfit: pick(a.look.outfit, rng.int(0, 11)),
    accessory: pick(a.look.accessory, 0),
  };
}

/** How good a hire is: 0 to 1, shaped by luck, and pushed up by later years and bigger offices. */
export function talent(rng: Rng, year: number, officeTier: number): number {
  const t = rng.next() * 0.75 + 0.1 + (year - 1) * 0.08 + officeTier * 0.04;
  return clamp(t, 0.05, 1);
}

export function rollSkills(rng: Rng, a: StaffArchetype, t: number, year: number): Record<SkillKey, number> {
  const out = {} as Record<SkillKey, number>;
  const yearBonus = (year - 1) * 5;
  for (const k of SKILL_KEYS) {
    const [lo, hi] = a.skills[k];
    const base = lerp(lo, hi, clamp(t + rng.bell() * 0.2, 0, 1));
    out[k] = clamp(Math.round(base + yearBonus * (hi / 20)), 1, 99);
  }
  return out;
}

export function salaryFor(a: StaffArchetype, t: number, year: number): number {
  const [lo, hi] = a.salary;
  const raw = lerp(lo, hi, t) * (1 + 0.3 * (year - 1)) * SALARY_SCALE;
  return Math.round(raw / 50) * 50;
}

function pickTraits(rng: Rng, a: StaffArchetype, content: Content, count: number): string[] {
  const pool = a.traits.length ? a.traits : content.traits.map((t) => t.id);
  const out: string[] = [];
  for (let i = 0; i < count && pool.length; i++) {
    const t = rng.pick(pool);
    if (!out.includes(t)) out.push(t);
  }
  return out;
}

export function nextId(counter: { nextId: number }, prefix: string): string {
  return `${prefix}${counter.nextId++}`;
}

export function makeCandidate(rng: Rng, content: Content, counter: { nextId: number }, archetypeId: string, year: number, officeTier: number): Candidate {
  const a = content.archetype(archetypeId);
  const t = talent(rng, year, officeTier);
  const salary = salaryFor(a, t, year);
  return {
    id: nextId(counter, 'c'),
    name: personName(rng, content, a.names),
    archetype: a.id,
    look: randomLook(rng, a),
    skills: rollSkills(rng, a, t, year),
    traits: pickTraits(rng, a, content, rng.chance(0.55) ? 2 : 1),
    salary,
    fee: Math.round((salary * 0.6) / 50) * 50,
  };
}

export function staffFromCandidate(c: Candidate, day: number): Staff {
  return {
    id: c.id.replace(/^c/, 's'),
    name: c.name,
    archetype: c.archetype,
    look: c.look,
    skills: { ...c.skills },
    level: 1,
    xp: 0,
    mood: 72,
    salary: c.salary,
    traits: c.traits.slice(),
    hiredOn: day,
    assign: 'build',
    awayUntil: 0,
    grumpyDays: 0,
  };
}

export function xpNeeded(level: number): number {
  return 40 + 28 * level;
}

/** Sum of a skill plus its trait bonuses. */
export function skillOf(content: Content, s: Staff, k: SkillKey): number {
  let v = s.skills[k];
  for (const id of s.traits) v += content.trait(id).mods.skills?.[k] ?? 0;
  return clamp(v, 1, 99);
}

export function traitMult(content: Content, s: Staff, key: 'speed' | 'bugs' | 'xp'): number {
  let m = 1;
  for (const id of s.traits) m *= content.trait(id).mods[key] ?? 1;
  return m;
}

export function traitMood(content: Content, s: Staff): number {
  let m = 0;
  for (const id of s.traits) m += content.trait(id).mods.mood ?? 0;
  return m;
}

/** Gives xp. Returns true when the person levels up. */
export function gainXp(s: Staff, amount: number, rng: Rng): boolean {
  s.xp += amount;
  let leveled = false;
  while (s.xp >= xpNeeded(s.level) && s.level < 12) {
    s.xp -= xpNeeded(s.level);
    s.level += 1;
    leveled = true;
    const ranked = SKILL_KEYS.slice().sort((a, b) => s.skills[b] - s.skills[a]);
    for (const k of SKILL_KEYS) s.skills[k] = clamp(s.skills[k] + 1, 1, 99);
    s.skills[ranked[0]!] = clamp(s.skills[ranked[0]!] + 2, 1, 99);
    const second = ranked[rng.int(1, 2)]!;
    s.skills[second] = clamp(s.skills[second] + 1, 1, 99);
    s.mood = clamp(s.mood + 10, 0, 100);
    s.salary = Math.round((s.salary * 1.05) / 50) * 50;
  }
  return leveled;
}

export function totalPayroll(staff: readonly Staff[]): number {
  return staff.reduce((n, s) => n + (s.isFounder ? 0 : s.salary), 0);
}

export function hireYearMult(day: number): number {
  return YEAR_MULT[Math.min(2, yearOf(day) - 1)]!;
}
