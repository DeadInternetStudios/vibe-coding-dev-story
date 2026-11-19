/**
 * Office upgrades the player can buy. Each one is a joke and a small, real
 * bonus. Prices are in year 1 dollars.
 */
import type { StatKey } from '../content/types';
import type { GameState } from './types';

export interface ShopItem {
  id: string;
  name: string;
  blurb: string;
  price: number;
  /** minimum office tier */
  tier: number;
  /** art id for the icon and the sprite in the office */
  art: string;
  /** where it sits in the office */
  spot: 'wall' | 'floor' | 'desk' | 'corner';
  /** extra work speed, 0.04 means +4% */
  speed?: number;
  /** fewer bugs, 0.1 means -10% */
  bugs?: number;
  /** less spaghetti from new work */
  spaghetti?: number;
  /** pushes every mood target up this many points */
  mood?: number;
  /** extra gain on one stat, 0.08 means +8% */
  stat?: Partial<Record<StatKey, number>>;
  /** extra launch karma, 0.1 means +10% */
  karma?: number;
  unlock?: { year?: number; karma?: number };
  quip: string;
}

export const SHOP: readonly ShopItem[] = [
  { id: 'plant', name: 'Sad Office Plant', blurb: 'Photosynthesis is a vibe.', price: 120, tier: 0, art: 'plant', spot: 'floor', mood: 1, quip: 'It is already drooping. Relatable.' },
  { id: 'duck', name: 'Rubber Duck Army', blurb: 'They watch. They never judge.', price: 90, tier: 0, art: 'duck', spot: 'desk', stat: { stability: 0.04 }, quip: 'Everyone explains their bug to a duck now.' },
  { id: 'coffee', name: 'Espresso Machine', blurb: 'Turns beans into bugs, eventually.', price: 600, tier: 0, art: 'coffee', spot: 'floor', mood: 4, speed: 0.02, quip: 'The line is already seven people deep.' },
  { id: 'cooler', name: 'Water Cooler', blurb: 'Where rumors go to hydrate.', price: 350, tier: 0, art: 'cooler', spot: 'floor', mood: 2, quip: 'A rumor about layoffs began within the hour.' },
  { id: 'beanbag', name: 'Beanbag Chair', blurb: 'For thinking. Mostly napping.', price: 400, tier: 0, art: 'beanbag', spot: 'floor', mood: 3, quip: 'Nobody has gotten out of it since Tuesday.' },
  { id: 'monitor2', name: 'Second Monitor', blurb: 'For the second tab of Stack Overflow.', price: 900, tier: 0, art: 'monitor', spot: 'desk', speed: 0.04, quip: 'Now there are two places for the bug to hide.' },
  { id: 'keys', name: 'Mechanical Keyboards', blurb: 'Clack. Clack. Everybody hates it.', price: 1500, tier: 0, art: 'keyboard', spot: 'desk', mood: 2, speed: 0.02, quip: 'The clacking is the sound of productivity. Or rage.' },
  { id: 'whiteboard', name: 'Giant Whiteboard', blurb: 'Boxes. Arrows. A very confident circle.', price: 700, tier: 0, art: 'whiteboard', spot: 'wall', stat: { vibes: 0.08 }, quip: 'Three arrows. One box. A cloud labeled AI.' },
  { id: 'neon', name: "Neon 'SHIP IT' Sign", blurb: 'Gently pressures everyone, in pink.', price: 450, tier: 0, art: 'neon', spot: 'wall', stat: { vibes: 0.05 }, speed: 0.01, quip: 'It buzzes at night. So does the team.' },
  { id: 'fridge', name: 'Snack Fridge', blurb: 'Sparkling water and fear.', price: 500, tier: 0, art: 'fridge', spot: 'floor', mood: 3, quip: 'Somebody labeled the yogurt in all caps.' },
  { id: 'couch', name: 'Questionable Couch', blurb: 'Smells like crunch.', price: 800, tier: 0, art: 'couch', spot: 'floor', mood: 3, quip: 'Two people have lived on it. Both are on payroll.' },
  { id: 'standing', name: 'Standing Desks', blurb: 'Fall asleep upright.', price: 2400, tier: 0, art: 'standing', spot: 'desk', mood: 2, speed: 0.03, quip: 'Everyone stood for a day. Then the chairs came back.' },
  { id: 'yubikey', name: 'Hardware Security Keys', blurb: 'For the one key you cannot leak.', price: 1200, tier: 0, art: 'key', spot: 'desk', stat: { security: 0.12 }, unlock: { year: 1 }, quip: 'The key is on a lanyard. The lanyard is on a table. Hm.' },
  { id: 'rack', name: 'Server Rack', blurb: 'Hums like regret.', price: 5000, tier: 1, art: 'rack', spot: 'corner', stat: { stability: 0.08 }, bugs: 0.06, quip: 'It blinks green. Green means something. Probably.' },
  { id: 'arcade', name: 'Arcade Cabinet', blurb: 'For emotional debugging.', price: 3500, tier: 1, art: 'arcade', spot: 'floor', mood: 6, quip: 'High score belongs to the intern. Nobody knows how.' },
  { id: 'pingpong', name: 'Ping Pong Table', blurb: 'Nobody plays. Everyone posts about it.', price: 2200, tier: 1, art: 'pingpong', spot: 'floor', mood: 4, unlock: { karma: 200 }, quip: 'The photo got 40 likes. The table got 0 games.' },
  { id: 'trophy', name: 'Trophy Shelf', blurb: 'For the awards you gave yourselves.', price: 1000, tier: 0, art: 'trophy', spot: 'wall', karma: 0.1, quip: 'Participation, but golden.' },
  { id: 'chairs', name: 'Ergonomic Chairs', blurb: 'The back pain is now a premium feature.', price: 3000, tier: 1, art: 'chair', spot: 'desk', speed: 0.03, mood: 2, quip: 'They have levers. Nobody knows what for.' },
  { id: 'massage', name: 'Massage Chair', blurb: 'Productivity with a motor.', price: 6500, tier: 2, art: 'massage', spot: 'floor', mood: 8, unlock: { year: 2 }, quip: 'Bug count goes down. Snoring goes up.' },
  { id: 'barista', name: 'Barista Robot', blurb: 'Latte art. Zero emotions.', price: 9000, tier: 2, art: 'barista', spot: 'corner', mood: 6, speed: 0.03, unlock: { year: 2 }, quip: 'It draws a tiny cursor in the foam.' },
];

export function shopItem(id: string): ShopItem {
  const it = SHOP.find((i) => i.id === id);
  if (!it) throw new Error(`unknown shop item: ${id}`);
  return it;
}

function owned(s: GameState): ShopItem[] {
  return s.company.items.map(shopItem);
}

/** Multipliers from what the office owns. */
export function itemBonus(s: GameState, key: 'speed' | 'bugs' | 'spaghetti' | 'karma'): number {
  let sum = 0;
  for (const it of owned(s)) sum += it[key] ?? 0;
  if (key === 'speed' || key === 'karma') return 1 + sum;
  return Math.max(0.5, 1 - sum);
}

export function itemStat(s: GameState, stat: StatKey): number {
  let sum = 0;
  for (const it of owned(s)) sum += it.stat?.[stat] ?? 0;
  return 1 + sum;
}

/** Points added to every mood target. */
export function itemMood(s: GameState): number {
  return owned(s).reduce((n, it) => n + (it.mood ?? 0), 0);
}
