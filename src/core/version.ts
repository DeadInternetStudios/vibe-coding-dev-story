/** The version a player sees under ABOUT. `version.test.ts` keeps it equal to package.json. */
export const VERSION = '1.0.0';

/**
 * Who has listened to the voices end to end, or null while nobody has. ABOUT tells the player, and `version.test.ts` keeps this equal to
 * the sign-off line in README.md, so the game and the README never say different things. Change both together, and only on someone's word.
 */
export const VOICES_HEARD_BY: string | null = null;
