/**
 * Every sprite the game draws, grouped, so the preview tool and the game's
 * baker walk the same list.
 */
import type { Px, RoleColors } from './pixel';
import { TILE, carpetTile, desk, duck, laptop, mug, plant, wallTile, windowCity, woodTile } from './sprites/office';
import { Px as PxClass } from './pixel';
import { ACCESSORIES, HAIR, buildPerson, roleColorsFor, type Face, type Look, type Pose } from './sprites/people';

export interface CatalogItem {
  name: string;
  make: () => Px;
  roles?: RoleColors;
}

const LOOKS: Look[] = [
  { skin: 0, hair: 0, hairColor: 0, outfit: 0, accessory: 0 },
  { skin: 1, hair: 2, hairColor: 1, outfit: 1, accessory: 1 },
  { skin: 2, hair: 3, hairColor: 3, outfit: 2, accessory: 0 },
  { skin: 3, hair: 4, hairColor: 5, outfit: 5, accessory: 2 },
  { skin: 4, hair: 5, hairColor: 4, outfit: 6, accessory: 1 },
  { skin: 5, hair: 6, hairColor: 2, outfit: 3, accessory: 0 },
  { skin: 1, hair: 1, hairColor: 0, outfit: 4, accessory: 3 },
  { skin: 0, hair: 7, hairColor: 7, outfit: 7, accessory: 0 },
];

function person(name: string, look: Look, pose: Pose, face: Face): CatalogItem {
  return { name, make: () => buildPerson(look, pose, face), roles: roleColorsFor(look) };
}

const POSES: Pose[] = ['stand', 'walkA', 'walkB', 'typeA', 'typeB', 'think', 'cheer', 'slump'];
const FACES: Face[] = ['normal', 'happy', 'sad', 'panic', 'sleep', 'angry', 'smug', 'dead'];

function mockOffice(floor: 'carpet' | 'wood' = 'carpet'): Px {
  const W = 14 * TILE;
  const H = 48 + 7 * TILE;
  const c = new PxClass(W, H);
  const wall = wallTile();
  for (let x = 0; x < W; x += TILE) c.blit(wall, x, 0);
  for (let y = 0; y < 7; y++) {
    for (let x = 0; x < 14; x++) c.blit(floor === 'carpet' ? carpetTile((x + y * 3) % 3) : woodTile((x + y) % 3), x * TILE, 48 + y * TILE);
  }
  c.blit(windowCity(), 24, 6);
  c.blit(windowCity(), 168, 6);
  c.blit(plant(), 6, 34);
  const stickers = ['orange1', 'teal2', 'violet1', 'blue1'] as const;
  const rows = [60, 100];
  rows.forEach((dy, r) => {
    for (let i = 0; i < 4; i++) {
      const dx = 30 + i * 40;
      const look = LOOKS[(i + r * 4) % LOOKS.length]!;
      const py = dy - 20;
      c.blit(buildPerson(look, i % 2 ? 'typeA' : 'typeB', i === 2 ? 'happy' : 'normal').crop(0, 0, 16, 20), dx + 8, py);
      c.blit(desk(), dx, dy);
      c.blit(laptop(stickers[i]!), dx + 9, dy - 4);
      if (i === 0) c.blit(mug(), dx + 2, dy);
      if (i === 3) c.blit(duck(), dx + 22, dy - 2);
    }
  });
  return c;
}

export const CATALOG: Record<string, CatalogItem[]> = {
  mock: [{ name: 'office-carpet', make: () => mockOffice('carpet') }, { name: 'office-wood', make: () => mockOffice('wood') }],
  people: LOOKS.map((look, i) => person(`look${i}`, look, 'stand', 'normal')),
  poses: POSES.map((pose, i) => person(pose, LOOKS[i % LOOKS.length]!, pose, 'normal')),
  posesOne: POSES.map((pose) => person(pose, LOOKS[2]!, pose, 'normal')),
  faces: FACES.map((face, i) => person(face, LOOKS[i % LOOKS.length]!, 'stand', face)),
  hair: HAIR.map((h, i) => person(h.name, { ...LOOKS[0]!, hair: i, hairColor: i % 10 }, 'stand', 'normal')),
  acc: ACCESSORIES.map((a, i) => person(a.name, { ...LOOKS[1]!, accessory: i }, 'stand', 'normal')),
};
