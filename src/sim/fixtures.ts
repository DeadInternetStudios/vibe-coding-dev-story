/**
 * A tiny content set so the sim, the tests and the first scenes can run
 * before (and without) the real writing. Not shipped when the real content
 * is present.
 */
import type { Channel, StaffArchetype, Vignette } from '../content/types';
import { vo } from '../content/vo';
import { buildContent, type Content } from './content';

const W = (v: number, f: number, p: number, s: number, c: number) => ({ vibes: v, features: f, polish: p, stability: s, security: c });

const archetype = (id: string, role: string, voice: StaffArchetype['voice'], skills: StaffArchetype['skills'], salary: [number, number], special = false): StaffArchetype => ({
  id,
  role,
  blurb: `${role}. Works here.`,
  voice,
  skills,
  salary,
  traits: ['eager', 'tired'],
  names: [],
  intro: [vo(voice, `Hi, I am your new ${role.toLowerCase()}. Please do not ask about the last place.`)],
  quotes: ['Compiling...', 'It works on my machine.', 'One more prompt.', 'Is it lunch yet?', 'Trust me.', 'Accept all.', 'Hmm.', 'Ship it.', 'Brb, coffee.', 'Vibes only.'],
  look: { hair: [0, 1, 2, 3, 4, 5], outfit: [0, 1, 2, 3, 4, 5, 6, 7], accessory: [0, 1, 2] },
  unlock: {},
  special,
});

const channel = (id: string, name: string, where: string, cost: number, hype: number, roast: number, unlock = {}): Channel => ({
  id,
  name,
  where,
  blurb: `${name}.`,
  cost,
  hype,
  variance: 0.3,
  roast,
  karmaMult: 1,
  unlock,
  titles: ['I built {name} in a weekend. {tagline}', 'Show: {name}. {tagline}'],
});

const v = (id: string, topic: string, tone: Vignette['tone'], judges: Vignette['judges'], when: Vignette['when'], text: string, voice: Vignette['comments'][number]['line']['voice'] = 'dave'): Vignette => ({
  id,
  topic,
  tone,
  judges,
  weight: 1,
  when,
  comments: [
    { user: 'u/SeniorDave_42', depth: 0, votes: [20, 900], line: vo(voice, text) },
    { user: 'u/ClodFan99', depth: 1, votes: [5, 120], line: vo('clod', "You're absolutely right! Let me fix that.") },
  ],
});

export const FIXTURE: Content = buildContent({
  kinds: [
    { id: 'todo', name: 'To-Do App', article: 'a', blurb: 'The classic.', weights: W(0.15, 0.3, 0.15, 0.3, 0.1), weeks: 6, money: 3, unlock: {}, nameTemplates: ['{brand}Do', 'Todo{pun}', '{Niche} Tasks'], taglines: ['It has a checkbox.', 'Dark mode included.', 'Zero bugs, probably.'], announce: vo('announcer', 'A to-do app...') },
    { id: 'landing', name: 'Landing Page', article: 'a', blurb: 'Just a page. A very gradient page.', weights: W(0.35, 0.1, 0.4, 0.1, 0.05), weeks: 4, money: 2, unlock: {}, nameTemplates: ['{brand}ly', '{pun}Page'], taglines: ['It scrolls.', 'The hero is a gradient.'], announce: vo('announcer', 'A landing page...') },
    { id: 'game', name: 'Mobile Game', article: 'a', blurb: 'Tap to win.', weights: W(0.3, 0.25, 0.25, 0.15, 0.05), weeks: 10, money: 6, unlock: { year: 1 }, nameTemplates: ['{brand} Tap', '{pun} Quest'], taglines: ['Tap. Tap. Tap.'], announce: vo('announcer', 'A mobile game...') },
  ],
  niches: [
    { id: 'dogs', plural: 'Dogs', singular: 'Dog', adj: 'Canine', brand: 'Doggo', pun: 'Paws', blurb: 'Good boys.', favors: ['todo', 'game'], curses: ['landing'], unlock: {}, announce: vo('announcer', 'For dogs!') },
    { id: 'devs', plural: 'Developers', singular: 'Developer', adj: 'Dev', brand: 'Dev', pun: 'Stack', blurb: 'Tough crowd.', favors: ['landing'], curses: ['game'], unlock: {}, announce: vo('announcer', 'For developers!') },
    { id: 'plumbers', plural: 'Plumbers', singular: 'Plumber', adj: 'Pipe', brand: 'Pipe', pun: 'Flow', blurb: 'Underserved.', favors: ['todo'], curses: [], unlock: {}, announce: vo('announcer', 'For plumbers!') },
  ],
  tools: [
    { id: 'tab', name: 'Chatty in a Tab', blurb: 'Free. Forgets.', price: 0, monthly: 0, speed: 0.8, bugs: 1.3, tokens: 4, slots: 2, unlock: {}, chatter: ['Copy. Paste. Pray.', 'New chat.', 'It forgot again.', 'Paste.', 'Hmm.', 'Retry.'] },
    { id: 'cursed', name: 'Cursed IDE', blurb: 'Agent mode. Pray.', price: 800, monthly: 120, speed: 1.4, bugs: 1.0, tokens: 14, slots: 4, unlock: {}, chatter: ['Accept all.', 'It edited 40 files.', 'Tab tab tab.', 'Agent is thinking...', 'Yes yes yes.', 'Apply.'] },
  ],
  traits: [
    { id: 'eager', name: 'Eager', blurb: 'Says yes to everything.', mods: { speed: 1.05, mood: 2 } },
    { id: 'tired', name: 'Tired', blurb: 'Has seen things.', mods: { bugs: 0.9, speed: 0.95 } },
    { id: 'charming', name: 'Charming', blurb: 'Great at hype.', mods: { skills: { hustle: 4 } } },
    { id: 'picky', name: 'Picky', blurb: 'Pixel perfect or nothing.', mods: { skills: { taste: 4 }, speed: 0.95 } },
  ],
  archetypes: [
    archetype('founder', 'Founder', 'chad', { prompt: [8, 12], taste: [6, 10], debug: [6, 10], paranoia: [4, 8], hustle: [8, 12] }, [0, 0], true),
    archetype('vibecoder', 'Vibe Coder', 'clod', { prompt: [10, 18], taste: [6, 12], debug: [3, 8], paranoia: [2, 6], hustle: [4, 10] }, [2800, 3600]),
    archetype('intern', 'Intern', 'kid', { prompt: [4, 9], taste: [3, 8], debug: [2, 6], paranoia: [1, 4], hustle: [2, 8] }, [1200, 1800]),
    archetype('senior', 'Senior Dev', 'dave', { prompt: [6, 12], taste: [4, 9], debug: [14, 24], paranoia: [10, 18], hustle: [2, 6] }, [5200, 7200]),
    archetype('designer', 'Designer', 'jenny', { prompt: [4, 9], taste: [14, 24], debug: [3, 8], paranoia: [2, 6], hustle: [6, 12] }, [3600, 5000]),
    archetype('growth', 'Growth Hacker', 'bro', { prompt: [4, 9], taste: [5, 10], debug: [2, 6], paranoia: [2, 6], hustle: [14, 24] }, [3000, 4400]),
    archetype('duck', 'Rubber Duck', 'duck', { prompt: [1, 3], taste: [1, 3], debug: [14, 18], paranoia: [2, 4], hustle: [1, 3] }, [0, 0], true),
  ],
  firstNames: ['Ada', 'Linus', 'Grace', 'Alan', 'Priya', 'Mateo', 'Yuki', 'Zoe', 'Omar', 'Ivy', 'Kai', 'Nina', 'Raj', 'Luca', 'Mia', 'Theo'],
  lastNames: ['Byte', 'Null', 'Stack', 'Merge', 'Patel', 'Garcia', 'Kim', 'Okafor', 'Rossi', 'Novak', 'Tanaka', 'Singh'],
  companyNames: ['Vibe Labs', 'Prompt & Circumstance', 'Ship Happens', 'Accept All Inc', 'Stonks.ai'],
  channels: [
    channel('quiet', 'Quiet Launch', 'your-own-site', 0, 0, 0.1),
    channel('hn', 'Show HN', 'Hacker News', 500, 18, 0.5, { karma: 100 }),
    channel('humor', 'r/ProgrammerHumor', 'r/ProgrammerHumor', 800, 26, 0.8, { karma: 300 }),
  ],
  events: [
    {
      id: 'dev-absolutely-right',
      stage: 'dev',
      weight: 2,
      speaker: 'clod',
      when: (c) => c.project !== null,
      title: 'You are absolutely right!',
      body: 'The AI agreed with everything you said, including the parts that contradict each other. The build is now both a todo app and a submarine.',
      line: vo('clod', "You're absolutely right! I'll rewrite everything from scratch."),
      choices: [
        { label: 'Let it cook', result: 'It rewrote everything. It is somehow forty percent better and one hundred percent unfamiliar.', effects: [{ t: 'progress', n: 8 }, { t: 'spaghetti', n: 6 }] },
        { label: 'Revert to last commit', result: 'You find the last commit. It is called "final final v2 REAL". Time well spent.', effects: [{ t: 'delay', days: 2 }, { t: 'spaghetti', n: -3 }, { t: 'mood', n: 5, who: 'all' }] },
      ],
    },
    {
      id: 'month-aws-bill',
      stage: 'month',
      weight: 1.5,
      speaker: 'system',
      when: (c) => c.company.appsShipped > 0,
      title: 'The cloud bill arrives',
      body: "It says $14,382. Last month it said $12. The AI made 'a small optimization' and spun up four hundred GPUs to render a to-do list.",
      choices: [
        { label: 'Pay it and weep', result: 'You pay. The GPUs are still running. They have names now.', effects: [{ t: 'cash', n: -6000 }] },
        { label: 'Negotiate with the cloud', result: 'Support replies in six minutes: "Have you tried optimizing?" You have not.', hint: 'coin flip', effects: [{ t: 'chance', p: 0.4, yes: [{ t: 'cash', n: -1500 }], no: [{ t: 'cash', n: -5000 }, { t: 'mood', n: -8, who: 'all' }] }] },
      ],
    },
    {
      id: 'rare-pizza',
      stage: 'rare',
      weight: 1,
      speaker: 'system',
      when: () => true,
      title: 'Free pizza appears',
      body: 'Nobody ordered it. Nobody asks questions. Mood improves immediately.',
      choices: [{ label: 'Eat the pizza', result: 'It is pineapple. Half the team is furious. Half is in love.', effects: [{ t: 'mood', n: 12, who: 'all' }, { t: 'spaghetti', n: 1 }] }],
    },
    {
      id: 'launch-friend',
      stage: 'launch',
      weight: 1,
      speaker: 'bro',
      when: (c) => c.project !== null,
      title: 'My cousin knows a guy',
      body: 'He says he can get you on a podcast about "disrupting disruption". It costs nothing. It costs everything.',
      line: vo('bro', 'Bro, my cousin knows a guy. He is on a podcast. Huge. Trust me.'),
      choices: [
        { label: 'Do the podcast', result: 'You say "synergy" nine times. Hype goes up. Dignity goes down.', effects: [{ t: 'hype', n: 8 }, { t: 'karma', n: -20 }] },
        { label: 'Politely decline', result: 'You stay humble. The guy is wounded. The cousin is relieved.', effects: [{ t: 'mood', n: 3, who: 'all' }] },
      ],
    },
  ],
  vignettes: [
    v('white-screen', 'bugs', 'roast', 'stability', (c) => c.project.stats.stability < 40, 'Opened it. White screen. Opened devtools. Fourteen thousand errors. Ten out of ten.'),
    v('pretty', 'design', 'praise', 'polish', (c) => c.project.stats.polish > 55, 'It is gorgeous. It also does nothing. That is basically a portfolio.', 'jenny'),
    v('weekend', 'weekend', 'roast', 'features', (c) => c.project.stats.features < 45, 'I could build this in a weekend. Not a joke. I did it last weekend.', 'pedant'),
    v('key', 'security', 'chaos', 'security', (c) => c.project.stats.security < 40, 'Found the API key in the frontend. Bought myself a boat.', 'hacker'),
    v('wholesome', 'wholesome', 'praise', 'vibes', (c) => c.project.stats.vibes > 50, 'This made my day. Please never change. Not even the font.', 'wholesome'),
    v('overall', 'overall', 'neutral', 'overall', () => true, 'Solid effort. I will use it twice and forget it exists.', 'narrator'),
    v('hype', 'hype', 'chaos', 'hype', () => true, 'Bookmarked. Never opening it again. Great launch though.', 'bro'),
    v('security2', 'security', 'praise', 'security', (c) => c.project.stats.security > 55, 'Rate limiting, input validation, no secrets in the repo. Who hurt you?', 'dave'),
  ],
  opBodies: ['Built this over the weekend with an AI. I am not a dev. Feedback welcome, but gentle.', 'It started as a joke. Now it has users. Both of them are my mom.'],
  paydayItems: [
    { label: 'Coffee', cost: [300, 700], note: 'The intern drinks nine a day.' },
    { label: 'Energy drinks', cost: [200, 500], note: 'Not a food group.' },
    { label: 'Rubber ducks', cost: [20, 80], note: 'For code review.' },
  ],
  appReviews: [{ stars: 4, text: 'Works. Mostly. Sometimes.', user: 'u/MostlyHappy' }],
  achievements: [
    { id: 'first-launch', name: 'It Ships', desc: 'Launch your first app.', when: (k) => (k.counters.apps_shipped ?? 0) >= 1 },
    { id: 'five-launch', name: 'Serial Shipper', desc: 'Launch five apps.', when: (k) => (k.counters.apps_shipped ?? 0) >= 5 },
  ],
  endings: [
    { id: 'end-s', rank: 'S', title: 'Unicorn With Asterisks', body: 'You sold the company for a number with a lot of commas. The asterisks are in the footnote.', line: vo('announcer', 'And the winner of the Vibey Awards is you! Congratulations!'), tag: 'Valuation {valuation}' },
    { id: 'end-a', rank: 'A', title: 'Acqui-hired With Pride', body: 'A big company bought you for the team. They kept the logo. They lost the vibe.', line: vo('announcer', 'A fine, fine exit.'), tag: 'Valuation {valuation}' },
    { id: 'end-b', rank: 'B', title: 'Ramen Profitable', body: 'You are profitable, mostly in noodles. The team still likes you.', line: vo('narrator', 'It was not much. But it was yours.'), tag: 'Valuation {valuation}' },
    { id: 'end-c', rank: 'C', title: 'Pivot to Consulting', body: 'You now charge $400 an hour to explain what you learned. Nobody listens.', line: vo('narrator', 'And so you consulted.'), tag: 'Valuation {valuation}' },
    { id: 'end-d', rank: 'D', title: 'Back to the Day Job', body: 'The startup is archived. The repo is public. The LinkedIn post is humble.', line: vo('narrator', 'Back to the day job.'), tag: 'Valuation {valuation}' },
    { id: 'end-f', rank: 'F', title: 'The Cursed Repo', body: 'The company folded, but the code lives on in a README that says "TODO: fix later".', line: vo('narrator', 'Nobody fixed it later.'), tag: 'Valuation {valuation}' },
    { id: 'bankrupt-ramen', rank: 'F', title: 'Out of Runway', body: 'The bank account hit zero on a Friday. Nobody deployed. Everybody left.', line: vo('narrator', 'The runway ended. The plane did not.'), tag: 'Cash $0' },
  ],
  ambient: [],
  loading: ['Reticulating splines...', 'Warming up the GPU...'],
  tips: ['Never deploy on a Friday.'],
  headlines: ['Local startup ships; internet reacts.'],
  commitMessages: ['fix', 'final fix', 'final fix v2', 'WIP'],
  story: { intro: [], tutorial: {}, yearEnd: {}, funding: {}, friday: {}, deploy: [], monthNarration: [] },
});
