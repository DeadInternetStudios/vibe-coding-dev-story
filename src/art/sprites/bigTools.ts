/**
 * 12x12 icons for the 7 AI tools. Letter maps of the picture without its outline;
 * iconPx adds the ink0 outline and centers it. Rows of one icon must be the same width.
 */
export const TOOL_ART: Record<string, string[]> = {
  // a line of code, grey ghost text after the cursor, and the Tab key that accepts it
  tool_autocomplete: [
    'iiiiiiiiii',
    'KKKKyKKKKK',
    'KwwwyllllK',
    'KKKKyKKKKK',
    'KKKKKKKKKK',
    '..........',
    'wwwwwxwwxw',
    'wxxxxxxwxw',
    'wwwwwxwwxw',
    'aaaaaaaaaa',
  ],
  // a window with a red eye that has seen things
  tool_cursed: [
    'vrvrvrvvv',
    'uuuuuuuuu',
    'uuRRRRRuu',
    'uRrrkrrRu',
    'RrOykyOrR',
    'uRrrkrrRu',
    'uuRRRRRuu',
    'uuuuuuuuu',
  ],
  // an old beige laptop, sweating through a 70 billion parameter model
  tool_local: [
    's.cccccc..',
    'B.cKKKKc..',
    '.ccKGKGKc.',
    '..cKKKKKc.',
    '..cKGGGKcs',
    '..cccccccB',
    'qqqqqqqqqq',
    'qLqLqLqLqq',
    'LLLLLLLLLL',
  ],
  // a white hole wearing a halo
  tool_singularity: [
    '...yyyy...',
    '.yyVVVKyy.',
    '.yKKKKVKy.',
    'yKKVwwKKKy',
    'yKKwwwwVKy',
    'yKKwwwwKVy',
    'yKKVwwKKVy',
    '.yVKVVVVy.',
    '.yyVKKKyy.',
    '...yyyy...',
  ],
  // five tiny robots, arranged like the five on a die
  tool_swarm: [
    'BBBB..GGGG',
    'BkkB..GkkG',
    '.BB....GG.',
    '...eeee...',
    '...ekke...',
    '....ee....',
    'pppp..YYYY',
    'pkkp..YkkY',
    '.pp....YY.',
  ],
  // a talking browser tab
  tool_tab: [
    '.wwwwwwww.',
    'wwwwwwwwww',
    'wwwbwbwbww',
    'wwwwwwwwww',
    '.wwwwwwww.',
    '.ww.......',
    '.eeeeeee..',
    '.eyyAAAx..',
    'eeeeeeeeee',
    'AAAAAAAAAA',
  ],
  // a prompt with a cursor that is very happy to see you
  tool_terminal: [
    'ArAyAGAAAA',
    'KKKKKKKKKK',
    'KKKKGGGGGK',
    'KGKKGkGkGK',
    'KKGKGGGGGK',
    'KGKKkGGGkK',
    'KKKKGkkkGK',
    'KKKKKKKKKK',
  ],
};
