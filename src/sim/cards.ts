/**
 * Prompt cards. At the start of each development phase the AI asks what to
 * focus on and the player picks one of three cards. A card shapes that phase.
 * This is the Game Dev Story "development direction" idea with a vibe coding
 * coat of paint.
 */
import type { StatKey } from '../content/types';

export interface Card {
  id: string;
  name: string;
  /** one short line, shown on the card */
  blurb: string;
  /** shown in the toast after picking */
  quip: string;
  /** phases it can be offered in: 0 plan, 1 prompt, 2 fix, 3 ship */
  phases: readonly (0 | 1 | 2 | 3)[];
  /** multiplier on work speed */
  speed?: number;
  /** multipliers on stat gain */
  weight?: Partial<Record<StatKey, number>>;
  /** spaghetti added per working day (negative cleans) */
  spaghetti?: number;
  /** multiplier on token burn */
  tokens?: number;
  /** mood change per working day */
  mood?: number;
  /** hype added once when picked */
  hype?: number;
  /** at the end of the phase, a chance for a bad or good surprise */
  gamble?: { p: number; text: string; stat?: StatKey; n?: number; spaghetti?: number; progress?: number };
  /** art icon id, see src/art/sprites/icons */
  icon: string;
  rarity?: 'common' | 'rare';
}

export const CARDS: readonly Card[] = [
  // plan
  { id: 'prd', name: 'Write a PRD', blurb: 'Vibes up. Speed down. 40 pages.', quip: 'Nobody reads it. Everybody feels better.', phases: [0], speed: 0.9, weight: { vibes: 1.35, features: 1.1 }, icon: 'doc' },
  { id: 'typing', name: 'Just Start Typing', blurb: 'Fast start. Cursed foundations.', quip: 'The folder structure is a cry for help.', phases: [0], speed: 1.3, weight: { vibes: 0.8 }, spaghetti: 0.2, icon: 'bolt' },
  { id: 'askai', name: 'Ask the AI What To Build', blurb: 'It has ideas. They are all todo apps.', quip: 'Clod suggests a to-do app. With blockchain.', phases: [0], weight: { vibes: 1.2, features: 1.3 }, tokens: 1.4, icon: 'spark' },
  { id: 'whiteboard', name: 'Whiteboard Session', blurb: 'Boxes and arrows. Morale up.', quip: 'Three arrows lead to a box labeled "AI".', phases: [0], speed: 0.85, weight: { vibes: 1.4 }, mood: 1.2, icon: 'board' },
  { id: 'steal', name: 'Steal the Idea', blurb: 'Inspired by. Heavily. Legally distinct.', quip: 'It is not a clone. It is a homage with extra steps.', phases: [0], speed: 1.15, hype: 4, gamble: { p: 0.2, text: 'The original founder notices. Awkward tweet.', stat: 'vibes', n: -6 }, icon: 'mask' },

  // prompt
  { id: 'acceptall', name: 'Accept All', blurb: 'No diffs. Only vibes. Big speed.', quip: 'The diff is 4,000 lines. Nobody scrolled.', phases: [1], speed: 1.6, weight: { stability: 0.6, security: 0.6 }, spaghetti: 0.5, gamble: { p: 0.3, text: 'Accept All accepted something you did not want.', stat: 'stability', n: -12, spaghetti: 6 }, icon: 'check2', rarity: 'common' },
  { id: 'absolutely', name: "You're Absolutely Right!", blurb: 'Agreeable AI. Features and morale.', quip: 'It agrees with everything. Including the contradictions.', phases: [1], speed: 1.1, weight: { features: 1.2 }, mood: 1.0, icon: 'heart' },
  { id: 'pop', name: 'Make It Pop', blurb: 'Gradients. Glow. Rounded corners.', quip: 'Everything is now a card with a shadow.', phases: [1], speed: 0.9, weight: { polish: 1.5, vibes: 1.2 }, icon: 'star' },
  { id: 'onemore', name: 'One More Feature', blurb: 'Feature creep, on purpose.', quip: 'It also does your taxes now. Badly.', phases: [1], speed: 0.9, weight: { features: 1.5 }, spaghetti: 0.3, icon: 'plus' },
  { id: 'tests', name: 'Write the Tests First', blurb: 'Adult supervision. Slow and steady.', quip: 'Green checkmarks as far as the eye can see.', phases: [1, 2], speed: 0.75, weight: { stability: 1.45 }, spaghetti: -0.1, icon: 'flask' },
  { id: 'reroll', name: 'Reroll the Prompt', blurb: 'Same words, different luck. Tokens burn.', quip: 'The third try said the same thing, louder.', phases: [1], speed: 1.2, tokens: 2, icon: 'dice' },
  { id: 'plan', name: 'Use Plan Mode', blurb: 'Think first. Fewer rewrites.', quip: 'The plan has 14 steps. Step 9 is "profit".', phases: [1], speed: 0.95, weight: { features: 1.2, stability: 1.2 }, spaghetti: -0.1, icon: 'map' },
  { id: 'deletetests', name: 'Delete the Failing Tests', blurb: 'Instantly green. Suspiciously.', quip: 'Zero failing tests. Zero tests.', phases: [1, 2], speed: 1.3, weight: { stability: 0.7, security: 0.8 }, icon: 'trash', rarity: 'rare' },
  { id: 'rest', name: '// rest of code here', blurb: 'The AI skips the boring parts.', quip: 'The boring parts were the app.', phases: [1], speed: 1.45, weight: { features: 0.75, stability: 0.8 }, spaghetti: 0.2, gamble: { p: 0.25, text: 'A comment replaced your login code.', stat: 'security', n: -10 }, icon: 'dots', rarity: 'rare' },

  // fix
  { id: 'logging', name: 'Add More Logging', blurb: 'console.log("here 2"). Stability up.', quip: 'The console is a novel now.', phases: [2], speed: 0.9, weight: { stability: 1.3 }, icon: 'scroll' },
  { id: 'offon', name: 'Turn It Off and On', blurb: 'Coin flip. Sometimes it works.', quip: 'It works. Nobody knows why.', phases: [2], gamble: { p: 0.5, text: 'It fixed itself. Spooky.', stat: 'stability', n: 9, progress: 4 }, icon: 'power' },
  { id: 'secreview', name: 'Security Review', blurb: 'Find the API key before Twitter does.', quip: 'The API key was in the frontend. Of course.', phases: [2], speed: 0.8, weight: { security: 1.8 }, icon: 'shield' },
  { id: 'rewrite', name: 'Rewrite From Scratch', blurb: 'Spaghetti gone. Schedule gone too.', quip: 'The AI rewrote it in Rust. Nobody asked.', phases: [2], speed: 0.6, weight: { stability: 1.2 }, spaghetti: -0.9, icon: 'recycle' },
  { id: 'pray', name: 'Ship and Pray', blurb: 'Speed up. Sleep down.', quip: 'Pray to the deploy gods. They are busy.', phases: [2], speed: 1.5, weight: { stability: 0.8, security: 0.7 }, icon: 'pray' },
  { id: 'duck', name: 'Rubber Duck It', blurb: 'Explain it out loud. Fix it by accident.', quip: 'The duck did not say a word. Perfect.', phases: [2], speed: 0.95, weight: { stability: 1.25 }, mood: 1.0, icon: 'duck' },

  // ship
  { id: 'gradient', name: 'Gradient Landing Page', blurb: 'Purple. Of course it is purple.', quip: 'A hero section with "Reimagine" in it.', phases: [3], weight: { vibes: 1.4, polish: 1.2 }, hype: 5, icon: 'rainbow' },
  { id: 'tweet', name: 'Teaser Tweet', blurb: 'Build in public. Cry in private.', quip: 'Four likes. Three are bots. One is mom.', phases: [3], speed: 0.9, hype: 11, icon: 'bird' },
  { id: 'aititle', name: "Add 'AI-Powered' to the Title", blurb: 'Hype up. Honesty down.', quip: 'It is a calculator. It is now AI-powered.', phases: [3], hype: 9, gamble: { p: 0.25, text: 'Someone asked what the AI does. Silence.', stat: 'vibes', n: -5 }, icon: 'robot' },
  { id: 'mom', name: 'Beta Test with Mom', blurb: 'Brutal UX feedback. Steady love.', quip: 'Mom could not find the button. Neither could you.', phases: [3], weight: { polish: 1.4, stability: 1.2 }, mood: 1.0, icon: 'heart' },
  { id: 'askreddit', name: 'Ask Reddit for Feedback', blurb: 'Free advice. Mostly roasts.', quip: 'Top comment: "have you tried not building this".', phases: [3], hype: 7, weight: { polish: 1.2 }, gamble: { p: 0.3, text: 'A thread formed. It is not kind.', stat: 'vibes', n: -4 }, icon: 'snoo' },
];

export function cardById(id: string): Card | undefined {
  return CARDS.find((c) => c.id === id);
}
