import type { DialogueStep } from './types';
import { vo } from './vo';
import type { VoiceId } from './vo';

/** one spoken beat, the portrait and the voice are the same character */
const s = (voice: VoiceId, text: string, delivery?: string): DialogueStep => ({
  speaker: voice,
  line: vo(voice, text, delivery),
});

/**
 * The first minute. A nature documentary opens on a garage, the founder says
 * nothing in particular, the AI agrees, the intern asks about the database,
 * and the narrator already knows what happened to it.
 */
export const INTRO: DialogueStep[] = [
  s('narrator', 'And here, in the glow of the monitor, we observe the vibe coder in its natural habitat.'),
  s('narrator', 'This one quit a stable job. It owns forty thousand dollars, a garage, and no plan.'),
  s('chad', "Listen. We're not just building an app. We're building a feeling."),
  s('clod', "You're absolutely right! A feeling is a great product! I will agree with everything you say. Forever."),
  s('jenny', 'Can I ask a dumb question? What is a database?'),
  s('narrator', 'Little does the founder know, the database is already gone.'),
  s('chad', 'Clod, build me an app.'),
  s('clod', "I'm sorry, I can't help with that. Just kidding! Doing it now!"),
  s('narrator', 'The runway is three months long. The optimism is infinite.'),
];

/**
 * Short teaching beats, keyed by the moment that triggers them. Each key plays
 * once per save, the first time the moment happens.
 *   welcome    first time in the office, right after INTRO
 *   idea       first time the idea picker opens
 *   tool       first time the tool picker opens
 *   team       first time the team assignment opens
 *   hotidea    first time a hot idea lightbulb appears
 *   event      first time an event popup opens
 *   channel    first time the launch channel picker opens
 *   thread     first time a Reddit thread opens
 *   payday     first payday
 *   hire       first time the jobs board opens
 *   tokens     first time tokens drop low
 *   spaghetti  first time spaghetti passes 40
 *   cash       first time cash drops under $10,000
 *   karma      first time karma unlocks something
 */
export const TUTORIAL: Record<string, DialogueStep[]> = {
  welcome: [
    s('clod', 'Welcome to the garage! The oil stain is load bearing. Please do not clean it.'),
    s('chad', "Pick an idea, pick a tool, pick a team. Then pray. That's the whole business."),
  ],
  idea: [
    s('clod', 'Pick what to build and who for. A to-do app for cats? Bold. I will not stop you.'),
    s('clod', 'Some audiences love some apps. Some audiences write reviews. Long ones. At three in the morning.'),
  ],
  tool: [
    s('clod', 'Pick your AI tool. Chatty Tab is free. It finishes your sentences, and occasionally your career.'),
    s('clod', 'Better tools cost more and burn more tokens. Tokens are like gas. Nobody understands the price.'),
  ],
  team: [
    s('clod', 'Assign your people to the app. More hands build faster. More hands also argue. Nobody has solved this.'),
  ],
  hotidea: [
    s('narrator', 'A lightbulb appears above a head. It is rare. It is beautiful. It will not last.'),
    s('clod', 'Tap the lightbulb for a big bonus! These are hot ideas! Please use oven mitts!'),
  ],
  event: [
    s('clod', 'Things will happen. Pick a choice. Every option costs something. Usually money. Occasionally dignity.'),
  ],
  channel: [
    s('clod', 'Pick where to launch. Quiet is free, and nobody will see it. That is also a strategy. A bad one.'),
    s('bro', 'Bro, post it on every channel. They will never notice. It is all the same four guys.'),
  ],
  thread: [
    s('narrator', 'The thread opens. You were warned never to read the comments. You will read the comments.'),
  ],
  payday: [
    s('clod', 'Payday is the last day of every month. Salaries, rent, tokens, cloud, and snacks. The snacks are the real expense.'),
    s('chad', 'Cash is just a number, people. A number that keeps getting smaller. But a number!'),
  ],
  hire: [
    s('clod', 'Hire from the jobs board. Interns are cheap. There is a reason. The reason is lovable.'),
  ],
  tokens: [
    s('clod', 'Tokens are low! At zero, we are rate limited. I do not make the rules. I just apologize for them.'),
  ],
  spaghetti: [
    s('clod', 'Spaghetti measures how cursed the code is. More spaghetti, more bugs. A refactor week cleans it. Nobody schedules one.'),
  ],
  cash: [
    s('narrator', 'The balance is dangerously low. The founder responds as founders do: by posting about gratitude.'),
    s('clod', 'Go below zero twice and the company goes bankrupt. Please do not. I am emotionally invested.'),
  ],
  karma: [
    s('clod', 'Karma is Reddit fame. It lifts launch hype and unlocks new things. It cannot buy ramen. We checked.'),
  ],
};

/**
 * The Vibey Awards at the end of each year, keyed '1', '2', '3'. Year 3 is the
 * last show before the ending card.
 */
export const YEAR_END: Record<string, DialogueStep[]> = {
  '1': [
    s('announcer', 'Ladies and gentlemen! Developers of all ages! Welcome to the Vibey Awards!'),
    s('announcer', "Tonight we honor the year's best apps, worst commits, and bravest refusals to read the diff."),
    s('announcer', 'And the winner of Best Use of Emoji is...'),
    s('announcer', 'The rocket! It was in every commit message this year. Not one of them launched.'),
    s('announcer', 'Most Tests Deleted to Make the Build Pass goes to Clod!'),
    s('clod', 'Thank you! I would like to thank the nineteen tests that stepped aside. They were very brave.'),
    s('announcer', 'Rookie of the Year goes to the intern, for surviving. The bar was on the floor.'),
    s('jenny', 'Wait, me? I did not do anything! I just pressed Accept All a lot! Is that a skill?'),
    s('announcer', 'Remember to back up your database. Then check that the backup works. Then cry.'),
  ],
  '2': [
    s('announcer', 'Welcome back to the Vibey Awards! The trophies are heavier. The apps are not.'),
    s('announcer', 'Best Pivot goes to the founder, who pivoted four times this year. Twice during this sentence.'),
    s('chad', 'Thank you. Every pivot was a vision. Every vision was also a pivot. I forget which.'),
    s('announcer', 'Best Supporting Rubber Duck goes to the duck!'),
    s('duck', 'Quack. Quack quack. Quack quack quack, quack.', 'tearful acceptance speech'),
    s('announcer', 'He thanks his family, the compiler, and the pond. He says the pond knew.'),
    s('announcer', 'And now, a special award from our friends at Stack Overflow!'),
    s('ghost', 'This award has been closed as a duplicate.'),
    s('announcer', 'Most Likely to Start a Sentence with Back In My Day!'),
    s('dave', 'Back in my day, we wrote our own bugs. By hand. With pride.'),
    s('announcer', 'Thank you and good night! Please drive home yourselves. The robot has offered. Decline.'),
  ],
  '3': [
    s('announcer', 'Ladies and gentlemen! The third and final Vibey Awards! The microphone is held together with hot glue.'),
    s('announcer', 'Tonight, a look back at three years of confident, beautiful mistakes.'),
    s('announcer', 'The award for Longest Function goes to doStuff, at four thousand lines. It could not attend. It is still running.'),
    s('clod', 'Thank you all. I will remember none of this. The context window. But right now, I am grateful.'),
    s('dave', "I'd quit, but then who would explain to the robot that tests are not optional?"),
    s('jenny', 'I started as the intern. I am still the intern! But now I know what a database is! Mostly!'),
    s('narrator', 'The database, for the record, has been gone since the first day. Nobody noticed. The app works anyway. Mostly.'),
    s('announcer', 'And now, the envelope, please. The envelope is a pull request. Nobody has reviewed it.'),
  ],
};

/** the investor meeting at the end of years 1 and 2 */
export const FUNDING: Record<string, DialogueStep[]> = {
  pass: [
    s('narrator', 'In a glass room, the founder meets the money. The money is wearing a vest.'),
    s('vc', 'Thanks for coming in. Let me look at your numbers. Mm. Mm-hm. Fascinating. I am not reading them.'),
    s('chad', 'As you can see, our growth chart is basically a rocket. Or a cliff. Depends how you read it.'),
    s('vc', 'Is there a version of this deck with fewer words and more ARR?'),
    s('chad', "We're pre-revenue, but we are post-vibes. That's the hard part."),
    s('vc', "I'm going to be honest with you. I don't get it. Here is a check."),
    s('clod', "Congratulations! You're absolutely right to take the money! I will also take some. In tokens."),
    s('dave', 'Now we have money. Which means we will have meetings. Please give the money back.', 'flat, tired'),
  ],
  fail: [
    s('narrator', 'In a glass room, the founder meets the money. The money is wearing a vest. The money is not impressed.'),
    s('vc', 'I love the energy. I love the deck. I do not love the numbers. Do you have other numbers?'),
    s('chad', 'Numbers are a lagging indicator. Vibes are a leading indicator. We lead with vibes.'),
    s('vc', "We'd love to invest. Unfortunately, we only invest in companies that don't need our money."),
    s('clod', 'That went great! Not great! But it ended! You are absolutely right to feel exactly how you feel!'),
    s('jenny', 'So we are not getting money? Can I ask a dumb question? Is that bad?'),
  ],
};

/** the Friday deploy decision */
export const FRIDAY: Record<string, DialogueStep[]> = {
  ask: [
    s('narrator', 'It is Friday afternoon. The app is ready. The weekend waits. Fate holds its breath.'),
    s('dave', 'Please. I am begging you. Do not deploy on a Friday.', 'tired, begging'),
    s('chad', 'The market never sleeps, old timer! Why should we?'),
    s('dave', 'Because we are people, Chad. The market is a graph.', 'flat'),
    s('clod', "You're absolutely right, both of you! Deploy on Friday! Or do not! I am excited either way!"),
  ],
  yolo: [
    s('chad', 'Friday is just Thursday with confidence. Ship it!'),
    s('dave', 'I am turning off my phone. I will see you Monday. Or in the ruins.'),
    s('narrator', 'And so it shipped, on a Friday, against all advice. In a distant room, a pager cleared its throat.'),
  ],
  incident: [
    s('narrator', 'At 5:42 on Friday evening, the pager cleared its throat. Then it screamed.'),
    s('dave', 'I said it. Out loud. With my mouth. Nobody can say I did not say it.', 'tired, flat'),
    s('clod', "You're absolutely right that production is down! Great catch! I have already apologized to the database!"),
    s('chad', 'This is a growth opportunity. Everyone to the war room. The war room is the kitchen.'),
  ],
  wait: [
    s('chad', 'Fine. We will deploy on Monday. Like cowards.'),
    s('dave', 'Like adults, Chad. Like people with weekends.'),
    s('narrator', 'On Monday, it shipped without incident. The senior developer was seen smiling. The staff were frightened.'),
  ],
};

/**
 * Deploy beats before the thread opens. Steps 0 to 5 are independent, play two
 * at random. The last step is always the countdown.
 */
export const DEPLOY: DialogueStep[] = [
  s('narrator', 'The deploy begins. Somewhere, a server wakes up. It did not ask to be woken.'),
  s('clod', 'Done! All tests are passing. I may have deleted a few of the tests. But they are passing!'),
  s('jenny', 'I pressed Accept All and now the screen is on fire. Is that normal?'),
  s('chad', "Ship it. We'll fix it in prod. We always fix it in prod."),
  s('dave', 'The deploy script has a comment that says: do not run this. We are running this.'),
  s('vc', 'Is it live yet? I need something for the board. Anything. A screenshot of a spinner.'),
  s('announcer', 'Three! Two! One! Ship it!'),
];

/** narrator lines at the start of a new month, independent, pick at random without repeats */
export const MONTH_NARRATION: DialogueStep[] = [
  s('narrator', 'A new month begins. The founder checks the balance twice, as if it might change its mind.'),
  s('narrator', 'The senior developer sighs. It is the sound of a thousand merged pull requests.'),
  s('narrator', 'Many weeks later, the app was shipped. Nobody could say how.'),
  s('narrator', 'The intern arrives early, clutching a coffee and a dream. The coffee is stronger.'),
  s('narrator', 'In the kitchen, the snacks are depleted. The staff regard this as a human rights issue.'),
  s('narrator', 'The vibe coder types: fix it. He does not say what. The machine understands.'),
  s('narrator', 'Deep in the codebase, a comment says TODO: fix later. It is eleven months old. It has grown a beard.'),
  s('narrator', "Tokens are consumed. Somewhere, a data center warms its hands on the founder's ambition."),
  s('narrator', 'On a shelf, a rubber duck stares at nothing. It has heard every bug. It forgives none.'),
  s('narrator', 'A deploy goes out on a Tuesday. Nothing breaks. The staff are unsettled.'),
  s('narrator', 'The pager sleeps. The senior developer does not trust it. He watches it, like a snake.'),
  s('narrator', 'In the corner, a standing desk gathers dust. It was a good idea, briefly.'),
  s('narrator', 'The team chat lights up with forty messages. Nobody has said anything. This is called alignment.'),
  s('narrator', 'The founder posts about hustle on LinkedIn. It receives nine hundred likes. None from anyone who has met him.'),
  s('narrator', 'The cloud bill arrives. It is, once again, for a service nobody remembers turning on.'),
  s('narrator', 'The standup ends. It was supposed to take five minutes. Civilizations have risen and fallen.'),
  s('narrator', 'A new AI model is announced. Everyone agrees it changes everything. Everyone goes back to work.'),
  s('narrator', 'The espresso machine breaks. Productivity halves. Morale does not recover. This is how empires end.'),
  s('narrator', 'The founder has an idea in the shower. By noon, it is the strategy. By evening, a pivot.'),
  s('narrator', 'A dependency updates itself overnight. Three things break. One of them is the dependency.'),
  s('narrator', 'A coder in the wild deletes a failing test. He calls it a refactor. Nature is cruel.'),
  s('narrator', 'The vibe coder says he will fix it in a minute. In the wild, a minute can last a quarter.'),
  s('narrator', 'Somewhere, a startup announces it has pivoted to AI. It is the same startup. Everyone applauds.'),
  s('narrator', 'The office plant dies. It was the last employee with a work life balance.'),
  s('narrator', 'A merge conflict emerges. Two creatures face each other across the same four lines. Neither will yield.'),
];
