/**
 * Staff paper dolls. A person is built from layers, each drawn with role
 * colors so one drawing can be baked in any skin, hair and outfit.
 *
 * The canvas is 16 wide and 24 tall. Layers are drawn WITHOUT an outline and
 * the final pass adds one dark pixel ring around the whole silhouette, so
 * the content lives inside x 1..14, y 1..22.
 *
 *   y 0       outline
 *   y 1       spikes and buns
 *   y 2..12   hair and head (head is 10 x 10 at x 3, y 3)
 *   y 13..18  torso and arms
 *   y 19..22  stubby legs and shoes
 *   y 23      outline
 */
import { Px, px, type RoleColors } from '../pixel';
import { CLOTH_RAMPS, HAIR_RAMPS, PALETTE, SKIN_RAMPS } from '../palette';

export const PERSON_W = 16;
export const PERSON_H = 24;
const HEAD_X = 3;
const HEAD_Y = 3;
const BODY_Y = 13;

/* -------------------------------------------------------------------- heads */

/** Bare head, 10 x 10. */
const HEAD = px([
  '..ssssss..',
  '.lssssssss',
  'lsssssssss',
  'ssssssssss',
  'ssssssssss',
  'ssssssssss',
  'ssssssssss',
  'sssssssssS',
  '.SssssssSS',
  '..SSSSSS..',
]);

export type Face = 'normal' | 'happy' | 'sad' | 'panic' | 'sleep' | 'angry' | 'smug' | 'dead';

const FACE_LEGEND = { n: 'pink', c: 'blue2' } as const;

/** Face overlays, 10 x 10. Eyes sit on rows 4 and 5 at columns 2 and 7. */
const FACES: Record<Face, Px> = {
  normal: px([
    '..........',
    '..........',
    '..........',
    '..........',
    '..K....K..',
    '..K....K..',
    '.n......n.',
    '....KK....',
    '..........',
    '..........',
  ], FACE_LEGEND),
  happy: px([
    '..........',
    '..........',
    '..........',
    '..K....K..',
    '.K.K..K.K.',
    '..........',
    '.n......n.',
    '...K..K...',
    '....KK....',
    '..........',
  ], FACE_LEGEND),
  sad: px([
    '..........',
    '..........',
    '..........',
    '..........',
    '..K....K..',
    '..K....K..',
    '.nc....cn.',
    '....KK....',
    '...K..K...',
    '..........',
  ], FACE_LEGEND),
  panic: px([
    '..........',
    '..........',
    '..........',
    '.www..www.',
    '.wKw..wKw.',
    '.www..www.',
    '.n......n.',
    '....KK....',
    '....KK....',
    '..........',
  ], FACE_LEGEND),
  sleep: px([
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '.KK....KK.',
    '.n......n.',
    '....KK....',
    '..........',
    '..........',
  ], FACE_LEGEND),
  angry: px([
    '..........',
    '..........',
    '.K......K.',
    '..KK..KK..',
    '..K....K..',
    '..K....K..',
    '.n......n.',
    '...KKKK...',
    '..........',
    '..........',
  ], FACE_LEGEND),
  smug: px([
    '..........',
    '..........',
    '..........',
    '..KK..KK..',
    '..KK..KK..',
    '..........',
    '.n......n.',
    '....KKK...',
    '.....K....',
    '..........',
  ], FACE_LEGEND),
  dead: px([
    '..........',
    '..........',
    '..........',
    '.K.K..K.K.',
    '..K....K..',
    '.K.K..K.K.',
    '.n......n.',
    '...KKKK...',
    '..........',
    '..........',
  ], FACE_LEGEND),
};

/* --------------------------------------------------------------------- hair */

export interface HairStyle {
  name: string;
  /** drawn over the head, top left at (x, y) */
  front: Px;
  x: number;
  y: number;
  /** drawn behind the head and body */
  back?: Px;
  backX?: number;
  backY?: number;
}

const HL = { h: 'hair', H: 'hairD', j: 'hairL' } as const;

export const HAIR: HairStyle[] = [
  {
    name: 'short',
    x: 2,
    y: 2,
    front: px([
      '..hhhhhhhh..',
      '.hhjjhhhhhh.',
      'hhjjhhhhhhhH',
      'hhjhhhhhhhhH',
      'hhh..hh..hhH',
      'hh........hH',
      'hH........Hh',
    ], HL),
  },
  {
    name: 'side',
    x: 2,
    y: 2,
    front: px([
      '..hhhhhhhh..',
      '.hhjjjhhhhh.',
      'hhjjhhhhhhhH',
      'hhhhhhhhhhhH',
      'hhhhhh.hhhhH',
      'hh....h...hH',
      'hH........Hh',
    ], HL),
  },
  {
    name: 'long',
    x: 2,
    y: 2,
    front: px([
      '..hhhhhhhh..',
      '.hhjjhhhhhh.',
      'hhjjhhhhhhhH',
      'hhjhhhhhhhhH',
      'hhh..hh..hhH',
      'hh........hH',
      'hH........Hh',
      'hH........Hh',
      'hH........Hh',
    ], HL),
    back: px([
      '..HHHHHHHH..',
      '.hhhhhhhhhh.',
      'hhhhhhhhhhhh',
      'hhhhhhhhhhhh',
      'hhhhhhhhhhhh',
      'hhhhhhhhhhhh',
      '.hhhhhhhhhh.',
    ], HL),
    backX: 2,
    backY: 8,
  },
  {
    name: 'bun',
    x: 2,
    y: 1,
    front: px([
      '....hhhh....',
      '...hHjjHh...',
      '..hhhhhhhh..',
      '.hhjjhhhhhh.',
      'hhjjhhhhhhhH',
      'hhjhhhhhhhhH',
      'hhh..hh..hhH',
      'hh........hH',
      'hH........Hh',
    ], HL),
  },
  {
    name: 'spiky',
    x: 2,
    y: 1,
    front: px([
      '.h..h..h..h.',
      '.hh.hh.hh.hh',
      '.hhhhjhhhhhh',
      'hhjjhhhhhhhH',
      'hhjhhhhhhhhH',
      'hhhhhhhhhhhH',
      'hhhHh..hHhhH',
      'hh........hH',
      'hH........Hh',
    ], HL),
  },
  {
    name: 'curly',
    x: 1,
    y: 1,
    front: px([
      '...hhhhhhhh...',
      '.hhhjjhhhhhhh.',
      'hhhjjhhhhhhhhH',
      'hhjhhhhhhhhhhH',
      'hhhhhhhhhhhhhH',
      'hhhhhhhhhhhhhH',
      'hhhHh....hHhhH',
      'hhH........Hhh',
      'hH..........Hh',
      '.H..........H.',
    ], HL),
  },
  {
    name: 'beanie',
    x: 2,
    y: 1,
    front: px([
      '....AAAA....',
      '..AAaaaaAA..',
      '.AaaeeaaaaA.',
      'AaaeeaaaaaaA',
      'AAAAAAAAAAAA',
      'AaAaAaAaAaAa',
      'hhh......hhh',
      'hh........hH',
      'hH........Hh',
    ], { ...HL, a: 'acc', A: 'accD', e: 'accL' }),
  },
  {
    name: 'bald',
    x: 6,
    y: 3,
    front: px(['jj'], { j: 'skinL' }),
  },
];

/* ----------------------------------------------------------------- accessories */

export interface Accessory {
  name: string;
  px: Px;
  x: number;
  y: number;
  /** moves with the head when it bobs */
  onHead: boolean;
}

const ACC_LEGEND = { m: 'steel1', M: 'steel0', f: 'ink0', r: 'berry1' } as const;

export const ACCESSORIES: Accessory[] = [
  { name: 'none', px: px(['.']), x: 0, y: 0, onHead: false },
  {
    name: 'glasses',
    x: 3,
    y: 6,
    onHead: true,
    px: px([
      '.fff..fff.',
      '.f.ffff.f.',
      '.fff..fff.',
    ], ACC_LEGEND),
  },
  {
    name: 'headphones',
    x: 1,
    y: 2,
    onHead: true,
    px: px([
      '....mmmmmm....',
      '..mm......mm..',
      '.mm........mm.',
      '.m..........m.',
      '.m..........m.',
      'mM..........Mm',
      'mM..........Mm',
      'mM..........Mm',
      '.m..........m.',
    ], ACC_LEGEND),
  },
  {
    name: 'lanyard',
    x: 5,
    y: 13,
    onHead: false,
    px: px([
      'r....r',
      '.r..r.',
      '..rr..',
      '..ww..',
    ], { ...ACC_LEGEND, w: 'white' }),
  },
];

/* ------------------------------------------------------------------- bodies */

export type Pose = 'stand' | 'walkA' | 'walkB' | 'typeA' | 'typeB' | 'think' | 'cheer' | 'slump';

/** Torso, arms, legs, 10 rows from the shoulders to the soles. */
const BODIES: Record<Pose, Px> = {
  stand: px([
    '....yttttttT....',
    '...tyttttttTt...',
    '..ttTttttttTtt..',
    '..ttTttttttTtt..',
    '..ssTttttttTss..',
    '..sSTttttttTSs..',
    '....pppppppp....',
    '....pppPPppp....',
    '...oooo..oooo...',
    '...oooo..oooo...',
  ]),
  walkA: px([
    '....yttttttT....',
    '...tyttttttTt...',
    '..ttTttttttTtt..',
    '..ssTttttttTtt..',
    '..sSTttttttTss..',
    '...pTttttttTsS..',
    '....pppppppp....',
    '....pppPPppp....',
    '...ooo...oooo...',
    '.........oooo...',
  ]),
  walkB: px([
    '....yttttttT....',
    '...tyttttttTt...',
    '..ttTttttttTtt..',
    '..ttTttttttTss..',
    '..ssTttttttTSs..',
    '..SsTttttttTp...',
    '....pppppppp....',
    '....pppPPppp....',
    '...oooo...ooo...',
    '...oooo.........',
  ]),
  typeA: px([
    '....yttttttT....',
    '...tyttttttTt...',
    '..ttTttttttTtt..',
    '..tssTttttTsst..',
    '...ssTttttTss...',
    '....tttttttt....',
    '....pppppppp....',
    '....pppPPppp....',
    '................',
    '................',
  ]),
  typeB: px([
    '....yttttttT....',
    '...tyttttttTt...',
    '..ttTttttttTtt..',
    '..ttsTttttTssT..',
    '..tssTttttTss...',
    '....tttttttt....',
    '....pppppppp....',
    '....pppPPppp....',
    '................',
    '................',
  ]),
  think: px([
    '....yttttttT....',
    '...tyttttttTt...',
    '..ttTttttttTtt..',
    '..tTtttttttTTt..',
    '..tssssssssstt..',
    '..sTtttttttTts..',
    '....pppppppp....',
    '....pppPPppp....',
    '...oooo..oooo...',
    '...oooo..oooo...',
  ]),
  cheer: px([
    '..ss........ss..',
    '..ss........ss..',
    '..tTyttttttTTt..',
    '....yttttttT....',
    '....yttttttT....',
    '....yttttttT....',
    '....yttttttT....',
    '....yttttttT....',
    '....pppppppp....',
    '....pppPPppp....',
    '...oooo..oooo...',
    '...oooo..oooo...',
  ]),
  slump: px([
    '................',
    '....yttttttT....',
    '...tytttttttt...',
    '..ttTttttttTtt..',
    '..ssTttttttTss..',
    '..sSpppppppSs...',
    '....pppPPppp....',
    '....pppPPppp....',
    '...oooo..oooo...',
    '...oooo..oooo...',
  ]),
};

/** Poses whose body drawing starts higher than the shoulders. */
const BODY_TOP: Partial<Record<Pose, number>> = { cheer: 11 };

/** How far the head sits below its rest position in each pose. */
const HEAD_DY: Record<Pose, number> = {
  stand: 0,
  walkA: 0,
  walkB: 0,
  typeA: 0,
  typeB: 1,
  think: 0,
  cheer: 0,
  slump: 2,
};

/* -------------------------------------------------------------------- build */

export interface Look {
  skin: number;
  hair: number;
  hairColor: number;
  outfit: number;
  /** index into CLOTH_RAMPS for the pants, default slate */
  pants?: number;
  accessory: number;
}

export function roleColorsFor(look: Look): RoleColors {
  const skin = SKIN_RAMPS[look.skin % SKIN_RAMPS.length]!;
  const hair = HAIR_RAMPS[look.hairColor % HAIR_RAMPS.length]!;
  const shirt = CLOTH_RAMPS[look.outfit % CLOTH_RAMPS.length]!;
  const pantsRamp = CLOTH_RAMPS[(look.pants ?? 8) % CLOTH_RAMPS.length]!;
  const accRamp = CLOTH_RAMPS[(look.outfit + 3) % CLOTH_RAMPS.length]!;
  return {
    skinL: PALETTE[skin[0]],
    skin: PALETTE[skin[1]],
    skinD: PALETTE[skin[2]],
    hairL: PALETTE[hair[0]],
    hair: PALETTE[hair[1]],
    hairD: PALETTE[hair[2]],
    shirtL: PALETTE[shirt[0]],
    shirt: PALETTE[shirt[1]],
    shirtD: PALETTE[shirt[2]],
    pantsL: PALETTE[pantsRamp[0]],
    pants: PALETTE[pantsRamp[1]],
    pantsD: PALETTE[pantsRamp[2]],
    accL: PALETTE[accRamp[0]],
    acc: PALETTE[accRamp[1]],
    accD: PALETTE[accRamp[2]],
    shoe: PALETTE.ink1,
  };
}

/** Composes one frame of a person, outlined, 16 x 24. Colors come from `roleColorsFor(look)`. */
export function buildPerson(look: Look, pose: Pose, face: Face = 'normal'): Px {
  const c = new Px(PERSON_W, PERSON_H);
  const hair = HAIR[look.hair % HAIR.length]!;
  const acc = ACCESSORIES[look.accessory % ACCESSORIES.length]!;
  const dy = HEAD_DY[pose];

  if (hair.back) c.blit(hair.back, hair.backX ?? 0, (hair.backY ?? 0) + dy);
  c.blit(BODIES[pose], 0, BODY_TOP[pose] ?? BODY_Y);
  c.blit(HEAD, HEAD_X, HEAD_Y + dy);
  c.blit(FACES[face], HEAD_X, HEAD_Y + dy);
  c.blit(hair.front, hair.x, hair.y + dy);
  if (acc.name !== 'none') c.blit(acc.px, acc.x, acc.y + (acc.onHead ? dy : 0));
  return c.halo('ink0');
}
