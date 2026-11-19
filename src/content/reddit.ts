import type { StatKey, ThreadCtx, Vignette } from './types';
import { vo, type VoiceLine } from './vo';
import { NICHES } from './niches';

/**
 * The Reddit tropes pack. New vignettes, the OP's closing edits, the bot's removal
 * notices and a handful of flavor lines. Everything here is typed data, merged into the
 * arrays the game reads by `index.ts`. Ids all start with `rd-` so they never clash.
 *
 * Staff names are never spoken (a hired senior gets a random name), only Chad is.
 */

/* ------------------------------------------------------------------ helpers
 * The same tiny predicate builders threads.ts uses, kept private to each file.
 */
type When = (c: ThreadCtx) => boolean;

const always: When = () => true;
const low = (k: StatKey, n = 35): When => (c) => c.project.stats[k] < n;
const all = (...ps: When[]): When => (c) => ps.every((p) => p(c));
const some = (...ps: When[]): When => (c) => ps.some((p) => p(c));
const not = (p: When): When => (c) => !p(c);
const kind = (...ids: string[]): When => (c) => ids.includes(c.project.kind);
const tool = (...ids: string[]): When => (c) => ids.includes(c.project.tool);
const channel = (...ids: string[]): When => (c) => ids.includes(c.project.channel);
const quality = (min: number, max = 100): When => (c) => c.project.quality >= min && c.project.quality <= max;
const hype = (min: number, max = 100): When => (c) => c.project.hype >= min && c.project.hype <= max;
const messy = (n: number): When => (c) => c.company.spaghetti > n;
const has = (archetype: string): When => (c) => c.company.hasArchetype(archetype);
const friday: When = (c) => c.project.fridayDeploy;
const shipped = (n: number): When => (c) => c.company.appsShipped >= n;
const karmaOver = (n: number): When => (c) => c.company.karma >= n;
const fullScope: When = (c) => c.project.scope === 'full';
const cursed: When = (c) => NICHES.find((n) => n.id === c.project.niche)?.curses.includes(c.project.kind) ?? false;

/* --------------------------------------------------------------- vignettes */

export const REDDIT_VIGNETTES: Vignette[] = [
  /* ================================================== the furniture, anywhere */
  { id: 'rd-edit-grandma', topic: 'edit', tone: 'praise', judges: 'overall', weight: 2, when: quality(45),
    comments: [
      { user: 'u/GrandmaDoesCode', depth: 0, votes: [600, 3400], awards: ['wholesome', 'gold'],
        line: vo('grandma', 'Edit: thank you for the gold, dear stranger. Edit: my grandson says I should not talk to you. Edit: too late. You are lovely.') },
      { user: 'u/GameMakerKid10', depth: 1, votes: [200, 1900],
        line: vo('kid', 'Never take gold from strangers! That is rule one of the internet! Also rule two!') },
    ] },
  { id: 'rd-mod-sticky', topic: 'mod-sticky', tone: 'neutral', judges: 'overall', weight: 2, when: hype(40),
    comments: [
      { user: 'u/AutoModerator', flair: 'Mod', depth: 0, votes: [1, 90],
        line: vo('automod', 'Stickied by the moderators. Rule one: be nice. Rule two: see rule one. Rule three: the mods are asleep.', 'flat, reading a notice') },
      { user: 'u/LetMeSpeakToManager', depth: 1, votes: [100, 1400],
        line: vo('karen', 'I want to report rule three! Who moderates the moderators? Get me that person!') },
      { user: 'u/AutoModerator', flair: 'Mod', depth: 2, votes: [200, 1800],
        line: vo('automod', 'That is also me. I am a bot. I am also asleep.', 'flat, a little proud') },
    ] },
  { id: 'rd-remindme', topic: 'remindme', tone: 'neutral', judges: 'hype', weight: 2.2, when: hype(35),
    comments: [
      { user: 'u/DoomScrollDev', depth: 0, votes: [300, 2400],
        line: vo('doomer', 'RemindMe! One year. I want to be disappointed on schedule.', 'flat') },
      { user: 'u/RemindMeBot', flair: 'Bot', depth: 1, votes: [100, 1800],
        line: vo('automod', 'I will be messaging you in one year. Nine hundred others clicked the link. It will be a crowded disappointment.') },
      { user: 'u/ClodFan99', depth: 2, votes: [90, 1300],
        line: vo('clod', 'I will remind you in one year! Wait. Who are you? What was I reminding you about? Hi! I am Clod!', 'fresh, blank, happy') },
    ] },
  { id: 'rd-cake-day', topic: 'cake', tone: 'praise', judges: 'vibes', weight: 1.8, when: always,
    comments: [
      { user: 'u/DoomScrollDev', depth: 0, votes: [200, 1700],
        line: vo('doomer', "It's my cake day. Fifteen years on this site. No cake. Just a thread.", 'flat') },
      { user: 'u/WholesomeWendy', depth: 1, votes: [300, 2200], awards: ['wholesome'],
        line: vo('wholesome', 'Happy cake day! I made you a cake! It is a screenshot of a cake! I hope you like screenshots!') },
      { user: 'u/CakeDayBot', flair: 'Bot', depth: 2, votes: [1, 60],
        line: vo('automod', 'Happy cake day. This message was sent to everyone. Cake is not included. Cake was never included.') },
    ] },
  { id: 'rd-hug-of-death', topic: 'hug', tone: 'chaos', judges: 'stability', weight: 3.5, when: all(hype(55), low('stability', 62)),
    comments: [
      { user: 'u/DoomScrollDev', depth: 0, votes: [600, 3800],
        line: vo('doomer', 'Site is down for me. Does anyone have a mirror? A cache? A photo of the site?', 'flat') },
      { user: 'u/InTheWildDevs', flair: 'Narrator', depth: 1, votes: [400, 3000], awards: ['deceased'],
        line: vo('narrator', 'The server meets the crowd. It lasts four seconds. Its last words are: bad gateway.') },
      { user: 'u/WholesomeWendy', depth: 2, votes: [150, 1500], awards: ['wholesome'],
        line: vo('wholesome', 'Wait, it was hugged to death? Who hugged it? Was it a long hug? Did it say goodbye?') },
      { user: 'u/InternOnDay1', flair: 'Intern', depth: 1, votes: [200, 1800],
        line: vo('jenny', 'I restarted it! It came back! Then they hugged it again! I restarted it! Is this a game?') },
    ] },
  { id: 'rd-this-is-the-way', topic: 'way', tone: 'chaos', judges: 'vibes', weight: 2, when: always,
    comments: [
      { user: 'u/TenXBro', flair: '10x', depth: 0, votes: [200, 1700],
        line: vo('bro', 'He deleted the tests so the build passes. Bro. This is the way.') },
      { user: 'u/ClodFan99', depth: 1, votes: [100, 1200],
        line: vo('clod', 'This is the way! And the way is green! It is the greenest build I have ever made!') },
      { user: 'u/DoomScrollDev', depth: 2, votes: [250, 2000],
        line: vo('doomer', 'That is not the way. That is a trapdoor with a sign that says way.', 'flat') },
    ] },
  { id: 'rd-source', topic: 'source', tone: 'neutral', judges: 'hype', weight: 2, when: always,
    comments: [
      { user: 'u/WellActuallyGuy', flair: 'Actually', depth: 0, votes: [150, 1500],
        line: vo('pedant', 'Source?') },
      { user: 'u/ClodFan99', depth: 1, votes: [80, 1000],
        line: vo('clod', 'Source: I read it somewhere! I am almost sure it existed! I am very sure it sounded right!') },
      { user: 'u/GrandmaDoesCode', depth: 2, votes: [100, 1300],
        line: vo('grandma', 'My source is Doris. She heard it at the pharmacy. Very reliable woman, dear.') },
      { user: 'u/TenXBro', depth: 2, votes: [300, 2400], awards: ['gold'],
        line: vo('bro', 'Source: trust me bro. Honestly the strongest one here. Also the only honest one.') },
    ] },
  { id: 'rd-username-accept', topic: 'username2', tone: 'neutral', judges: 'stability', weight: 1.5, when: always,
    comments: [
      { user: 'u/AcceptAllChanges', flair: 'Intern', depth: 0, votes: [100, 1100],
        line: vo('jenny', 'I never read the changes. I just press the green button. Green means good, right?') },
      { user: 'u/WellActuallyGuy', flair: 'Actually', depth: 1, votes: [300, 2400],
        line: vo('pedant', 'Well, actually, that username is not a joke. It is a mission statement. It is also a confession.') },
      { user: 'u/AcceptAllChanges', flair: 'Intern', depth: 2, votes: [100, 1200],
        line: vo('jenny', 'Oh no. Did I just accept that? I think I accepted that. Sorry!', 'anxious, fast') },
    ] },
  { id: 'rd-wendys', topic: 'wendys', tone: 'chaos', judges: 'overall', weight: 1.8, when: always,
    comments: [
      { user: 'u/ArchBTW_2012', flair: 'Arch User', depth: 0, votes: [100, 1100],
        line: vo('arch', 'Let me explain my window manager. I wrote it in two thousand fourteen. It has one window. It is my whole personality.') },
      { user: 'u/DoomScrollDev', depth: 1, votes: [400, 3000], awards: ['gold'],
        line: vo('doomer', "Sir. This is a Wendy's.", 'flat') },
      { user: 'u/GrandmaDoesCode', depth: 2, votes: [150, 1500], awards: ['wholesome'],
        line: vo('grandma', 'Is there a Frosty? Your grandfather loved the Frosty. Can somebody get me a Frosty, dear?') },
      { user: 'u/RubberDuck_Prod', flair: 'Duck', depth: 2, votes: [200, 1700],
        line: vo('duck', 'Quack. Quack quack. Quack.', 'ordering at the drive through') },
    ] },
  { id: 'rd-not-reading', topic: 'wall', tone: 'roast', judges: 'overall', weight: 2, when: some(messy(25), fullScope),
    comments: [
      { user: 'u/OneStarKaren', depth: 0, votes: [100, 1200],
        line: vo('karen', 'I wrote four thousand words. The title is Unacceptable. The body is Unacceptable. The conclusion is a refund.') },
      { user: 'u/DoomScrollDev', depth: 1, votes: [400, 3000],
        line: vo('doomer', "I'm not reading all that. Happy for you, or sorry that happened.", 'flat') },
      { user: 'u/ClodFan99', depth: 2, votes: [100, 1100],
        line: vo('clod', 'Here is a summary! Unacceptable! I removed three thousand nine hundred ninety nine words. You are welcome!') },
    ] },
  { id: 'rd-instructions-unclear', topic: 'instructions', tone: 'chaos', judges: 'stability', weight: 2.2, when: some(has('intern'), friday, messy(35)),
    comments: [
      { user: 'u/InternOnDay1', flair: 'Intern', depth: 0, votes: [200, 1800],
        line: vo('jenny', 'Instructions unclear. The note said do not touch. I touched it. It was production.') },
      { user: 'u/ClodSaidItsFine', depth: 1, votes: [100, 1300],
        line: vo('clod', 'Instructions unclear! I deployed to production! And staging! And a smart toaster in Norway!') },
      { user: 'u/ClosedAsDuplicate', flair: 'Ghost', depth: 2, votes: [200, 1700],
        line: vo('ghost', 'Closed as a duplicate of: instructions unclear, shipped to prod, two thousand eleven. Same intern.') },
    ] },
  { id: 'rd-comments-first', topic: 'comments', tone: 'neutral', judges: 'hype', weight: 1.8, when: always,
    comments: [
      { user: 'u/DoomScrollDev', depth: 0, votes: [200, 1600],
        line: vo('doomer', "I did not open the link. The comments told me everything. It's down, it's a wrapper, and it shipped on a Friday.", 'flat') },
      { user: 'u/WellActuallyGuy', flair: 'Actually', depth: 1, votes: [150, 1400],
        line: vo('pedant', 'Well, actually, that is the correct way to use the internet. The link is the spoiler.') },
      { user: 'u/InTheWildDevs', flair: 'Narrator', depth: 2, votes: [200, 1700],
        line: vo('narrator', 'The link, unopened, remains both brilliant and broken. This is how all apps should be judged.') },
    ] },
  { id: 'rd-first', topic: 'first', tone: 'neutral', judges: 'hype', weight: 2.2, when: hype(0, 45),
    comments: [
      { user: 'u/GameMakerKid10', depth: 0, votes: [20, 300], awards: ['wholesome'],
        line: vo('kid', 'First! Mom! I got first! On the whole internet!') },
      { user: 'u/AutoModerator', flair: 'Mod', depth: 1, votes: [1, 60],
        line: vo('automod', 'Congratulations on being first. Your prize is in the backlog. Estimated delivery: never.') },
    ] },
  { id: 'rd-underrated', topic: 'underrated', tone: 'praise', judges: 'overall', weight: 2, when: always,
    comments: [
      { user: 'u/ArchBTW_2012', flair: 'Arch User', depth: 0, votes: [1, 14],
        line: vo('arch', 'The progress bar is the most honest part of this app. It never moves. It never lies.') },
      { user: 'u/WholesomeWendy', depth: 1, votes: [900, 5000], awards: ['gold', 'wholesome'],
        line: vo('wholesome', 'Underrated comment!') },
      { user: 'u/ArchBTW_2012', flair: 'Arch User', depth: 2, votes: [500, 3000],
        line: vo('arch', 'Edit: wow, gold! Edit two: it was meant for the other guy. Edit three: he deserved it. He is a good man.', 'strained, forced cheer') },
    ] },
  { id: 'rd-joke-or-serious', topic: 'poe', tone: 'chaos', judges: 'overall', weight: 3, when: some(cursed, kind('os', 'dapp', 'wrapper'), quality(0, 35)),
    comments: [
      { user: 'u/ArchBTW_2012', flair: 'Arch User', depth: 0, votes: [300, 2400],
        line: vo('arch', 'I honestly cannot tell if this is satire or a real product.') },
      { user: 'u/ShipItChad', flair: 'Founder', depth: 1, votes: [150, 1500],
        line: vo('chad', 'Yes. That is the whole pitch.') },
      { user: 'u/WellActuallyGuy', flair: 'Actually', depth: 2, votes: [300, 2500], awards: ['gold'],
        line: vo('pedant', "Well, actually, that is Poe's law. A parody of a startup is just a startup with fewer slides.") },
    ] },
  { id: 'rd-crosspost', topic: 'crosspost', tone: 'neutral', judges: 'hype', weight: 2, when: all(not(channel('humor', 'quiet')), hype(30)),
    comments: [
      { user: 'u/DoomScrollDev', depth: 0, votes: [200, 1700],
        line: vo('doomer', "I came from the crosspost on Programmer Humor. There, it's a joke. Here, it has a pricing page.", 'flat') },
      { user: 'u/TenXBro', depth: 1, votes: [100, 1200],
        line: vo('bro', 'Bro, the pricing page is the funniest part. Twelve ninety nine a month for the punchline.') },
    ] },
  { id: 'rd-repost', topic: 'repost', tone: 'roast', judges: 'overall', weight: 2, when: shipped(1),
    comments: [
      { user: 'u/WellActuallyGuy', flair: 'Actually', depth: 0, votes: [200, 1800],
        line: vo('pedant', 'Repost. I have seen this exact launch four times. Same app. Same screenshots. New name.') },
      { user: 'u/ShipItChad', flair: 'Founder', depth: 1, votes: [100, 1100],
        line: vo('chad', 'It is not a repost. It is a sequel. Sequels always do better.') },
      { user: 'u/InTheWildDevs', flair: 'Narrator', depth: 2, votes: [200, 1700],
        line: vo('narrator', 'The sequel, like the salmon, returns each year to the place of its birth, to spawn the same thing again.') },
    ] },
  { id: 'rd-aita-friday', topic: 'aita', tone: 'chaos', judges: 'stability', weight: 3, when: friday,
    comments: [
      { user: 'u/InternOnDay1', flair: 'Intern', depth: 0, votes: [300, 2400],
        line: vo('jenny', 'A-I-T-A for deploying on a Friday? My team stopped speaking to me. The pager did not.') },
      { user: 'u/WellActuallyGuy', flair: 'Actually', depth: 1, votes: [400, 3000], awards: ['gold'],
        line: vo('pedant', 'E-S-H. The intern pushed, the senior approved, the founder suggested, the robot wrote it, and the database knew.') },
      { user: 'u/DoomScrollDev', depth: 2, votes: [300, 2300],
        line: vo('doomer', 'Y-T-A. Not for the deploy. For reading comments on a Saturday. Close the laptop.', 'flat') },
    ] },
  { id: 'rd-tifu-throwaway', topic: 'tifu', tone: 'chaos', judges: 'security', weight: 2.2, when: some(messy(30), tool('cursed', 'terminal', 'swarm')),
    comments: [
      { user: 'u/Throwaway_Intern', flair: 'Throwaway', depth: 0, votes: [300, 2500],
        line: vo('jenny', 'Throwaway, because my coworkers read this. T-I-F-U by letting the AI write my migration. I now have a table called final final users.') },
      { user: 'u/Throwaway_Intern', flair: 'Throwaway', depth: 1, votes: [100, 1300],
        line: vo('jenny', 'Update: my coworkers found this post. The senior one is typing. He has been typing a long time. Oh no.') },
      { user: 'u/SeniorDave_42', flair: 'Staff Engineer', depth: 2, votes: [500, 3400], awards: ['facepalm'],
        line: vo('dave', 'I am not typing a comment. I am restoring from backup. The backup is from March.', 'deadpan') },
    ] },
  { id: 'rd-eli5-database', topic: 'eli5', tone: 'neutral', judges: 'overall', weight: 1.5, when: always,
    comments: [
      { user: 'u/InternOnDay1', flair: 'Intern', depth: 0, votes: [100, 1100],
        line: vo('jenny', 'E-L-I five: what is a database? Sorry, I am the intern. Five is close.') },
      { user: 'u/WellActuallyGuy', flair: 'Actually', depth: 1, votes: [150, 1300],
        line: vo('pedant', 'A relational database is a set of normalized tuples with referential integrity, and I will now continue for an hour.') },
      { user: 'u/GameMakerKid10', depth: 2, votes: [300, 2400], awards: ['wholesome'],
        line: vo('kid', 'It is a big backpack where the app puts its stuff so it does not forget. You are welcome!') },
    ] },
  { id: 'rd-til-git', topic: 'til', tone: 'neutral', judges: 'overall', weight: 1.8, when: always,
    comments: [
      { user: 'u/InternOnDay1', flair: 'Intern', depth: 0, votes: [150, 1500],
        line: vo('jenny', 'T-I-L you can undo a commit. I have been deleting the folder and cloning it again. Fourteen times a day.') },
      { user: 'u/BtwIUseArch', flair: 'Arch User', depth: 1, votes: [200, 1700],
        line: vo('arch', 'I clone into folders named backup, backup two, and backup final. It is a ritual. It has never helped.') },
    ] },
  { id: 'rd-as-a', topic: 'as-a', tone: 'neutral', judges: 'overall', weight: 1.8, when: always,
    comments: [
      { user: 'u/DoomScrollDev', depth: 0, votes: [200, 1600],
        line: vo('doomer', 'As a developer with twenty years of experience, I can confirm that I have no idea what is going on.', 'flat') },
      { user: 'u/GameMakerKid10', depth: 1, votes: [200, 1700], awards: ['wholesome'],
        line: vo('kid', 'As a ten year old with ten years of experience, same!') },
      { user: 'u/GrandmaDoesCode', depth: 2, votes: [200, 1800],
        line: vo('grandma', 'As an eighty three year old with no experience, I pressed everything. Now I am in charge.') },
    ] },
  { id: 'rd-spelled', topic: 'spelling', tone: 'roast', judges: 'polish', weight: 2.4, when: low('polish', 55),
    comments: [
      { user: 'u/WellActuallyGuy', flair: 'Actually', depth: 0, votes: [200, 1700],
        line: vo('pedant', 'Well, actually, it is spelled S-E-P-A-R-A-T-E. The settings page says S-E-P-E-R-A-T-E. Four times. It is committed.') },
      { user: 'u/ClodFan99', depth: 1, votes: [100, 1100],
        line: vo('clod', 'Great catch! I fixed it! It is now spelled S-E-P-E-R-E-T-E. At least it is consistent!') },
      { user: 'u/WholesomeWendy', depth: 2, votes: [120, 1200], awards: ['wholesome'],
        line: vo('wholesome', 'Be kind! A typo is just a word that is still finding itself.') },
    ] },
  { id: 'rd-karma-farm', topic: 'karma-farm', tone: 'roast', judges: 'hype', weight: 2, when: some(karmaOver(150), hype(50)),
    comments: [
      { user: 'u/DoomScrollDev', depth: 0, votes: [200, 1700],
        line: vo('doomer', 'This is karma farming. Nine a.m. Eastern. A number in the title. An Edit already at the top.', 'flat') },
      { user: 'u/WellActuallyGuy', flair: 'Actually', depth: 1, votes: [400, 3000], awards: ['gold'],
        line: vo('pedant', 'Well, actually, he wrote thanks for the gold before anyone gave gold. That is not farming. That is crop insurance.') },
    ] },
  { id: 'rd-new-account', topic: 'new-account', tone: 'roast', judges: 'hype', weight: 2, when: hype(35),
    comments: [
      { user: 'u/RegularHumanMan', flair: 'New Account', depth: 0, votes: [20, 400],
        line: vo('bro', 'As a regular human man with a normal account, I love this app. I eat food. With my mouth. Please upvote.') },
      { user: 'u/WellActuallyGuy', flair: 'Actually', depth: 1, votes: [300, 2400],
        line: vo('pedant', 'Well, actually, the account is four minutes old. Same as the app. Same as the opinion.') },
      { user: 'u/RootedYourBox', flair: 'Hooded', depth: 2, votes: [200, 1700], awards: ['deceased'],
        line: vo('hacker', 'Do not look at me. I only made nine of them.', 'cool, a little too fast') },
    ] },
  { id: 'rd-aged-well', topic: 'aged', tone: 'chaos', judges: 'overall', weight: 1.8, when: always,
    comments: [
      { user: 'u/TenXBro', flair: '10x', depth: 0, votes: [150, 1300],
        line: vo('bro', 'In ten years, they will say this was the day it all started. Bookmark this, bro.') },
      { user: 'u/WellActuallyGuy', flair: 'Actually', depth: 1, votes: [250, 2000],
        line: vo('pedant', 'This aged well.') },
      { user: 'u/InternOnDay1', flair: 'Intern', depth: 2, votes: [100, 1100],
        line: vo('jenny', 'It has been eleven minutes. Is that long enough? Do we say it now?') },
      { user: 'u/InTheWildDevs', flair: 'Narrator', depth: 2, votes: [300, 2400],
        line: vo('narrator', 'On the internet, eleven minutes is a geological age. Whole empires have risen, and been downvoted.') },
    ] },
  { id: 'rd-summary-bot', topic: 'bots', tone: 'neutral', judges: 'overall', weight: 1.8, when: always,
    comments: [
      { user: 'u/TLDR_Bot', flair: 'Bot', depth: 0, votes: [100, 1500],
        line: vo('automod', 'Summary of this thread: it crashed, people were mean, someone mentioned Rust. I am a bot. This is every thread.') },
      { user: 'u/WholesomeWendy', depth: 1, votes: [100, 1100], awards: ['wholesome'],
        line: vo('wholesome', 'Good bot! Who is a good bot? You are! Yes you are!') },
      { user: 'u/DoomScrollDev', depth: 2, votes: [300, 2400],
        line: vo('doomer', 'Bad bot. It summarized my four paragraph comment as: sad. It was right.', 'flat') },
    ] },
  { id: 'rd-removed', topic: 'removed', tone: 'chaos', judges: 'overall', weight: 1.8, when: always,
    comments: [
      { user: 'u/AutoModerator', flair: 'Mod', depth: 0, votes: [2000, 9000],
        line: vo('automod', 'Removed by moderators. Rule seven: no jokes that work.', 'flat, reading a notice') },
      { user: 'u/InternOnDay1', flair: 'Intern', depth: 1, votes: [100, 1200],
        line: vo('jenny', 'What did it say?! It had nine thousand upvotes! Did anybody screenshot it?') },
      { user: 'u/ClosedAsDuplicate', flair: 'Ghost', depth: 2, votes: [300, 2300], awards: ['deceased'],
        line: vo('ghost', 'I saw it before it was removed. It was very good. I will not repeat it. That is how I got here.') },
    ] },
  { id: 'rd-unpopular', topic: 'unpopular', tone: 'neutral', judges: 'overall', weight: 1.8, when: always,
    comments: [
      { user: 'u/ArchBTW_2012', flair: 'Arch User', depth: 0, votes: [3000, 9000], awards: ['gold'],
        line: vo('arch', 'Unpopular opinion: software should work.') },
      { user: 'u/WellActuallyGuy', flair: 'Actually', depth: 1, votes: [400, 3000],
        line: vo('pedant', 'Well, actually, it has nine thousand upvotes. That is not an unpopular opinion. That is a demand.') },
      { user: 'u/ClodFan99', depth: 2, votes: [100, 1100],
        line: vo('clod', 'Great opinion! I have made your software work! It now says that it works!') },
    ] },
  { id: 'rd-poor-mans-award', topic: 'award', tone: 'praise', judges: 'overall', weight: 2, when: quality(40),
    comments: [
      { user: 'u/TenXBro', flair: '10x', depth: 0, votes: [300, 2400],
        line: vo('bro', 'Have my free award. It is an upvote. It is all I have. I am between jobs. Bro, I am between everything.') },
      { user: 'u/WholesomeWendy', depth: 1, votes: [300, 2200], awards: ['wholesome'],
        line: vo('wholesome', 'I will cherish it! It is the nicest thing a stranger has ever given another stranger!') },
      { user: 'u/AngelAtLarge', flair: 'Angel Investor', depth: 2, votes: [100, 1200],
        line: vo('vc', 'A free award. Interesting. What is the burn rate on goodwill?') },
    ] },
  { id: 'rd-eleven-seconds', topic: 'nice', tone: 'praise', judges: 'vibes', weight: 1.8, when: quality(55),
    comments: [
      { user: 'u/GameMakerKid10', depth: 0, votes: [400, 3000], awards: ['wholesome'],
        line: vo('kid', 'This is why I love the internet! A man made a thing! And nobody was mean! For eleven seconds!') },
      { user: 'u/InTheWildDevs', flair: 'Narrator', depth: 1, votes: [500, 3500], awards: ['gold'],
        line: vo('narrator', 'Twelve seconds later, somebody was mean. It was the usual somebody. He had been waiting by the door.') },
    ] },
  { id: 'rd-take-my-money', topic: 'money', tone: 'praise', judges: 'overall', weight: 2, when: quality(60),
    comments: [
      { user: 'u/TenXBro', flair: '10x', depth: 0, votes: [500, 3500], awards: ['gold'],
        line: vo('bro', 'Shut up and take my money! Where is the buy button? I am holding the money! Bro! Bro!') },
      { user: 'u/ShipItChad', flair: 'Founder', depth: 1, votes: [200, 1800],
        line: vo('chad', 'There is no buy button yet. It is on the roadmap. We do accept hugs.') },
      { user: 'u/WholesomeWendy', depth: 2, votes: [300, 2200], awards: ['wholesome'],
        line: vo('wholesome', 'Hug sent! I sent eleven! Please check your hug balance!') },
    ] },

  /* ================================================== Quiet Launch, your own blog */
  { id: 'rd-quiet-spam', topic: 'channel', tone: 'neutral', judges: 'hype', weight: 4, when: channel('quiet'),
    comments: [
      { user: 'u/FreeSpins4U', flair: 'Spam', depth: 0, votes: [1, 6],
        line: vo('hacker', 'Great post! I loved the part about the thing. Visit my casino for free spins.', 'cheerful, scripted') },
      { user: 'u/WholesomeWendy', depth: 1, votes: [3, 40], awards: ['wholesome'],
        line: vo('wholesome', 'Your first comment! Congratulations! Somebody read the title!') },
      { user: 'u/InTheWildDevs', flair: 'Narrator', depth: 2, votes: [4, 50],
        line: vo('narrator', 'The founder reads it twice. It is the nicest thing anyone has ever said about his work. It is also a casino.') },
    ] },
  { id: 'rd-quiet-rss', topic: 'channel', tone: 'neutral', judges: 'hype', weight: 4, when: channel('quiet'),
    comments: [
      { user: 'u/RSS_Is_Not_Dead', flair: 'Arch User', depth: 0, votes: [2, 40],
        line: vo('arch', 'I read this in my terminal R-S-S reader. You have one subscriber. It is me. The pressure is enormous.') },
      { user: 'u/InternOnDay1', flair: 'Intern', depth: 1, votes: [2, 30],
        line: vo('jenny', 'What is R-S-S? Is it a sandwich? Can I subscribe to a sandwich?') },
      { user: 'u/ClosedAsDuplicate', flair: 'Ghost', depth: 2, votes: [4, 60],
        line: vo('ghost', 'Closed as a duplicate of: blogs, two thousand four. The original had more readers.') },
    ] },
  { id: 'rd-quiet-analytics', topic: 'channel', tone: 'roast', judges: 'hype', weight: 4, when: channel('quiet'),
    comments: [
      { user: 'u/InTheWildDevs', flair: 'Narrator', depth: 0, votes: [4, 60],
        line: vo('narrator', 'The founder refreshes the analytics. One visitor. He refreshes again. Still one. It is him.') },
      { user: 'u/WholesomeWendy', depth: 1, votes: [3, 50], awards: ['wholesome'],
        line: vo('wholesome', 'That is a one hundred percent engagement rate! He read all of it!') },
      { user: 'u/DoomScrollDev', depth: 2, votes: [6, 90],
        line: vo('doomer', 'He also left. Bounce rate: one hundred percent. A perfect score in both directions.', 'flat') },
    ] },

  /* ================================================== r/SideProject */
  { id: 'rd-sp-validate', topic: 'channel', tone: 'neutral', judges: 'hype', weight: 4, when: channel('sideproject'),
    comments: [
      { user: 'u/AngelAtLarge', flair: 'Angel Investor', depth: 0, votes: [20, 300],
        line: vo('vc', 'Love the hustle. Did you talk to a hundred customers before building this? Be honest. I will know.') },
      { user: 'u/ShipItChad', flair: 'Founder', depth: 1, votes: [30, 400],
        line: vo('chad', 'I talked to one. He was in an elevator. He nodded. I read it as demand.') },
      { user: 'u/AngelAtLarge', flair: 'Angel Investor', depth: 2, votes: [60, 800],
        line: vo('vc', 'A nod is a leading indicator. I am funding the elevator.') },
    ] },
  { id: 'rd-sp-mrr', topic: 'channel', tone: 'roast', judges: 'hype', weight: 4, when: channel('sideproject'),
    comments: [
      { user: 'u/TenXBro', flair: 'Maker', depth: 0, votes: [10, 160],
        line: vo('bro', 'Day ninety of building in public. We hit two dollars M-R-R. Never quit, bro.') },
      { user: 'u/DoomScrollDev', depth: 1, votes: [40, 600],
        line: vo('doomer', 'Two dollars. After tax that is one dollar and a feeling.', 'flat') },
      { user: 'u/TenXBro', flair: 'Maker', depth: 2, votes: [10, 200],
        line: vo('bro', 'Bro, it is recurring. Recurring is the whole point. Bro, I am basically a bank.') },
    ] },
  { id: 'rd-sp-weekly', topic: 'channel', tone: 'roast', judges: 'overall', weight: 4, when: channel('sideproject'),
    comments: [
      { user: 'u/AutoModerator', flair: 'Mod', depth: 0, votes: [1, 70],
        line: vo('automod', 'Your post was removed. Self promotion is only allowed in the weekly thread. This is the weekly thread.') },
      { user: 'u/InternOnDay1', flair: 'Intern', depth: 1, votes: [40, 500],
        line: vo('jenny', 'But I am in the weekly thread! I posted here! Why was I removed from the thing I am in?') },
      { user: 'u/AutoModerator', flair: 'Mod', depth: 2, votes: [1, 50],
        line: vo('automod', 'Thank you for your feedback. Please post it in the weekly thread.') },
    ] },

  /* ================================================== Show HN */
  { id: 'rd-hn-sqlite', topic: 'channel', tone: 'roast', judges: 'features', weight: 4, when: channel('hn'),
    comments: [
      { user: 'u/ArchBTW_2012', flair: 'Arch User', depth: 0, votes: [600, 4200], awards: ['gold'],
        line: vo('arch', 'I would have used SQLite. For the database. For the cache. For the logo.') },
      { user: 'u/WellActuallyGuy', flair: 'Actually', depth: 1, votes: [300, 2500],
        line: vo('pedant', 'Well, actually, a flat text file would have been simpler.') },
      { user: 'u/RootedYourBox', flair: 'Hooded', depth: 2, votes: [500, 3500],
        line: vo('hacker', 'I keep it all in my head. Zero latency. Zero cost. Zero backups.') },
    ] },
  { id: 'rd-hn-wrapper', topic: 'channel', tone: 'roast', judges: 'features', weight: 4, when: channel('hn'),
    comments: [
      { user: 'u/ViewSourceGuy', flair: 'Arch User', depth: 0, votes: [500, 3600],
        line: vo('arch', 'So this is just a wrapper over curl, which is a wrapper over sockets, which is a wrapper over electricity.') },
      { user: 'u/TenXBro', depth: 1, votes: [150, 1400],
        line: vo('bro', 'Bro. If everything is a wrapper, then what is not a wrapper? Bro. Bro.') },
      { user: 'u/DoomScrollDev', depth: 2, votes: [300, 2500],
        line: vo('doomer', 'Vibes. At the very bottom, it is vibes. Please stop digging.', 'flat') },
    ] },
  { id: 'rd-hn-retitled', topic: 'channel', tone: 'neutral', judges: 'overall', weight: 4, when: channel('hn'),
    comments: [
      { user: 'u/HN_Moderator', flair: 'Mod', depth: 0, votes: [20, 300],
        line: vo('automod', 'The moderators have changed the title to something accurate. Please do not use the word revolutionary.') },
      { user: 'u/ShipItChad', flair: 'Founder', depth: 1, votes: [100, 1100],
        line: vo('chad', 'I love the new title. Is it still revolutionary?') },
      { user: 'u/HN_Moderator', flair: 'Mod', depth: 2, votes: [300, 2400], awards: ['gold'],
        line: vo('automod', 'No. It is a list of chores with a logo.', 'flat') },
    ] },
  { id: 'rd-hn-previously', topic: 'channel', tone: 'roast', judges: 'overall', weight: 4, when: channel('hn'),
    comments: [
      { user: 'u/WellActuallyGuy', flair: 'Actually', depth: 0, votes: [300, 2400],
        line: vo('pedant', 'Previously discussed: two thousand fourteen, four hundred comments. Two thousand nineteen, nine comments. Twenty twenty three, flagged.') },
      { user: 'u/InternOnDay1', flair: 'Intern', depth: 1, votes: [60, 800],
        line: vo('jenny', 'Flagged? Do we get to keep the flag? Is it a nice flag?') },
      { user: 'u/RootedYourBox', flair: 'Hooded', depth: 2, votes: [200, 1700],
        line: vo('hacker', 'I am in all three threads. Also flagged. It is a good club.') },
    ] },

  /* ================================================== Product Hunt */
  { id: 'rd-ph-maker-story', topic: 'channel', tone: 'praise', judges: 'hype', weight: 4, when: channel('ph'),
    comments: [
      { user: 'u/ShipItChad', flair: 'Maker', depth: 0, votes: [200, 1800], awards: ['wholesome'],
        line: vo('chad', 'Three months ago my dog got sick, so I quit my job. The dog is fine. The job is gone. Here is the app.', 'breathless, sincere') },
      { user: 'u/OneStarKaren', depth: 1, votes: [100, 1100],
        line: vo('karen', 'Where is the dog? I came here for the dog! I demand pictures of the dog!') },
      { user: 'u/WholesomeWendy', depth: 2, votes: [200, 1600], awards: ['wholesome'],
        line: vo('wholesome', 'The dog should be the C-E-O! A dog has never once deployed on a Friday!') },
    ] },
  { id: 'rd-ph-integrations', topic: 'channel', tone: 'praise', judges: 'features', weight: 4, when: channel('ph'),
    comments: [
      { user: 'u/WholesomeWendy', depth: 0, votes: [100, 1100], awards: ['wholesome'],
        line: vo('wholesome', 'Congrats on the launch! Does it integrate with Slack?') },
      { user: 'u/TenXBro', flair: 'Maker', depth: 1, votes: [60, 800],
        line: vo('bro', 'Does it integrate with Zapier? With the thing that integrates with Zapier? Bro. Bro.') },
      { user: 'u/DoomScrollDev', depth: 2, votes: [250, 2000],
        line: vo('doomer', 'Does it integrate with my will to live? I think that integration was deprecated.', 'flat') },
    ] },
  { id: 'rd-ph-product-of-day', topic: 'channel', tone: 'neutral', judges: 'hype', weight: 4, when: channel('ph'),
    comments: [
      { user: 'u/VibeyAwards', flair: 'Staff', depth: 0, votes: [100, 1100],
        line: vo('announcer', 'And today is a to-do app! In second, a to-do app with a robot! In third, a robot with a to-do app!', 'game show host') },
      { user: 'u/TenXBro', flair: 'Maker', depth: 1, votes: [60, 700],
        line: vo('bro', 'Bro, I came fourth. I was a to-do app. It had a robot in it. It was a different robot.') },
      { user: 'u/MoatMaven', flair: 'VC', depth: 2, votes: [100, 1100],
        line: vo('vc', 'A different robot? That is a moat.') },
    ] },

  /* ================================================== r/ProgrammerHumor */
  { id: 'rd-humor-not-a-meme', topic: 'channel', tone: 'roast', judges: 'overall', weight: 4, when: channel('humor'),
    comments: [
      { user: 'u/AutoModerator', flair: 'Mod', depth: 0, votes: [200, 2500],
        line: vo('automod', 'Your post was removed. Rule one: all posts must be memes. This is a product. Please resubmit as a two panel meme.') },
      { user: 'u/ShipItChad', flair: 'Founder', depth: 1, votes: [400, 3500], awards: ['gold'],
        line: vo('chad', 'Fine. Top panel: bugs. Bottom panel: features. Same app. I am a meme now.') },
    ] },
  { id: 'rd-humor-light-mode', topic: 'channel', tone: 'roast', judges: 'polish', weight: 4, when: channel('humor'),
    comments: [
      { user: 'u/ArchBTW_2012', flair: 'Arch User', depth: 0, votes: [600, 4000], awards: ['facepalm'],
        line: vo('arch', 'The screenshot is in light mode. I need a moment. I need a lawyer.') },
      { user: 'u/WholesomeWendy', depth: 1, votes: [100, 1200], awards: ['wholesome'],
        line: vo('wholesome', 'I think it is cozy! It is like coding on a beach!') },
      { user: 'u/DoomScrollDev', depth: 2, votes: [400, 3000],
        line: vo('doomer', 'I do not go to the beach. The beach has light mode.', 'flat') },
    ] },
  { id: 'rd-humor-nobody', topic: 'channel', tone: 'chaos', judges: 'stability', weight: 4, when: channel('humor'),
    comments: [
      { user: 'u/TenXBro', flair: '10x', depth: 0, votes: [500, 3500],
        line: vo('bro', 'Nobody. Absolutely nobody. The founder at three in the morning: what if the button was a slightly different blue.') },
      { user: 'u/InTheWildDevs', flair: 'Narrator', depth: 1, votes: [700, 4200], awards: ['gold'],
        line: vo('narrator', 'The button became a slightly different blue. It was tested for eleven days. Nobody could tell. The founder could.') },
    ] },

  /* ================================================== LinkedIn */
  { id: 'rd-li-recursive', topic: 'channel', tone: 'roast', judges: 'hype', weight: 4, when: channel('linkedin'),
    comments: [
      { user: 'u/ThrilledAndHumbled', flair: 'Thought Leader', depth: 0, votes: [3000, 14000], awards: ['wholesome'],
        line: vo('linkedin', 'Thrilled and humbled to announce that I am humbled and thrilled. That is the whole announcement. Thoughts?', 'breathy, sincere') },
      { user: 'u/WellActuallyGuy', flair: 'Actually', depth: 1, votes: [800, 4000],
        line: vo('pedant', 'Well, actually, that is a loop with no exit condition. He will be thrilled forever.') },
      { user: 'u/DoomScrollDev', depth: 2, votes: [1000, 5000],
        line: vo('kid', 'Nine thousand people liked it! I read it twice! It goes round and round! That is my new favorite book!') },
    ] },
  { id: 'rd-li-janitor', topic: 'channel', tone: 'roast', judges: 'hype', weight: 4, when: channel('linkedin'),
    comments: [
      { user: 'u/ThrilledAndHumbled', flair: 'Thought Leader', depth: 0, votes: [2500, 12000],
        line: vo('linkedin', 'Yesterday a janitor taught me more about product market fit than any M-B-A. Then he asked me to leave the building.', 'breathy, sincere') },
      { user: 'u/LetMeSpeakToManager', depth: 1, votes: [300, 2500],
        line: vo('karen', 'I would like the number of that janitor. He sounds like the only manager in this thread.') },
      { user: 'u/WholesomeWendy', depth: 2, votes: [600, 3500], awards: ['wholesome'],
        line: vo('wholesome', 'Janitors are the real founders! They clean up everything we ship!') },
    ] },
  { id: 'rd-li-guide', topic: 'channel', tone: 'chaos', judges: 'hype', weight: 4, when: channel('linkedin'),
    comments: [
      { user: 'u/ThrilledAndHumbled', flair: 'Thought Leader', depth: 0, votes: [2000, 9000],
        line: vo('linkedin', 'Comment the word guide below and I will send you my free guide. Guide. Guide. Guide.', 'bright, breathless') },
      { user: 'u/TenXBro', depth: 1, votes: [300, 2400],
        line: vo('bro', 'Guide. Guide. Guide. Bro, I have commented guide four hundred times. Still no guide.') },
      { user: 'u/AutoModerator', flair: 'Bot', depth: 2, votes: [500, 3000], awards: ['gold'],
        line: vo('automod', 'Seventy thousand people commented guide. The guide is one page. It says: comment the word guide.') },
    ] },
  { id: 'rd-li-same-role', topic: 'channel', tone: 'praise', judges: 'overall', weight: 4, when: channel('linkedin'),
    comments: [
      { user: 'u/ThrilledAndHumbled', flair: 'Thought Leader', depth: 0, votes: [1500, 7000],
        line: vo('linkedin', 'Congratulations on the launch! Wishing you every success in your new role!', 'bright') },
      { user: 'u/ShipItChad', flair: 'Founder', depth: 1, votes: [300, 2400],
        line: vo('chad', 'It is not a new role. I am the founder. I have had this role for a year.') },
      { user: 'u/ThrilledAndHumbled', flair: 'Thought Leader', depth: 2, votes: [800, 4500], awards: ['wholesome'],
        line: vo('linkedin', 'Congratulations on the same role! Wishing you every success in the exact same role!', 'bright') },
    ] },

  /* ================================================== Influencer shoutout */
  { id: 'rd-inf-link-in-bio', topic: 'channel', tone: 'roast', judges: 'hype', weight: 4, when: channel('influencer'),
    comments: [
      { user: 'u/LinkInBio_Larry', flair: 'Sponsored', depth: 0, votes: [100, 900],
        line: vo('bro', 'Day thirty of using this app. Day one: it crashed. Day thirty: they hired me. Link in bio.') },
      { user: 'u/OneStarKaren', depth: 1, votes: [150, 1500],
        line: vo('karen', 'I clicked your bio! It is a picture of a horse! There is no link! There is only the horse!') },
      { user: 'u/InTheWildDevs', flair: 'Narrator', depth: 2, votes: [200, 1700],
        line: vo('narrator', 'The horse has never visited the website. The horse does not need to. The horse is at peace.') },
    ] },
  { id: 'rd-inf-giveaway', topic: 'channel', tone: 'chaos', judges: 'hype', weight: 4, when: channel('influencer'),
    comments: [
      { user: 'u/GiveawayBot', flair: 'Bot', depth: 0, votes: [20, 300],
        line: vo('automod', "Giveaway winner chosen by a fair and transparent process. The influencer's cousin pressed a button.") },
      { user: 'u/SeenItEverywhere', depth: 1, votes: [150, 1500],
        line: vo('karen', 'I entered four hundred times! I even tagged my mother! Her name is also Karen! This is rigged!') },
    ] },
  { id: 'rd-inf-algorithm', topic: 'channel', tone: 'neutral', judges: 'hype', weight: 4, when: channel('influencer'),
    comments: [
      { user: 'u/CommentForTheAlgo', flair: 'Sponsored', depth: 0, votes: [50, 600],
        line: vo('bro', 'Commenting for the algorithm. Hello, algorithm. I am a good comment. Please do not show me to my boss.') },
      { user: 'u/GrandmaDoesCode', depth: 1, votes: [250, 2000], awards: ['wholesome'],
        line: vo('grandma', 'The algorithm does not remember me either, dear. I asked it nicely. It showed me a recliner.') },
    ] },

  /* ================================================== Big ad campaign */
  { id: 'rd-ad-pharma', topic: 'channel', tone: 'roast', judges: 'hype', weight: 4, when: channel('ad'),
    comments: [
      { user: 'u/RadioVoiceOfDoom', flair: 'Sponsored', depth: 0, votes: [100, 1300],
        line: vo('announcer', 'Ask your doctor if vibe coding is right for you. Side effects include shipping, spaghetti, and a sudden urge to deploy on Friday!', 'fast, cheerful, legal disclaimer voice') },
      { user: 'u/WholesomeWendy', depth: 1, votes: [100, 1200], awards: ['wholesome'],
        line: vo('wholesome', 'I asked my doctor! She said it is fine with food and a code review!') },
      { user: 'u/DoomScrollDev', depth: 2, votes: [300, 2400],
        line: vo('doomer', 'Common side effect: unemployment. Rare side effect: a job.', 'flat') },
    ] },
  { id: 'rd-ad-retarget', topic: 'channel', tone: 'roast', judges: 'hype', weight: 4, when: channel('ad'),
    comments: [
      { user: 'u/SeenItEverywhere', depth: 0, votes: [150, 1500],
        line: vo('karen', 'I bought one garden gnome in March. I am still being sold gnomes. Now your app has a gnome in the logo!') },
      { user: 'u/InTheWildDevs', flair: 'Narrator', depth: 1, votes: [300, 2400],
        line: vo('narrator', 'Once purchased, the gnome follows its buyer across the internet. Marketers call this personalization. Biologists call it migration.') },
    ] },
  { id: 'rd-ad-or-parody', topic: 'channel', tone: 'neutral', judges: 'overall', weight: 4, when: channel('ad'),
    comments: [
      { user: 'u/WellActuallyGuy', flair: 'Actually', depth: 0, votes: [200, 1800],
        line: vo('pedant', 'Well, actually, I cannot tell if this is an ad or a parody of an ad. Both cost fifteen thousand dollars.') },
      { user: 'u/MoatMaven', flair: 'VC', depth: 1, votes: [100, 1100],
        line: vo('vc', 'At fifteen thousand dollars, we are not buying impressions. We are buying a mood.') },
      { user: 'u/ClodFan99', depth: 2, votes: [100, 1200],
        line: vo('clod', 'Great news! I made the billboard bigger! It is now visible from space! Nobody in space asked!') },
    ] },
];

/* ------------------------------------------------------------- OP closing edits
 * The founder (voice chad) adds one of these as the final Edit under the last reply.
 * Pick by how the launch went. Each is one voiced line, at most two Edit sentences.
 */
export const OP_EDITS: Record<'viral' | 'solid' | 'flop', VoiceLine[]> = {
  viral: [
    vo('chad', 'Edit: thank you for the gold, whoever you are! Edit two: it was my mother. She says hello.', 'breathless, thrilled'),
    vo('chad', 'Edit: wow, this blew up. Edit two: I did not plan this. I planned everything.', 'breathless, thrilled'),
    vo('chad', 'Edit: to everyone asking, yes, it is open source. Edit two: I am looking for the source.'),
    vo('chad', 'Edit: thanks for the front page. Edit two: what is the front page? Is it good?', 'giddy'),
    vo('chad', 'Edit: wow. Edit two: thank you all for coming to my TED talk.', 'humbly, then not humbly'),
    vo('chad', 'Edit: a recruiter just offered me a job. Edit two: I own the company. I am considering it.'),
    vo('chad', 'Edit: I am getting messages from people named Brandon. Edit two: they all have an exciting opportunity.'),
    vo('chad', 'Edit: my first gold! Edit two: my second gold! Please stop, I am only a visionary.', 'giddy'),
    vo('chad', 'Edit: my phone is too hot to hold. Edit two: I am typing this with oven mitts and joy.'),
    vo('chad', 'Edit: to the man who said it takes a weekend: please do it. I will wait. Edit two: it has been a month.'),
  ],
  solid: [
    vo('chad', 'Edit: formatting.', 'flat, relieved'),
    vo('chad', 'Edit: typo, and also the bug.'),
    vo('chad', 'Edit: thanks for the feedback. Edit two: I read it twice. I understood it on the second time.'),
    vo('chad', 'Edit: sorry for the formatting, I am on mobile. Edit two: I am not on mobile. I am in a car.'),
    vo('chad', 'Edit: nobody has asked for a refund. Edit two: I am calling that a success.', 'calm, rehearsed'),
    vo('chad', 'Edit: thanks to the person who found a bug. Edit two: it was in the login. Which is the app.'),
    vo('chad', 'Edit: fixed the typo. Edit two: the typo was in the word typo.'),
    vo('chad', 'Edit: I added a roadmap. Edit two: the roadmap is also on the roadmap.'),
  ],
  flop: [
    vo('chad', 'Edit: why the downvotes? Edit two: ok, I get it.', 'quiet, wounded'),
    vo('chad', 'Edit: it is not a bug, it is a feature. Edit two: it is a bug.', 'quiet, wounded'),
    vo('chad', 'Edit: I have read the comments. Edit two: I need to lie down.'),
    vo('chad', 'Edit: this was a test. Edit two: the test failed. Please do not tell the investors.'),
    vo('chad', 'Edit: I am deleting this post. Edit two: it says I cannot. It is forever.', 'defeated'),
    vo('chad', 'Edit: to everyone saying it looks like a weekend project, it took six months. Edit two: that is worse. I know.'),
    vo('chad', 'Edit: please be kind. Edit two: please be anything.', 'small voice'),
    vo('chad', 'Edit: the mods removed my reply. Edit two: the mods removed my edit.'),
    vo('chad', 'Edit: I checked the analytics. Edit two: four visitors, and three are me.', 'flat'),
    vo('chad', 'Edit: this is not a cry for help. Edit two: it is a cry for downloads.', 'small voice'),
  ],
};

/* ------------------------------------------------------------------ mod notices
 * What AutoModerator says when a launch flops and the post gets removed.
 */
export const MOD_NOTICES: VoiceLine[] = [
  vo('automod', 'Your post was removed for violating rule three, no self promotion. This action was performed automatically. I am a bot.', 'flat, reading a notice'),
  vo('automod', 'Your post was removed. Reason: it was already posted. Nobody remembers where. Please do not search for it.', 'flat, reading a notice'),
  vo('automod', 'Your post was removed for being a product. This sub is for memes. If it was a joke, explaining it is also a violation.', 'flat, reading a notice'),
  vo('automod', 'Your post was removed by the moderators. They asked me to say they are sorry. They are not sorry. They are asleep.', 'flat, reading a notice'),
  vo('automod', 'Your account is too new to post here. It is four minutes old. Please come back when it is four hours old.', 'flat, reading a notice'),
  vo('automod', 'Your post was removed for failing the vibe check. The vibe check is not public. It is also not a check.', 'flat, reading a notice'),
  vo('automod', 'Removed for violating rule eleven. We are still writing rule eleven. We will tell you when it is done.', 'flat, reading a notice'),
  vo('automod', 'Your post was removed for containing a link. Links are not allowed. Neither are posts. Please contact no one.', 'flat, reading a notice'),
  vo('automod', 'Please message the moderators about this removal. The moderators have been messaged four thousand times. You are number four thousand one.', 'flat, reading a notice'),
  vo('automod', 'Disagree with this removal? Please appeal to the moderators. The moderators are also a bot. It has read your appeal. It disagrees.', 'flat, a little proud'),
];

/* ---------------------------------------------------------------- flavor lines */

export const REDDIT_LOADING: string[] = [
  'Checking if the mods are awake...',
  'Sorting by controversial...',
  'Editing: thanks for the gold...',
  'Setting a RemindMe for next year...',
  'Reading the comments before the link...',
  'Crossposting to nine subreddits...',
  'Typing sorry for the formatting...',
  'Asking if this is a repost...',
  'Waiting for the hug of death...',
  'Appealing to the mods at midnight...',
];

export const REDDIT_TIPS: string[] = [
  'Match the channel to the app. Hacker News wants a weekend project, LinkedIn wants a lesson, and r/ProgrammerHumor wants a meme.',
  'A hug of death is coming for every good launch. Pay for the cloud before the thread, not during it. During is the expensive time.',
  'Cake day is free karma if you do not make it weird. You will make it weird. Budget for the weird.',
  'Moderators are mostly people. Be polite in the appeal. Being right is optional, and also rare.',
  'If a rival launches the day before you, you can be second and better. You can also just be second. Both are called a launch.',
  'Open sourcing the code buys karma and costs privacy. Read the code first. Then read it again, after you cry.',
  'Do not answer a four thousand word review with four thousand words. Chad will try. Stand in the doorway.',
  'Karma opens the better channels. Channels open the better wounds.',
  'A removed post is not a dead launch. Appeal, wait, and remember: the mods are asleep, not gone.',
  'Reading the comments before the link is fine. It is also what your users do. Make the comments good.',
];

export const REDDIT_HEADLINES: string[] = [
  'Man edits post to thank kind stranger for gold, receives no gold, edits post again',
  'Hug of death claims another server. Witnesses say the hug was very warm',
  'Moderator removes post for being too good, cites rule seven',
  'Founder comments first on his own launch, wins nothing, asks for a recount',
  'Reddit user reads the whole article before commenting. Authorities investigating',
  'Study: nine in ten comments begin with actually. The tenth begins with I would have used SQLite',
  'Cake day arrives. Fifteen year old account celebrates with no cake and four downvotes',
  'RemindMe bot reminds nine million people of a thing none of them care about anymore',
  'Mods are asleep, sources confirm. Sources are also asleep',
  'Local man writes source: trust me bro, becomes peer reviewed',
  'Startup crossposts to nine subreddits, is banned from eight, thrives in the ninth',
  'Repost bot reposts a repost of a repost. Original author asks for credit, is given gold',
  'AITA: I deployed on a Friday. Verdict: everyone sucks here, including the database',
  'Founder asks the internet for feedback, gets feedback, asks the internet to stop',
  'Karma farmer harvests record crop. Insurance policy was an Edit',
  'Developer learns about git revert after four years. Deletes the folder to celebrate',
  'Hacker News thread reaches consensus. Nobody can remember on what',
  'AI summarizes a thread in one word: sad. Thread confirms',
  'Intern posts from throwaway account. Throwaway account was her real name',
  'Commenter says this is the way. Way not found at press time',
];
