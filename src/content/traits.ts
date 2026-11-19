import type { Trait } from './types';

/**
 * Quirks. Reading guide for the sim: `speed`, `bugs`, `salary` and `xp` are multipliers
 * (1 is neutral, 1.2 is twenty percent more). `mood` is a flat shift to the baseline
 * mood and `skills` are flat skill points. Every trait is a trade, so nobody is a free lunch.
 */
export const TRAITS: Trait[] = [
  {
    id: 'acceptall',
    name: 'Accept All',
    blurb: 'Has never once clicked Reject.',
    mods: { speed: 1.25, bugs: 1.4, skills: { paranoia: -2 } },
  },
  {
    id: 'readsdiff',
    name: 'Reads The Diff',
    blurb: 'Actually reads the diff. Unsettling.',
    mods: { speed: 0.85, bugs: 0.6, skills: { debug: 2 } },
  },
  {
    id: 'caffeinated',
    name: 'Fully Caffeinated',
    blurb: 'Four coffees deep. Can hear colors.',
    mods: { speed: 1.2, bugs: 1.1, mood: -2 },
  },
  {
    id: 'nightowl',
    name: 'Night Owl',
    blurb: 'Commits at 3 am. Unreachable before noon.',
    mods: { speed: 1.1, bugs: 1.15 },
  },
  {
    id: 'perfectionist',
    name: 'Pixel Perfectionist',
    blurb: 'Zooms to 800 percent. Sees a crime.',
    mods: { speed: 0.8, bugs: 0.9, skills: { taste: 3 } },
  },
  {
    id: 'overconfident',
    name: 'Confidently Wrong',
    blurb: 'Has never doubted themselves. It has been tested.',
    mods: { speed: 1.2, bugs: 1.3, mood: 5 },
  },
  {
    id: 'impostor',
    name: 'Impostor Syndrome',
    blurb: 'Sure everyone will find out. Everyone knows. It is fine.',
    mods: { speed: 0.95, bugs: 0.85, mood: -5, xp: 1.3 },
  },
  {
    id: 'replyguy',
    name: 'Reply Guy',
    blurb: 'Has a take. Has several. Posts them all.',
    mods: { speed: 0.9, skills: { hustle: 3 } },
  },
  {
    id: 'ducktalker',
    name: 'Talks To The Duck',
    blurb: 'Explains every bug to a duck. Fixes it mid sentence.',
    mods: { speed: 0.95, bugs: 0.8, skills: { debug: 2 } },
  },
  {
    id: 'meetinghater',
    name: 'Allergic To Meetings',
    blurb: 'Breaks out in hives at the word sync.',
    mods: { speed: 1.15, mood: -4 },
  },
  {
    id: 'fridayyolo',
    name: 'Friday Deployer',
    blurb: 'Believes in miracles. Deploys on Fridays.',
    mods: { speed: 1.2, bugs: 1.25, skills: { hustle: 1 } },
  },
  {
    id: 'grass',
    name: 'Touches Grass',
    blurb: 'Goes outside. Returns with perspective and a sunburn.',
    mods: { speed: 0.9, mood: 8 },
  },
  {
    id: 'promptwhisperer',
    name: 'Prompt Whisperer',
    blurb: 'Writes prompts like poetry. Always starts with please.',
    mods: { salary: 1.15, skills: { prompt: 3 } },
  },
  {
    id: 'rumor10x',
    name: 'Rumored 10x',
    blurb: 'Nobody has seen the code. Everyone has seen the invoice.',
    mods: { speed: 1.3, bugs: 1.2, salary: 1.4 },
  },
  {
    id: 'snacks',
    name: 'Works For Snacks',
    blurb: 'Paid in pizza and exposure. Genuinely happy.',
    mods: { salary: 0.7, mood: 5 },
  },
  {
    id: 'napper',
    name: 'Sleeps At Desk',
    blurb: 'Technically in the office. Technically.',
    mods: { speed: 0.8, mood: 4, salary: 0.9 },
  },
  {
    id: 'anxious',
    name: 'Anxious Committer',
    blurb: 'Commits every forty seconds. Says sorry each time.',
    mods: { speed: 0.9, bugs: 0.8, mood: -2 },
  },
  {
    id: 'tinfoil',
    name: 'Tinfoil Hat',
    blurb: 'Rotates keys hourly. Trusts no one. Especially you.',
    mods: { speed: 0.9, mood: -3, skills: { paranoia: 4 } },
  },
  {
    id: 'burnedout',
    name: 'Burned Out',
    blurb: 'Has been fine since 2021.',
    mods: { speed: 0.7, mood: -10, salary: 0.9 },
  },
  {
    id: 'quickstudy',
    name: 'Quick Study',
    blurb: 'Learns fast, asks questions, is your best investment.',
    mods: { mood: 2, xp: 1.5 },
  },
  {
    id: 'legacy',
    name: 'Knows The Legacy Code',
    blurb: 'Wrote the four thousand line function. Knows where the bodies are.',
    mods: { speed: 0.85, bugs: 0.7, salary: 1.1 },
  },
  {
    id: 'rustrewrite',
    name: 'Rewrites It In Rust',
    blurb: 'Has a plan to rewrite everything. Starting Monday.',
    mods: { speed: 0.7, bugs: 0.6, xp: 1.15 },
  },
  {
    id: 'archbtw',
    name: 'Uses Arch Btw',
    blurb: 'Will mention it. Will fix your wifi. Will mention it.',
    mods: { speed: 0.95, mood: -2, skills: { debug: 2 } },
  },
  {
    id: 'stackoverflow',
    name: 'Stack Overflow Native',
    blurb: 'Copies the answer. Sometimes the question.',
    mods: { speed: 1.1, bugs: 1.2 },
  },
  {
    id: 'typesafe',
    name: 'Types Everything',
    blurb: 'Spent a day on one generic. It is beautiful. It does nothing.',
    mods: { speed: 0.8, bugs: 0.75 },
  },
  {
    id: 'vimtrapped',
    name: 'Cannot Exit Vim',
    blurb: 'Has been in the editor since Tuesday.',
    mods: { speed: 0.85, bugs: 0.9, mood: -2 },
  },
];
