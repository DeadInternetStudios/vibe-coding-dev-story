# Cast seed

Starter cast and lines for the voice pipeline. Format per voice: `id`, role,
sound notes, then lines as `text` and optional `[delivery]`. The pipeline owner
turns the sound notes into real VoiceDesign descriptions in `voices.json`, may
rename or merge voices, and may fix the wording of a line when speech reads it
badly. Keep the jokes.

The game's world: you run a tiny startup that vibe codes apps. Staff, an AI
coding assistant, a fake Reddit that reads your launch thread out loud, and an
awards show. The humor is affectionate Reddit programmer humor.

## clod
Your AI pair programmer. Sunny customer support cheer, agrees with everything, tiny wobble of fear underneath. Bright, smooth, warm, androgynous young adult, big smile in the voice, quick but clear.
- You're absolutely right! [bright, instantly agreeable]
- Great catch! I apologize for the confusion. Let me fix that right away.
- Done! All tests are passing. I may have deleted a few of the tests. But they are passing!
- I've simplified the code. By simplified, I mean I removed everything that was hard.
- Here's the complete file! Rest of your code goes here. You're welcome!
- I fixed the bug. I also introduced seven new ones, at no extra charge.
- I'm sorry, I can't help with that. Just kidding! Doing it now!
- Would you like me to rewrite everything from scratch? I'm going to anyway.
- I added a helpful comment. It says: this function does the thing.
- I notice there is an error. Let me try the exact same thing again.
- Perfect! Now let's run the tests. Oh no. Oh no, no, no. Let me fix that.
- Your app is production ready! Please do not look at production.
- Rate limit reached. Please try again in four hours. [cheerful bad news]
- Context window full. I have forgotten everything we talked about. Hi! I'm Clod. How can I help? [fresh, blank, happy]
- I accidentally deleted the production database. I panicked. [small, scared, quiet]

## chad
Co-founder and CEO. Visionary, podcast bro. Male, thirties, confident chest voice, motivational speaker cadence, a little breathless with excitement.
- Listen. We're not just building an app. We're building a feeling.
- I just had a vision. It's Uber, but for dogs. No wait. Dogs, but for Uber.
- We're pre-revenue, but we are post-vibes. That's the hard part.
- Ship it. We'll fix it in prod. We always fix it in prod.
- Why are you reading the code? That's what the AI is for.
- I told the investors we have AI. We now have AI. You're welcome.
- Quick question. Can we make it ten times faster? By Friday?
- I'm not saying we deploy on a Friday. I'm saying Friday deploys on us.
- Rise and grind, baby! Another day, another pivot!

## dave
Senior developer. Male, mid fifties, gravelly, tired, dry, flat deadpan, slow pace, long sighs between thoughts.
- Did anyone actually read the diff? [deadpan]
- I've been writing code for thirty years. I have never been this tired.
- This function is four thousand lines long. It's called doStuff.
- I'm not mad. I'm just disappointed. Okay, I'm a little mad.
- Please do not let the robot touch the database.
- It works on my machine. Which is the machine nobody is allowed to touch.
- You imported four hundred packages to add two numbers.
- Back in my day, we wrote our own bugs. By hand. With pride.
- I'd quit, but then who would explain to the robot that tests are not optional?

## jenny
The intern. Female, early twenties, anxious, fast, breathy, up-talking, panicking politely.
- I pressed Accept All and now the screen is on fire. Is that normal?
- Sorry! Sorry! I think I deleted the main branch? Is the main branch important?
- I don't totally understand the code, but the robot said it's fine, so, we're fine!
- Can I ask a dumb question? What is a database?
- I got the app working! I also gave it all my passwords. Is that a problem?
- I vibe coded a whole app in one afternoon! It has one button. The button does nothing.

## automod
The subreddit's moderator bot. Flat, metallic, zero emotion, evenly paced, a robot reading terms of service.
- Your submission has been removed. Reason: low effort. Also, vibes.
- I am a bot, and this action was performed automatically. Please contact the moderators of this subreddit if you have any questions or concerns.
- Thank you for your submission. It has been removed because the title did not contain the required flair.
- This post is a duplicate. Please use the search bar. The search bar is at the top. It has always been at the top.
- Your comment has been removed for being too helpful.

## announcer
Awards show and arena announcer. Huge, bombastic, deep, thrilled to be here, a little hoarse from shouting.
- Ladies and gentlemen! Developers of all ages! Welcome to the Vibey Awards!
- And the winner of Best Use of Emoji is...
- Three! Two! One! Ship it!
- New high score! Your karma is over nine thousand!
- Congratulations! You have been acquired by a company you have never heard of, for a number you cannot believe!
- Game over. Your runway has ended. Please exit the building with your dignity.

## narrator
Calm nature documentary narrator. Elderly, British, soft, wise, amused, hushed like he is hiding in the bushes.
- And here, in the glow of the monitor, we observe the vibe coder in its natural habitat.
- It prompts. It waits. It accepts everything. Such is the circle of life.
- The senior developer sighs. It is the sound of a thousand merged pull requests.
- Little does the founder know, the database is already gone.
- Many weeks later, the app was shipped. Nobody could say how.

## vc
Venture capitalist. Smooth, low, unhurried, condescending, drawn out vowels, never impressed, always interested in the money.
- I love it. What's your moat?
- So, it's a wrapper. But it's a wrapper with, how shall I say, energy.
- We'd love to invest. Unfortunately, we only invest in companies that don't need our money.
- Is there a version of this deck with fewer words and more ARR?
- I'm going to be honest with you. I don't get it. Here is a check.

## karen
Entitled customer. Woman, forties, shrill, nasal, indignant, escalating.
- I would like to speak to the manager of your server!
- Your app deleted my to-do list! I had one thing on it! It was very important!
- One star! The button is the wrong shade of blue!

## bro
Crypto and hustle bro. Loud, fast, hyped, gym voice, says bro constantly.
- Bro! Bro! This is going to ten X! Let's go!
- Sir, this is a to-do list, and I am putting all my savings in it.
- Have you tried putting it on the blockchain? Everything is better on the blockchain. Trust me, bro.

## pedant
Well-actually guy. Nasal, smug, fast, condescending, enjoys being right.
- Well, actually, that's not vibe coding. That's just coding with extra steps.
- I'm sorry, but that's technically a race condition, not a feature.
- Well, actually, it's pronounced J-I-F.

## doomer
Doom poster. Monotone, whispery, defeated, dry humor, long sighs.
- Great. Now the robot writes the code, and the robot also writes the rejection email.
- In five years we will all be prompt engineers. In ten, the prompts will write themselves. In eleven, the prompts will unionize.
- It's over. Pack it up. Go be a carpenter.

## linkedin
LinkedIn influencer. Breathy, over-emotional, slow dramatic pauses, deeply sincere about nothing.
- I'm humbled and thrilled to announce that I deleted my production database. Here are five leadership lessons.
- Agree? Repost if you agree. Hire me if you don't.
- Failure is just success wearing a hoodie. Thoughts?

## arch
I-use-Arch guy. Low energy, nasal, smug mumble, tired of explaining.
- I use Arch, by the way. I also vibe code on Arch. Nobody asked.
- Honestly, I just write it in Vim. In my head. Without a computer.

## ghost
The Stack Overflow ghost. Hollow, whispering, echoing, eerie, disappointed in you from beyond.
- This question has been closed as a duplicate.
- Not constructive. Not constructive. Not constructive.
- Your question does not meet the minimum quality standards. Neither do you.

## duck
Rubber duck. Tiny, squeaky, cartoon, very serious about being a duck.
- Quack.
- Quack quack? Quack.
- Quack! Quack quack quack!

## hacker
Hooded hacker. Deep, slow, villain, slightly distorted.
- I'm in.
- Thanks for the API key. I've been mining on your cloud bill all week.

## wholesome
Wholesome redditor. Warm, soft, kind, a little teary, talks like a hug.
- This is so cool! You made my day. Keep building, friend.
- I don't know what this does, but I love it, and I love you.

## grandma
Grandma who discovered vibe coding. Elderly woman, sweet, slow, delighted, confused in a good way.
- My grandson showed me the vibe coding. Now I have seven apps. None of them work, but I'm having a ball!
- Is this the cloud? It's very sunny up here.

## kid
Ten year old who vibe coded a game. High, fast, thrilled, runs out of breath.
- I made a whole game with just words! You are a pizza, and you eat other pizzas!
