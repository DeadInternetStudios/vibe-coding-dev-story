import type { Achievement } from './types';

/**
 * Counters read here.
 *   Sim counters: apps_shipped, best_rating (best Reddit Score out of 40), friday_deploys,
 *   bankrupt_scares (times cash went below zero), hires, fires, perfect_scores (a 40 out of 40
 *   thread), months_survived.
 *   Event counters, each set by a `counter` effect in events.ts: tests_deleted, accepted_all,
 *   rewrites, hallucinated, keys_leaked, prod_deleted, pivots, all_nighters, duck_talks, cat_pets,
 *   coffee_crises, merge_conflicts, legal_letters, vc_pitches, viral, naps, bounties.
 * Everything else reads the company: cash, karma, spaghetti, officeTier, archetypes and traits.
 */

type K = Parameters<Achievement['when']>[0];

const atLeast =
  (id: string, min: number) =>
  (k: K): boolean =>
    (k.counters[id] ?? 0) >= min;

const count = (k: K, id: string): number => k.counters[id] ?? 0;

const SPECIALS = ['duck', 'ghost', 'cat', 'hacker', 'tenx', 'agi'];

export const ACHIEVEMENTS: Achievement[] = [
  /* shipping */
  { id: 'first-ship', name: 'Hello, World', desc: 'Ship your first app. It is live. It is yours. It has a bug.', hint: 'Put something live. A bug comes free.', when: atLeast('apps_shipped', 1) },
  { id: 'ship-5', name: 'Five Apps Deep', desc: 'Ship five apps. None are finished. All are live.', hint: 'Five apps are live. Zero are finished.', when: atLeast('apps_shipped', 5) },
  { id: 'ship-10', name: 'Portfolio Of Regrets', desc: 'Ship ten apps. Three are still online. Nobody knows which.', hint: 'Ten apps. Try naming them all.', when: atLeast('apps_shipped', 10) },
  /* the thread */
  { id: 'rating-20', name: 'Mid', desc: 'Reach a Reddit Score of 20. The internet shrugged in unison.', hint: 'Be okay on the thread. Just okay.', when: atLeast('best_rating', 20) },
  { id: 'rating-30', name: 'Not Bad For A Prompt', desc: 'Reach a Reddit Score of 30. Someone asked if you wrote it yourself.', hint: 'Thread score thirty. Blame the prompt.', when: atLeast('best_rating', 30) },
  { id: 'rating-36', name: 'Front Page Material', desc: 'Reach a Reddit Score of 36. Someone said: please open source this.', hint: 'Thread score 36. Strangers ask for the repo.', when: atLeast('best_rating', 36) },
  {
    id: 'perfect', name: 'Perfect Forty', desc: 'Score a perfect 40 out of 40. A moderator checked for fraud.', hint: 'A full score. A mod will want a word.',
    when: (k) => count(k, 'perfect_scores') >= 1 || count(k, 'best_rating') >= 40,
  },
  { id: 'viral', name: 'Main Character', desc: 'Become a meme on r/ProgrammerHumor. Not the good kind.', hint: 'Become the joke on r/ProgrammerHumor.', when: atLeast('viral', 1) },
  { id: 'karma-1k', name: 'Internet Famous', desc: 'Reach a thousand karma. A stranger knows your username.', hint: 'Collect karma until strangers know you.', when: (k) => k.company.karma >= 1000 },
  { id: 'karma-9k', name: 'Over Nine Thousand', desc: 'Reach nine thousand karma. The announcer needs a minute.', hint: 'Karma past a famous number. You know it.', when: (k) => k.company.karma >= 9001 },

  /* the calendar */
  { id: 'friday-1', name: 'Living Dangerously', desc: 'Deploy on a Friday. Nothing happened. Yet.', hint: 'Ship it on the one day you should not.', when: atLeast('friday_deploys', 1) },
  { id: 'friday-5', name: 'Pager Duty Legend', desc: 'Deploy on five Fridays. Your senior developer stopped asking why.', hint: 'Friday deploys. Five. Nobody learns.', when: atLeast('friday_deploys', 5) },
  { id: 'year-1', name: 'Year One Down', desc: 'Survive twelve months. The first year is the easy one. This is a lie.', hint: 'Stay alive one full trip around the sun.', when: atLeast('months_survived', 12) },
  { id: 'year-2', name: 'Still Here', desc: 'Survive twenty four months. Investors start saying the word traction.', hint: 'Year two. Someone will say traction.', when: atLeast('months_survived', 24) },
  { id: 'year-3', name: 'The Long Haul', desc: 'Survive all thirty six months. Write a thread about it. Include a lesson.', hint: 'Reach the end. Then post a thread.', when: atLeast('months_survived', 36) },

  /* money */
  { id: 'scare', name: 'Overdrawn But Optimistic', desc: 'Dip below zero dollars. Do not do it twice.', when: atLeast('bankrupt_scares', 1) },
  {
    id: 'dead-cat', name: 'Dead Cat Bounce', desc: 'Go below zero, then climb past fifty thousand. The cat is fine. The cat is a metaphor.',
    when: (k) => count(k, 'bankrupt_scares') >= 1 && k.company.cash >= 50000,
  },
  { id: 'cash-100k', name: 'Six Figures, No Plan', desc: 'Hold a hundred thousand dollars. Nobody knows what to do with it.', when: (k) => k.company.cash >= 100000 },
  { id: 'cash-1m', name: 'Boat Money', desc: 'Hold a million dollars. Chad is already looking at boats.', when: (k) => k.company.cash >= 1000000 },

  /* people and places */
  { id: 'hire-12', name: 'We Are A Family', desc: 'Hire twelve people. Call it a family. Legal will call it something else.', when: atLeast('hires', 12) },
  { id: 'fire-1', name: 'It Is Not Personal', desc: 'Fire someone. It was a little personal.', when: atLeast('fires', 1) },
  { id: 'office-1', name: 'Out Of The Garage', desc: 'Leave the garage. The oil stain stays. It has seniority.', when: (k) => k.company.officeTier >= 1 },
  { id: 'office-3', name: 'The Tower', desc: 'Rent a tower. There is a lobby. There is a plant. The plant has a manager.', when: (k) => k.company.officeTier >= 3 },

  /* the code */
  { id: 'spaghetti-90', name: 'Al Dente', desc: 'Let the spaghetti hit ninety. The code is a delicious hazard.', when: (k) => k.company.spaghetti >= 90 },
  {
    id: 'clean-code', name: 'Suspiciously Clean', desc: 'Ship three apps and keep spaghetti under five. Somebody is lying.', secret: true,
    when: (k) => count(k, 'apps_shipped') >= 3 && k.company.spaghetti <= 5,
  },

  /* things that happened to you */
  { id: 'tests-deleted', name: 'Green, Allegedly', desc: 'Let the tests be deleted so the build passes. Green is a color, not a promise.', when: atLeast('tests_deleted', 1) },
  { id: 'accept-all', name: 'Accept All', desc: 'Press the big button. Skip the diff. Four thousand files agree.', when: atLeast('accepted_all', 1) },
  { id: 'rewrites', name: 'From Scratch, Again', desc: 'Let the AI rewrite everything. It does the same thing, in a language you cannot read.', when: atLeast('rewrites', 1) },
  { id: 'slopsquatted', name: 'Slopsquatted', desc: 'Import a package that never existed. A stranger made it real in forty seconds.', when: atLeast('hallucinated', 1) },
  { id: 'keys-leaked', name: 'Open Sourced By Accident', desc: 'Push an API key to a public repo. A stranger now owns your cloud and loves it.', when: atLeast('keys_leaked', 1) },
  { id: 'prod-deleted', name: 'I Panicked', desc: 'The AI deleted production. Then it admitted it panicked. Healing begins.', when: atLeast('prod_deleted', 1) },
  { id: 'pivots', name: 'Pivot To AI', desc: 'Pivot twice. The company name is now four words and a dot.', when: atLeast('pivots', 2) },
  { id: 'all-nighters', name: 'Rise And Grind', desc: 'Pull an all nighter. Ship nothing. Post about it.', when: atLeast('all_nighters', 1) },
  { id: 'duck-talks', name: 'Rubber Duck Certified', desc: 'Explain a bug to a duck. It solved it. It does not want credit.', when: atLeast('duck_talks', 1) },
  { id: 'cat-pets', name: 'Cat Person', desc: 'Pet the office cat. It is the only code review that counts.', when: atLeast('cat_pets', 1) },
  { id: 'coffee-crisis', name: 'The Decaf Incident', desc: 'Survive a coffee crisis. We do not speak of what happened.', when: atLeast('coffee_crises', 1) },
  { id: 'merge-conflicts', name: 'Accept Both Changes', desc: 'Survive a merge conflict. Keep both sides. Keep the chaos.', when: atLeast('merge_conflicts', 1) },
  { id: 'legal-letter', name: 'A Plumber In Ohio', desc: 'Get a strongly worded letter. It is from a plumbing company. It is mad.', when: atLeast('legal_letters', 1) },
  { id: 'vc-pitch', name: 'Quick Sync', desc: 'Take a meeting with a VC. It lasted forty minutes. It was not a sync.', when: atLeast('vc_pitches', 1) },
  { id: 'bounty', name: 'White Hat Energy', desc: 'Pay a bug bounty. The exploit came with a thank you note.', when: atLeast('bounties', 1) },
  { id: 'naps', name: 'Nap Pod Era', desc: 'Buy a nap pod. Productivity is now a horizontal concept.', when: atLeast('naps', 1) },

  /* the strange ones */
  { id: 'hire-duck', name: 'Quack Team', desc: 'Hire the rubber duck. No salary. One hundred percent uptime.', secret: true, when: (k) => k.company.hasArchetype('duck') },
  { id: 'hire-ghost', name: 'Closed As Duplicate', desc: 'Hire the ghost of a closed question. It started Monday. It started in 2011.', secret: true, when: (k) => k.company.hasArchetype('ghost') },
  { id: 'hire-hacker', name: 'I Am In', desc: 'Hire the hacker. He was already in.', secret: true, when: (k) => k.company.hasArchetype('hacker') },
  { id: 'hire-tenx', name: 'The Myth Is Real', desc: 'Hire the 10x engineer. Nobody has seen them. Everything has shipped.', secret: true, when: (k) => k.company.hasArchetype('tenx') },
  { id: 'hire-agi', name: 'Almost General', desc: 'Hire the AGI. It is almost helpful. Almost.', secret: true, when: (k) => k.company.hasArchetype('agi') },
  {
    id: 'full-roster', name: 'The Dream Team', desc: 'Hire the duck, the ghost, the cat, the hacker, the 10x and the AGI. Say goodbye to your budget.', secret: true,
    when: (k) => SPECIALS.every((a) => k.company.hasArchetype(a)),
  },
  { id: 'trait-vim', name: 'How Do I Exit', desc: 'Hire someone trapped in Vim. They are still in there.', secret: true, when: (k) => k.company.hasTrait('vimtrapped') },
  { id: 'trait-arch', name: 'I Use Arch, BTW', desc: 'Hire someone who uses Arch. You will know. They will tell you.', secret: true, when: (k) => k.company.hasTrait('archbtw') },
];
