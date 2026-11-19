# Vibe Coding Dev Story

A Game Dev Story style management game about vibe coding, made for people who live on Reddit.

You run a tiny startup out of a garage. You hire a team and prompt apps into existence with an AI called Clod.
Then you ship on a fake Reddit, and the launch thread **reads itself out loud, every commenter in their own voice**,
while the karma counter spins. Survive three years, or get acquired for a number nobody believes.

Pixel art, one-screen office, a button for everything. Phaser 4, Vite, TypeScript. No server, no account, no tracking.

## Play

```sh
npm install
npm run dev          # serves the game on the address it prints, usually http://127.0.0.1:5173
```

A phone works as well as a desktop: portrait, landscape and tablets each get their own layout.
Add it to the home screen and it runs offline.

Keyboard on desktop: `SPACE` pauses and `1` to `4` set the speed. `H` `T` `S` `O` `R` `P` open Hire, Team, Shop, Tools, Room and Project.
`C` crunches, `I` grabs an idea, `ESC` opens the menu, and the number keys pick the answer in a popup.

### The loop

1. **Pick a project.** An app kind, a niche, a tool and a scope. Every choice moves five stats.
2. **Watch the office build it.** Your team types, argues with the AI and leaves commit messages in the terminal. Grab the ideas that float up. Crunch if you dare.
3. **Pick a plan card** at each phase: move fast and break things, or the boring correct way.
4. **Launch on a channel**, from a quiet launch to r/SideProject, Show HN, Product Hunt, r/ProgrammerHumor and a big ad campaign. If it is Friday, you will be asked.
5. **Read the thread.** Karma, awards, an AutoModerator removal if it flopped, and the founder's `Edit: thanks for the gold`.
6. **Payday every month.** Salaries, rent, tokens, the cloud bill. Random events, funding rounds, the Vibey Awards.
7. **Reach an ending.** Eight of them, from The Unicorn and Acquired By Big Tech to Zombie Startup, Out Of Runway and Founder Starts A Podcast.

## What is inside

| | |
|---|---|
| Voices | 20 characters, **863 spoken lines**, each voice invented from a text description by Qwen3-TTS 1.7B VoiceDesign, rendered offline to small MP3s (the audio folder also holds 65 audition takes from casting the voices, which nothing plays) |
| Words | 178 launch-thread comments, 111 random events, 69 trophies, 84 news headlines, 73 loading lines, 16 title-screen quips |
| Art | one pixel sprite set (people, room, items, icons, avatars), bitmap fonts baked from open pixel fonts, no emoji, no stock UI |
| Sound | 9 songs and 55 effects, all synthesized in code by our own tiny chiptune engine. Nothing to download |
| Extras | trophy case, daily challenge (the same seed for everyone each day, still a full run), share card, hall of fame, save codes (copy a run as text), install and offline play |

## Switch things off

Every extra sits behind one seam, so you can hand someone a plainer game. Add `?off=` and any of
`keys,share,install,buzz,trophies,daily,save` to the address, for example `http://127.0.0.1:5173/?off=install,daily`.

Jump to a screen for testing: `?demo=dev`, `hire`, `rich`, `late`, `event`, `card`, `ready`, `payday`, `funding`, `awards`, `thread`, `thread1`, `flop`, `ending`.
Add `&seed=7&notut=1&paused=1` to freeze it and skip the tutorial, and `&debug=1` for `window.__drive` (list and click things from the console).

## How it is built

```
src/sim        the whole game as plain TypeScript: no Phaser, no DOM, deterministic for a seed (bot players live here too)
src/content    every word the game says, with the voice that says it
src/scenes     Title, New Game, Office, Thread, Ending
src/ui         buttons, popups, the pixel-perfect viewport, the dashboard, the thread view
src/audio      the chiptune engine, songs, effects, and the voice player
tools/tts      the offline voice pipeline (Python, MLX), see tools/tts/README.md
tools/art      sprite drawing, checks and previews
docs           design notes, the voice contract, the art brief
```

The money is audited: `npm test` plays whole games with bot players and checks the books against the cash box to the cent
after every step. `MONEY_SEEDS=12 npx vitest run src/sim/money.test.ts` plays 180 games.

```sh
npm test             # 400+ tests: sim, content, bots, audio, art
npm run build        # typecheck, then a static build in dist/
npm run vo:export    # list every voiced line (tools/tts renders the ones that are missing)
```

## The voices

The game never calls a model. `tools/tts` turns `src/content` into `public/audio/vo/*.mp3` once, on a laptop,
with a speech-to-text check on every clip (the words you read are the words you hear). The cast:
a coding assistant that agrees with everything, a founder who ships on Fridays, a senior dev who has seen it all,
an AutoModerator, a crypto bro, a pedant, a doomer, a LinkedIn poster, a rubber duck and more.
Every clip is checked by machine, speech to text and loudness, and none of that is the same as a person listening.
`docs/listening-pass.md` is the one-hour pass that closes the gap. Until someone has done it and signed here, treat the voices as unheard:

> Voices heard end to end by: nobody yet.

## Balance

The bots in `src/sim/bot.ts` are the acceptance test for the money. `npx tsx tools/balance.ts 48 normal smart,casual,yolo` plays whole
three year games: the careful bot finishes ahead of the casual one, which finishes ahead of the reckless one that spams weekend hacks
and Friday deploys (48 seeds, normal: 39.6M, 36.7M and 36.0M), and on Ramen the reckless one sometimes goes bankrupt. Bots that only mash buttons or do nothing go
bankrupt in most runs, usually inside the first year.

## Credits, licence, privacy

Phaser 4 for the engine. Pixel fonts from the open Fontsource packages (Jersey, VT323, Tiny5, Silkscreen), all under the SIL Open Font License.
Voices by Qwen3-TTS-12Hz-1.7B-VoiceDesign. Every joke is about you, kindly.

The game's own code, art, music, writing and voices are covered by `LICENSE`. The parts it is built from keep their licences in
`THIRD-PARTY-NOTICES.md`, which also ships with the game as `/third-party-notices.txt` and shows under Settings, About.
No accounts, no analytics, no requests to anyone but the server the game came from. Saves, settings and the hall of fame stay in your browser.
A save from another version of the game is not opened, and the title says so. Changing `SAVE_VERSION` means writing the migration in `src/core/save.ts` first.
