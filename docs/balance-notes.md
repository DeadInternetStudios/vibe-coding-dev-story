# Balance notes

How the money is tuned, what the bots prove, and how to move it without breaking it.

## The test

`npx tsx tools/balance.ts <seeds> <chill|normal|ramen> <strategies>` plays whole three year games with the shipped content
(not the small test fixture) and prints bankruptcies, apps shipped, final score and ranks per strategy. Strategies live in `src/sim/bot.ts`:

| bot | plays like |
|---|---|
| smart | reads what it can afford, picks the best project and plan cards, hires for the gaps, avoids Friday, takes the angel check |
| casual | the smart bot with 35 percent of its choices made without thinking and a coin flip on Friday deploys |
| yolo | weekend hacks and MVPs only, speed cards, hires early, never refactors, always deploys on Friday, takes the VC money |
| random, idle | button masher, does nothing |

The bar for a change: smart beats casual, casual is not behind yolo, yolo is not the best way to play, random and idle go bankrupt.
After any change to `src/sim` also run `MONEY_SEEDS=12 npx vitest run src/sim/money.test.ts` (180 whole games, the books must match the cash box to the cent).

## Where it stood before the retune

Yolo scored S on chill and normal: 46 to 49 apps against the careful bot's 33 to 35, because every app earns about the same once the team is
strong (stats saturate near 100 by year two) and a weekend hack costs half the time for half the money, so volume wins.

## What moved (`src/sim/config.ts`, `src/sim/launch.ts`, `src/sim/economy.ts`)

- **Scope pays for its time.** The full scope pays 2.5x for 1.8x the time (was 1.4x), a hack pays 0.42x for 0.5x the time (was 0.5x).
- **Shaky apps earn less, smoothly.** Revenue is cut by `(0.6 + 0.4 x min(1, stability / 70)) x (0.8 + 0.2 x min(1, security / 60))`. It used to be a single 20 percent cut under stability 30. `REVENUE.base` went up 15 percent to keep an average product where it was.
- **Friday incidents bite.** An incident costs $4000 (was $1500) and cuts the app's lifetime revenue by 40 percent (was 15 percent).
- **Threads are shorter and fresher.** After five launches a thread has three comment threads instead of four, and votes are scaled by 4/3 so karma per launch does not change. A vignette read before is a quarter as likely each time it could come up again.
- **Rank cuts moved** to S 46M, A 30M, B 16M, C 5M, D 1M, so S needs a run better than any bot's median.

## Where it stands (median final score, 48 seeds, normal)

| smart | casual | yolo |
|---|---|---|
| 39.6M | 36.7M | 36.0M |

Chill (24 seeds): 49.4M, 43.7M, 40.6M. Ramen (24 seeds): 33.6M, 29.6M, 28.2M, with 8 percent and 4 percent bankruptcies for casual and yolo.
Random and idle bots go bankrupt in 71 to 100 percent of runs.

## Known limits

- The bots are a proxy. They prove that care beats volume in the model, not that it feels good. Watch real players.
- Casual and yolo are close on normal. If reckless play should hurt more, raise `FRIDAY.incidentCost`, lower `SCOPES.hack.money`, or add a fatigue on shipping many small apps in a row.
- S is common for the smart bot on chill (about three runs in four). That is the cozy mode, but if it should be rarer, give chill its own rank cuts.
