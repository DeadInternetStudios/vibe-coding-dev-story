import type { Achievement, Effect, EventCtx, GameEvent, StatKey } from './types';
import { vo } from './vo';

/**
 * The Reddit tropes pack, part two: nineteen Reddit world events and the achievements
 * that go with them. Merged into EVENTS and ACHIEVEMENTS by `index.ts`.
 *
 * Counters set here (read by REDDIT_ACHIEVEMENTS below):
 *   bug_memes open_sourced trust_me_bro keys_leaked throwaways wrong_subs cake_days gold_edits
 *   amas mod_warnings repost_bots shared_anyway hug_of_death mod_removed rival_clones
 *   upvote_rings front_page mod_jobs brigades
 * Sim counters read: friday_incidents, events_seen.
 *
 * Month and rare events can fire with no product in development, so they never lean on
 * stat, progress or delay unless the choice is gated on a project.
 */

/* ---------------------------------------------------------------- predicates */

type When = (c: EventCtx) => boolean;
const always: When = () => true;
const has = (id: string): When => (c) => c.company.hasArchetype(id);
const hasProject: When = (c) => c.project !== null;
const all = (...ps: When[]): When => (c) => ps.every((p) => p(c));
const karmaOver = (n: number): When => (c) => c.company.karma >= n;
const shippedOver = (n: number): When => (c) => c.company.appsShipped >= n;

/* ------------------------------------------------------------------- effects */

const cash = (n: number): Effect => ({ t: 'cash', n });
const tokens = (n: number): Effect => ({ t: 'tokens', n });
const karma = (n: number): Effect => ({ t: 'karma', n });
const spag = (n: number): Effect => ({ t: 'spaghetti', n });
const mood = (n: number, who: 'all' | 'random' = 'all'): Effect => ({ t: 'mood', n, who });
const stat = (k: StatKey, n: number): Effect => ({ t: 'stat', stat: k, n });
const hype = (n: number): Effect => ({ t: 'hype', n });
const delay = (days: number): Effect => ({ t: 'delay', days });
const counter = (id: string, n = 1): Effect => ({ t: 'counter', id, n });
const chance = (p: number, yes: Effect[], no: Effect[] = []): Effect => ({ t: 'chance', p, yes, no });

/* ------------------------------------------------------------------- events */

export const REDDIT_EVENTS: GameEvent[] = [
  /* ================================================================ dev */
  {
    id: 'rd-bug-meme', stage: 'dev', when: hasProject, weight: 1.1,
    title: 'Your Worst Bug Is A Meme',
    body: 'Someone screenshotted the worst bug in your beta. It now has a caption, a template and forty thousand shares. The bug is the most popular part of the app.',
    speaker: 'bro',
    line: vo('bro', 'Bro. You are in the group chat. The bug has a caption and a fan club. It is hilarious. I am so sorry.'),
    choices: [
      { label: 'Make it a feature', hint: 'spaghetti +6',
        result: 'The bug is now called Chaos Mode and has its own toggle. It tests well with people who hate everything else. The code is a crime scene.',
        effects: [hype(15), karma(120), spag(6), counter('bug_memes')] },
      { label: 'Fix it quietly', hint: '2 days',
        result: 'The fix takes two days and removes the bug. It also removes the meme. Forty thousand people feel a small, private loss.',
        effects: [delay(2), stat('stability', 6), hype(-5)] },
      { label: 'Reply with a better meme', hint: 'tokens -30',
        result: 'Clod makes a meme. It uses a template from 2009 and explains its own joke. The internet votes, and the vote is loud.',
        effects: [tokens(-30), counter('bug_memes'), chance(0.5, [karma(200), hype(10)], [karma(-80)])] },
    ],
  },
  {
    id: 'rd-source-request', stage: 'dev', when: always, weight: 1.1,
    title: 'Source Code Please',
    body: 'A commenter asked for the source code. Fourteen people upvoted the ask. Chad cannot remember where it is. The only copy is a document called final final.',
    speaker: 'pedant',
    line: vo('pedant', 'Well, actually, a screenshot of code is not source code. I will wait here, with a link to the license.'),
    choices: [
      { label: 'Open source it',
        result: 'The repo goes public. Three strangers send pull requests. One goes hunting for an API key. One reads your commit messages. The commit messages hurt more.',
        effects: [karma(300), hype(10), mood(-10), counter('open_sourced'), chance(0.35, [cash(-1200), counter('keys_leaked')])] },
      { label: 'Say it is on the roadmap',
        result: 'The roadmap is a link. The link is also on the roadmap. Fourteen people unsubscribe from hope. The team exhales.',
        effects: [karma(-40), mood(5)] },
      { label: 'Send a screenshot', hint: 'tokens -20',
        result: 'Clod produces a beautiful screenshot of an editor with no code in it. It has syntax highlighting. It has a tab called source. It is art.',
        effects: [tokens(-20), counter('trust_me_bro'), chance(0.5, [karma(100)], [karma(-100)])] },
    ],
  },
  {
    id: 'rd-throwaway', stage: 'dev', when: has('intern'), weight: 1,
    title: 'The Throwaway Account',
    body: 'The intern posted about the codebase from a throwaway account. The account is called intern_at_the_vibe_company. She says it is anonymous.',
    speaker: 'jenny',
    line: vo('jenny', 'It is a throwaway! Nobody knows it is me! I only said our app is held together with prompts and hope. Is that bad?', 'anxious, fast'),
    choices: [
      { label: 'Read the post',
        result: 'It has four thousand upvotes. It says the codebase is a haunted house, the senior is the only exorcist, and the snacks are a lie. It is kind, and accurate.',
        effects: [karma(100), mood(-5), counter('throwaways')] },
      { label: 'Ask her to delete it',
        result: 'She deletes it. Then she posts about the deletion. The second post does better. The internet respects a sequel.',
        effects: [mood(-10, 'random'), karma(60), counter('throwaways')] },
      { label: 'Reply from the company',
        result: 'Chad replies: we are listening! Eleven hundred people answer with stories about their own interns. It becomes a support group. The support group has a newsletter.',
        effects: [counter('throwaways'), chance(0.5, [karma(250), hype(10)], [karma(-150)])] },
    ],
  },
  {
    id: 'rd-wrong-sub', stage: 'dev', when: hasProject, weight: 0.9,
    title: 'Posted To The Wrong Sub',
    body: 'Chad posted the teaser to a support group for people who miss dial up modems. It is the best thread of the year. Nobody has clicked the link.',
    speaker: 'chad',
    line: vo('chad', 'I think I posted it to the wrong place. They are very nice. They are telling me about their modems. One of them cried.', 'confused, touched'),
    choices: [
      { label: 'Delete and repost', hint: '1 day',
        result: 'The repost lands in the right place and gets four upvotes. The modem people send a card. It is a picture of a modem. It is sincere.',
        effects: [delay(1), hype(5), counter('wrong_subs')] },
      { label: 'Ask them for feedback', hint: 'spaghetti +4',
        result: 'They love the idea and hate the animations. They ask if it has a dial tone. Chad says it does. It does not yet.',
        effects: [stat('features', 4), spag(4), mood(5), counter('wrong_subs')] },
      { label: 'Leave it up',
        result: 'The modem people adopt Chad as their mascot. He now runs their Tuesday thread. The launch is a footnote in his bio.',
        effects: [karma(150), hype(-5), counter('wrong_subs')] },
    ],
  },
  {
    id: 'rd-four-thousand-words', stage: 'dev', when: all(hasProject, shippedOver(1)), weight: 1,
    title: 'The 4,000 Word Review',
    body: 'A user posted a four thousand word review of your last app. The title is Unacceptable. It is mostly right. Chad has drafted a reply. It is five thousand words.',
    speaker: 'karen',
    line: vo('karen', 'I would like to begin with the font. I would like to end with the font. In between: nine hundred notes.'),
    choices: [
      { label: 'Fix what it says', hint: '4 days',
        result: 'The review has eleven real bugs and three feelings. The team fixes the bugs and sends the feelings a card.',
        effects: [delay(4), stat('stability', 8), stat('polish', 4), karma(60)] },
      { label: 'Let Chad reply',
        result: 'Chad posts all five thousand words. The first reply says not reading all that. The second says same. Somewhere, a bot writes a summary.',
        effects: [karma(-80), hype(8)] },
      { label: 'Send a short thank you',
        result: 'You write: thanks, noted. The reviewer replies: that is it? You reply: yes. A silence follows that lasts the whole afternoon.',
        effects: [karma(40), mood(-5, 'random')] },
    ],
  },

  /* ================================================================ month */
  {
    id: 'rd-cake-day', stage: 'month', when: always, weight: 1,
    title: "It's Your Cake Day",
    body: "Reddit says it is the company account's cake day. A tiny cake icon sits next to the name. Chad is overcome. He wants to post. He has been writing since breakfast.",
    speaker: 'wholesome',
    line: vo('wholesome', 'It is your cake day! There is a tiny cake next to your name! It is made of pixels! It is perfect!'),
    choices: [
      { label: 'Order a real cake', hint: '-$600',
        result: 'The cake says Happy Cake Day in blue icing. It is the first thing the office has agreed on all year. It is gone in nine minutes. The icing stays on the walls.',
        effects: [cash(-600), mood(15), karma(40), counter('cake_days')] },
      { label: 'Let Chad post',
        result: 'Chad posts the nine lessons he learned from cake. The comments are polite. Mostly. The top one says: take the cake and leave.',
        effects: [karma(100), mood(-5), counter('cake_days'), chance(0.3, [karma(-200)])] },
      { label: 'Ignore it',
        result: 'Nobody mentions it. The little cake sits there, sweet and ignored. Chad notices at four p.m. and eats lunch alone.',
        effects: [mood(-8)] },
    ],
  },
  {
    id: 'rd-gold-edit', stage: 'month', when: always, weight: 1.1,
    title: 'Edit: Thanks For The Gold',
    body: "A stranger gave Chad's comment gold. Chad edited it to say thanks. Then he edited it to say wow. The comment is now eighty percent edits.",
    speaker: 'grandma',
    line: vo('grandma', 'Somebody gave your boy a gold, dear. Is it a medal? He has been editing the post since lunch.'),
    choices: [
      { label: 'Pay the gold forward', hint: '-$300',
        result: 'Chad gives gold to nine strangers. Eight are bots. One is a grandmother, who writes back: who are you? She is the best investment of the quarter.',
        effects: [cash(-300), karma(120), mood(5), counter('gold_edits')] },
      { label: 'Let him keep editing',
        result: 'Chad adds edit number nine: Edit: this is my best comment. The internet has noticed. The internet is not always kind about this.',
        effects: [karma(150), counter('gold_edits'), chance(0.4, [karma(-250)])] },
      { label: 'Take his keyboard',
        result: 'Chad hands it over like a man giving up a kidney. He edits one last time from his phone, under the table.',
        effects: [mood(-10, 'random'), karma(20)] },
    ],
  },
  {
    id: 'rd-ama-request', stage: 'month', when: shippedOver(1), weight: 0.9,
    title: 'Do An A-M-A?',
    body: 'The mods of a big subreddit want an A-M-A. Ask me anything. Chad has been preparing his whole life. The questions will be about the app. Mostly.',
    speaker: 'kid',
    line: vo('kid', 'Ask me anything! You just answer questions? That is the whole job? I would be so good at that! Ask me!'),
    choices: [
      { label: 'Do the A-M-A', hint: 'tokens -40',
        result: 'Top question: what is your biggest weakness? Chad says: I care too much. It is the top comment. A reply says: source? There is no source. There is only Chad.',
        effects: [tokens(-40), karma(200), hype(12), counter('amas'), chance(0.4, [karma(-300), mood(-10)])] },
      { label: 'Send Clod instead', hint: 'tokens -20',
        result: 'Clod answers every question with total confidence. It invents a founding story, a co-founder and a pet. The pet is the top comment. The pet is imaginary.',
        effects: [tokens(-20), counter('amas'), chance(0.5, [karma(250), hype(15)], [karma(-250), hype(-10)])] },
      { label: 'Decline politely',
        result: 'The mods say: no problem. They say it in a tone. The tone follows you for a month.',
        effects: [karma(-20), mood(-5)] },
    ],
  },
  {
    id: 'rd-mod-word', stage: 'month', when: always, weight: 1,
    title: 'A Mod Wants A Word',
    body: 'A moderator messaged you. You posted about your app in seven subreddits this week. One of them was about gardening. The message is polite. It includes a screenshot of your account.',
    speaker: 'automod',
    line: vo('automod', 'This is a friendly notice. You have posted the same link seven times. This is not friendly. This is an automated message.', 'flat, reading a notice'),
    choices: [
      { label: 'Apologize and stop',
        result: 'You apologize. The mod replies: thanks. It is the first nice thing a moderator has ever said to you. You frame it.',
        effects: [karma(40), hype(-8), counter('mod_warnings')] },
      { label: 'Pay for ads instead', hint: '-$1,500',
        result: 'The ads run on a site you have never visited, next to an article about socks. They work, in the sense that people see them. People do like socks.',
        effects: [cash(-1500), hype(15), counter('mod_warnings')] },
      { label: 'Argue about rule three',
        result: 'You write a long reply about how rule three is vague. The mod replies with the text of rule three. It is one line. It is not vague. The crowd weighs in.',
        effects: [counter('mod_warnings'), chance(0.35, [karma(300), hype(10)], [karma(-250), hype(-10)])] },
    ],
  },
  {
    id: 'rd-repost-bot', stage: 'month', when: shippedOver(1), weight: 1,
    title: 'A Bot Reposted You',
    body: 'A repost bot copied your launch post, uploaded it eleven minutes earlier, and has more upvotes. It is a bot. It is winning. It has four hundred awards.',
    speaker: 'ghost',
    line: vo('ghost', 'This post has been marked as a repost of a repost of a repost. The original is lost. It was better.', 'hollow, bureaucratic'),
    choices: [
      { label: 'Report the bot',
        result: 'The bot is banned. Its owner appears, a fourteen year old with forty accounts, and cries in the comments. Everyone blames you. You are the villain in a bot story.',
        effects: [karma(-60), hype(8), counter('repost_bots')] },
      { label: 'Credit the bot in a reply',
        result: 'You thank the bot. The bot replies with your own post. The loop is perfect. A philosophy major screenshots it for a paper.',
        effects: [counter('repost_bots'), chance(0.5, [karma(150), hype(5)], [karma(-100)])] },
      { label: 'Repost it yourself', hint: 'tokens -30',
        result: 'Clod reposts your post to beat the bot. It is a repost of a repost of a repost. It gets nine upvotes and a long silence.',
        effects: [tokens(-30), hype(10), karma(-30), counter('repost_bots')] },
    ],
  },
  {
    id: 'rd-please-dont', stage: 'month', when: always, weight: 0.9,
    title: 'Please Do Not Share This',
    body: 'Chad asked a commenter to delete a post about your worst bug. Seven hundred people saw the request. Three hundred shared it. Chad says this is going great.',
    speaker: 'narrator',
    line: vo('narrator', 'The founder asks the internet not to look at something. The internet turns, as one, and looks.'),
    choices: [
      { label: 'Post a joke apology',
        result: 'The apology is funnier than the bug. It beats the bug in upvotes. A man writes: this is why I like this company. He does not buy anything.',
        effects: [karma(150), hype(8), mood(-5), counter('shared_anyway'), chance(0.3, [karma(-150)])] },
      { label: 'Fix it in public', hint: '2 days', requires: hasProject,
        result: 'You patch the bug live and narrate it like a sports match. Three hundred people watch. One proposes marriage to the patch.',
        effects: [delay(2), stat('stability', 6), karma(100), counter('shared_anyway')] },
      { label: 'Say nothing',
        result: 'You say nothing. The story fades by Thursday. Chad does not. He is drafting a response in the notes app. It is titled: The Truth.',
        effects: [mood(-8), hype(-5), counter('shared_anyway')] },
    ],
  },

  /* ================================================================ launch */
  {
    id: 'rd-hug-of-death', stage: 'launch', when: hasProject, weight: 1.1,
    title: 'The Hug Of Death',
    body: 'A stranger posted your link early. A hundred thousand people are about to hug your server. The server is a laptop on a shelf. It knows.',
    speaker: 'narrator',
    line: vo('narrator', 'The crowd approaches the server. It is a laptop on a shelf. It has never known fear until now.'),
    choices: [
      { label: 'Buy the big cloud', hint: '-$2,500',
        result: 'The big cloud arrives in four minutes and costs a month of rent. The site stays up. The invoice has a typo that is also a threat.',
        effects: [cash(-2500), stat('stability', 6), hype(10)] },
      { label: 'Let it ride',
        result: 'The hug is warm and total. The server lasts four seconds and goes out mid sentence. Half the crowd leaves a comment. The other half leaves.',
        effects: [counter('hug_of_death'), chance(0.5, [hype(20), karma(100)], [hype(-10), stat('stability', -8), cash(-800)])] },
      { label: 'Serve one static page', hint: '1 day',
        result: 'The intern swaps the app for one page: we love you, come back tomorrow. It gets four thousand upvotes and zero signups. It is the best page she has built.',
        effects: [delay(1), karma(60), hype(-5)] },
    ],
  },
  {
    id: 'rd-mod-removed', stage: 'launch', when: hasProject, weight: 1.1,
    title: 'The Post Was Removed',
    body: 'The mods removed your announcement for no self promotion. The post is your whole launch plan. The removal notice is polite. The robot who sent it is always polite.',
    speaker: 'automod',
    line: vo('automod', 'Your post was removed. This was done automatically. The moderators have not seen it. They are, however, aware of you.', 'flat, reading a notice'),
    choices: [
      { label: 'Appeal politely', hint: '1 day',
        result: 'You write three paragraphs of respect. Somewhere, a moderator reads one of them. The decision arrives like weather.',
        effects: [delay(1), counter('mod_removed'), chance(0.5, [karma(50), hype(8)], [karma(-30)])] },
      { label: 'Post it somewhere else',
        result: 'You post it in a quieter place. It sits there like a fish in a bucket. The audience is half the size and twice as polite.',
        effects: [hype(-8), karma(20), counter('mod_removed')] },
      { label: 'Message the mods angrily',
        result: 'You write: this is censorship. They reply: this is rule three. You screenshot it. So do they. The screenshots meet in public.',
        effects: [counter('mod_removed'), chance(0.35, [hype(25), karma(150)], [karma(-200), hype(-5)])] },
    ],
  },
  {
    id: 'rd-rival-clone', stage: 'launch', when: hasProject, weight: 1,
    title: 'A Rival Posted Yesterday',
    body: 'A rival launched the same app the day before you. Same idea. Same colors. Their logo is also a gradient. Their name is yours with a one on the end.',
    speaker: 'vc',
    line: vo('vc', 'Two companies, same idea, same week. That is not competition. That is market validation with a deadline.'),
    choices: [
      { label: 'Launch anyway',
        result: 'You launch in the shadow of theirs. Half the comments say: already used the other one. The other half say: this one has a better logo. It does not.',
        effects: [hype(-10), karma(40), counter('rival_clones')] },
      { label: 'Delay and add a feature', hint: '4 days',
        result: 'Four days later you launch with a feature they lack. It is a button. The button does nothing. It does look different.',
        effects: [delay(4), stat('features', 5), hype(5), counter('rival_clones')] },
      { label: 'Comment on their post',
        result: 'You write: congrats, friend! Their thread is kind. Then someone asks which one is better. The replies become a war, and you are in it.',
        effects: [karma(100), counter('rival_clones'), chance(0.4, [karma(-200), hype(-8)])] },
    ],
  },
  {
    id: 'rd-crosspost-nine', stage: 'launch', when: always, weight: 1,
    title: 'Crosspost To Nine Subs',
    body: 'Growth wants to crosspost to nine subreddits. It is just a button, she says. It is nine buttons. Eight of them are against the rules. The ninth is about knitting.',
    speaker: 'bro',
    line: vo('bro', 'Bro. Nine subs. One click. It is basically free. It is basically a bank robbery with a button.'),
    choices: [
      { label: 'Crosspost to all nine',
        result: 'Eight subs remove it within the hour. The ninth, a knitting forum, adopts the app as a mascot. Nine hundred people learn about it. Eight hundred are knitters.',
        effects: [hype(20), karma(-150), counter('mod_removed', 3)] },
      { label: 'Crosspost to three',
        result: 'Three subs, three posts, three polite tones. The mods read them slowly. A knitter sends a thank you card anyway.',
        effects: [hype(8), karma(20), chance(0.25, [karma(-100), counter('mod_removed')])] },
      { label: 'Write nine different posts', hint: 'tokens -60',
        result: 'Clod writes nine posts, each in the voice of a different kind of person. All nine are Chad. Four get through. Five become a cautionary tale.',
        effects: [tokens(-60), hype(14), karma(60)] },
    ],
  },
  {
    id: 'rd-upvote-ring', stage: 'launch', when: always, weight: 0.9,
    title: 'The Upvote Ring',
    body: 'A man in a hoodie offers five thousand upvotes for nine hundred dollars. He calls it community engagement. He also sells comments. The comments are all the word wow.',
    speaker: 'hacker',
    line: vo('hacker', 'Five thousand upvotes. Nine hundred dollars. All real accounts. They are real because I made them.', 'cool, a little too fast'),
    choices: [
      { label: 'Buy the upvotes', hint: '-$900',
        result: 'The upvotes arrive in nine minutes, all at once, all from accounts named Brandon. The thread looks very popular. It also looks very suspicious. Both are true.',
        effects: [cash(-900), hype(20), counter('upvote_rings'), chance(0.5, [karma(-300)])] },
      { label: 'Report him',
        result: 'He is banned within the hour. He sends a polite message: I will remember this. It is a threat. It is also in a very nice font.',
        effects: [karma(40), chance(0.3, [cash(-600)])] },
      { label: 'Ask for a free sample',
        result: 'He sends ten upvotes. Nine are bots. One is Brandon, who is delighted. He is your first real fan.',
        effects: [hype(5), karma(-20), counter('upvote_rings')] },
    ],
  },

  /* ================================================================ rare */
  {
    id: 'rd-front-page', stage: 'rare', when: shippedOver(1), weight: 1,
    title: 'Front Page Of r/all',
    body: 'A thread about your last app is climbing r/all. Ten thousand people are reading it. Nine thousand are reading the comments. Four hundred are asking what this is. Chad is lying on the floor.',
    speaker: 'announcer',
    line: vo('announcer', 'And now, trending on the front page of the entire internet: a thread about your company. The comments are just getting started!', 'game show host'),
    choices: [
      { label: 'Reply to every comment', hint: 'tokens -60',
        result: 'Clod and Chad answer four thousand comments in nine hours. Each reply is warm, personal and slightly different. One is a poem. The poem gets gold.',
        effects: [tokens(-60), karma(400), hype(20), mood(-10), counter('front_page')] },
      { label: 'Put up a donate button', hint: '+$3,000',
        result: 'The button collects three thousand dollars and four hundred comments about the button. One reads: begging has never been so well designed. It is not clear that is a compliment.',
        effects: [cash(3000), karma(-100), counter('front_page')] },
      { label: 'Stay silent and watch',
        result: 'You watch. The thread grows without you. Somebody explains the app better than you ever did, and gets it slightly wrong.',
        effects: [hype(10), karma(100), counter('front_page'), chance(0.4, [hype(-10), karma(-150)])] },
    ],
  },
  {
    id: 'rd-mod-offer', stage: 'rare', when: karmaOver(300), weight: 0.8,
    title: 'They Want You As A Mod',
    body: 'A subreddit with six hundred members asks Chad to be a moderator. It is about toasters in space. The last mod left in 2019. The rules are written in crayon.',
    speaker: 'ghost',
    line: vo('ghost', 'I moderated a forum in two thousand eleven. I read every report. That is how I became what you see. Accept anyway.', 'hollow, wistful'),
    choices: [
      { label: 'Accept',
        result: 'On day one Chad bans four people, unbans three and writes rule nine. Rule nine says: no toasters. The subreddit is about toasters.',
        effects: [karma(150), hype(5), counter('mod_jobs'), chance(0.4, [karma(-300), mood(-10)])] },
      { label: 'Decline',
        result: 'Chad says no with grace and a footnote. The footnote is eleven paragraphs. They accept it as a resignation letter.',
        effects: [karma(20), mood(-8, 'random')] },
      { label: 'Hire Clod as the mod', hint: 'tokens -40',
        result: 'Clod bans nobody. It replies to every post with: great point! The subreddit becomes the happiest place on the internet. The other mods grow suspicious.',
        effects: [tokens(-40), counter('mod_jobs'), chance(0.5, [karma(250)], [karma(-250), cash(-500)])] },
    ],
  },
  {
    id: 'rd-brigade', stage: 'rare', when: shippedOver(1), weight: 0.9,
    title: 'The Brigade Arrives',
    body: 'A rival forum linked your launch thread. Eight hundred strangers arrived and downvoted everything, including the weather report. Chad is reading each one aloud.',
    speaker: 'duck',
    line: vo('duck', 'Quack. Quack quack quack quack. Quack!', 'outraged, leading a protest'),
    choices: [
      { label: 'Report the brigade',
        result: 'The admins reply on Thursday. They say: we see it. That is the entire reply. It is also, somehow, a hug.',
        effects: [karma(30), mood(-5), counter('brigades')] },
      { label: 'Fight back with memes', hint: 'tokens -40',
        result: 'Clod makes forty memes in an hour. One is good. The rest are about Clod. The internet votes on which is which.',
        effects: [tokens(-40), counter('brigades'), chance(0.5, [karma(300), hype(15)], [karma(-200), hype(-5)])] },
      { label: 'Let it burn out',
        result: 'By Wednesday they have moved on to a new target, a man named Greg. Greg has our sympathy and none of our traffic.',
        effects: [karma(-60), hype(-8), counter('brigades')] },
    ],
  },
];

/* ------------------------------------------------------------- achievements */

type K = Parameters<Achievement['when']>[0];

const atLeast =
  (id: string, min: number) =>
  (k: K): boolean =>
    (k.counters[id] ?? 0) >= min;

export const REDDIT_ACHIEVEMENTS: Achievement[] = [
  { id: 'rd-cake-day', name: 'Cake Day', desc: "Celebrate the company account's cake day. There was cake. There was a post. There was regret.", hint: 'Mark the day the account was born.', when: atLeast('cake_days', 1) },
  { id: 'rd-hug-of-death', name: 'Hug Of Death', desc: 'Let a crowd hug your server to death. It lasted four seconds. Its last words were bad gateway.', hint: 'Be loved by too many people at once.', when: atLeast('hug_of_death', 1) },
  { id: 'rd-gold-edit', name: 'Edit: Thanks For The Gold', desc: 'Edit a comment to thank a stranger. Then edit the edit. Then edit the edit of the edit.', hint: 'Get gold. Then edit about it. Repeatedly.', when: atLeast('gold_edits', 1) },
  { id: 'rd-removed', name: 'Removed By Moderators', desc: 'Get a post removed. The reason was a rule number. The number was three.', hint: 'Violate rule three: no self promotion.', when: atLeast('mod_removed', 1) },
  { id: 'rd-trust-me-bro', name: 'Source: Trust Me Bro', desc: 'Answer a request for the source with a screenshot of an empty editor. Peer review is pending.', hint: 'Show them the code. Do not show them the code.', secret: true, when: atLeast('trust_me_bro', 1) },
  { id: 'rd-pull-requests', name: 'Pull Requests Welcome', desc: 'Open source the code. Three strangers help. One of them is about your commit messages.', hint: 'Let strangers read the code.', when: atLeast('open_sourced', 1) },
  { id: 'rd-front-page', name: 'Trending On r/all', desc: 'Land on the front page of the whole site. Ten thousand people ask what this is.', hint: 'Be seen by everyone, very briefly.', when: atLeast('front_page', 1) },
  { id: 'rd-ama', name: 'Ask Me Anything', desc: 'Do an A-M-A. Someone asks about your biggest weakness. You say you care too much.', hint: 'Let the internet ask you things.', when: atLeast('amas', 1) },
  { id: 'rd-template', name: 'Template Of The Week', desc: 'Become a meme because of your worst bug. It has a caption and forty thousand shares.', hint: 'Your worst day, as a template.', when: atLeast('bug_memes', 1) },
  { id: 'rd-same-week', name: 'Great Minds Think Alike', desc: 'Launch the same week as a rival with the same idea. A VC called it validation. He was kind.', hint: 'Somebody had your idea. Yesterday.', when: atLeast('rival_clones', 1) },
  { id: 'rd-bot-repost', name: 'Original Content, Allegedly', desc: 'Get reposted by a bot that does better than you. It has more awards. It has no regrets.', hint: 'Lose to a robot that copied you.', when: atLeast('repost_bots', 1) },
  { id: 'rd-brandon', name: 'Brandon Has Entered The Chat', desc: 'Buy upvotes from a man in a hoodie. Every one came from an account named Brandon.', hint: 'Meet a man in a hoodie. Take his offer.', secret: true, when: atLeast('upvote_rings', 1) },
  { id: 'rd-throwaway', name: 'Throwaway Account', desc: 'Let your intern post about the company anonymously. The username was her name. It was a start.', hint: 'Somebody posts about you. Anonymously.', when: atLeast('throwaways', 1) },
  { id: 'rd-power-mod', name: 'Power Mod', desc: 'Accept a moderator job. Ban four. Unban three. Write rule nine. Rule nine bans the topic.', hint: 'Take a small job with small power.', secret: true, when: atLeast('mod_jobs', 1) },
  { id: 'rd-instructions-unclear', name: 'Instructions Unclear', desc: 'Have an incident after a Friday deploy. The note said do not touch. Someone touched.', hint: 'Deploy on a Friday. Then suffer.', when: atLeast('friday_incidents', 1) },
  { id: 'rd-wendys', name: "Sir, This Is A Wendy's", desc: 'Post to the wrong subreddit. Make eleven friends who miss dial up modems.', hint: 'Post in the wrong place. Be welcomed anyway.', when: atLeast('wrong_subs', 1) },
  { id: 'rd-rule-three', name: 'Rule Three', desc: 'Get warned by the mods twice. Rule three is still one line. You are still arguing about it.', hint: 'The mods have asked twice.', when: atLeast('mod_warnings', 2) },
  { id: 'rd-do-not-share', name: 'Please Do Not Share This', desc: 'Ask the internet not to look at your worst bug. It looked. It brought snacks.', hint: 'Ask nicely. Be ignored.', when: atLeast('shared_anyway', 1) },
  { id: 'rd-brigaded', name: 'Brigaded', desc: 'Survive a brigade. Eight hundred strangers downvoted the weather report. You were the weather.', hint: 'A rival forum finds your thread.', when: atLeast('brigades', 1) },
  { id: 'rd-comments-first', name: 'Read The Comments First', desc: 'See ninety events. Never open the link. The comments told you everything.', hint: 'Skip the link. Read everything else.', when: atLeast('events_seen', 90) },
];
