import type { Ending } from './types';
import { vo } from './vo';

/**
 * Eight ways the three years can end, best first. Ranks: S one, A two, B one, C one, D one, F two.
 * The sim picks the rank from valuation and survival. Where a rank has two endings, any of them
 * fits: pick at random, or lean on karma for `famous` and on a founder who survived for `podcast`.
 * `tag` is shown as written. It never contains a number, so the sim can print its own.
 */
export const ENDINGS: Ending[] = [
  {
    id: 'unicorn', rank: 'S', title: 'The Unicorn',
    body: 'A company you have never heard of wrote a number you cannot read. Due diligence found no database. They closed the deal anyway. Chad cried in the garage. The oil stain got a plaque.',
    line: vo('announcer', 'Congratulations! You have been acquired by a company you have never heard of, for a number you cannot believe!'),
    tag: 'Exit: unicorn. Horn sold separately.',
  },
  {
    id: 'acquired', rank: 'A', title: 'Acquired By Big Tech',
    body: 'A giant bought you. Your app is now a menu item inside a bigger app. Forty million people can see it. Nobody has clicked it. Chad got a corner office. It is a corner of someone else\'s office.',
    line: vo('announcer', 'Acquired! The press release says thrilled six times. It says product zero times.'),
    tag: 'Exit: a menu item.',
  },
  {
    id: 'famous', rank: 'A', title: 'New High Score',
    body: 'No exit, no billions. But strangers know your username, a podcast wants your take, and r/ProgrammerHumor has a flair with your name on it. You are a meme with a payroll.',
    line: vo('announcer', 'New high score! Your karma is over nine thousand!'),
    tag: 'Karma: legendary. Bank: also a number.',
  },
  {
    id: 'ramen', rank: 'B', title: 'Ramen Profitable',
    body: 'You made a little more than you spent. You celebrated with noodles and a second flavor packet. The garage is yours. The runway is infinite and very small.',
    line: vo('announcer', 'Ramen profitable! You have a company, a garage, and eleven dollars.'),
    tag: 'Exit: none. Dinner: soup.',
  },
  {
    id: 'acquihire', rank: 'C', title: 'The Acqui-Hire',
    body: 'A big company wanted your team, not your product. They shut the app down on day one. Chad has a title with the word Innovation in it. He has no desk. He has a lanyard.',
    line: vo('announcer', 'A big company bought your team and threw away your product. Congratulations. We think.'),
    tag: 'Exit: acqui-hire. Product: sunset.',
  },
  {
    id: 'zombie', rank: 'D', title: 'Zombie Startup',
    body: 'Still alive. Barely. Cash: enough for a pizza. Users: three, and one is Chad\'s mom. The company has a Slack and a heartbeat. Both are quiet.',
    line: vo('announcer', 'You are still in business. Technically. The announcer is legally required to say so.'),
    tag: 'Status: alive. Probably.',
  },
  {
    id: 'runway', rank: 'F', title: 'Out Of Runway',
    body: 'The bank account hit zero twice. The landlord changed the locks. The garage is just a garage again. Chad is already drafting a post called What I Learned. It has eleven lessons and a hook.',
    line: vo('announcer', 'Game over. Your runway has ended. Please exit the building with your dignity.'),
    tag: 'Exit: the door.',
  },
  {
    id: 'podcast', rank: 'F', title: 'Founder Starts A Podcast',
    body: 'The company is gone. Chad is not. He hosts a podcast called Failing Upward. It has a sponsor and a merch store. It has more listeners than your app ever did.',
    line: vo('announcer', 'Game over! The company is dead. The founder has a podcast. He is thriving.'),
    tag: 'Exit: a microphone.',
  },
];
