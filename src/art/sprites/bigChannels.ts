/**
 * 12x12 icons for the 8 launch channels. Letter maps of the picture without its outline;
 * iconPx adds the ink0 outline and centers it. Rows of one icon must be the same width.
 */
export const CHANNEL_ART: Record<string, string[]> = {
  // a billboard that says AD
  chan_ad: [
    'xxxxxxxxxx',
    'xyyyyyyyyx',
    'xyryyrryyx',
    'xryryryryx',
    'xrrryryryx',
    'xryryryryx',
    'xryryrryyx',
    'xxxxxxxxxx',
    '.hh....hh.',
    '.hh....hh.',
  ],
  // a list of links, one upvoted
  chan_hn: [
    'OOOOOOOOOO',
    'OYYOOYYOOO',
    'cccccccccc',
    'cOcccjjjjc',
    'cOOOcllllc',
    'cccccccccc',
    'cclccjjjjc',
    'clllclllcc',
    'cccccccccc',
    'cclccjjjjc',
  ],
  // a very funny face
  chan_humor: [
    '...yyyy...',
    '..yyyyyy..',
    'yykyyyykyy',
    'yyykyykyyy',
    'yykyyyykyy',
    'ysyyyyyysy',
    'ykkkkkkkky',
    'ykwwwwwwky',
    '.ykrrrrky.',
    '..yykkyy..',
  ],
  // a ring light with a phone, on a tripod
  chan_influencer: [
    '....xx....',
    '..yyxxyy..',
    '.yYYxxYYy.',
    'yY......Yy',
    'yY......Yy',
    'yY......Yy',
    '.yYYYYYYy.',
    '..yyyyyy..',
    '....AA....',
    '..AA..AA..',
  ],
  // a briefcase with an open to work badge
  chan_linkedin: [
    '...hhhh...',
    '...h..h...',
    'qqqqqqq.G.',
    'NNNNNNGwG.',
    'NNNNYYNG..',
    'NNNNYYNNNN',
    'NNNNNNNNNN',
    'hhhhhhhhhh',
    'HHHHHHHHHH',
  ],
  // a rocket, number one of the day
  chan_ph: [
    '....rr....',
    '...rrrr...',
    '...wwww...',
    '...wBBw...',
    '...wBBw...',
    '..rwwwwr..',
    '.rrwwwwrr.',
    '.r.wwww.r.',
    '...OOOO...',
    '....YY....',
  ],
  // a very small rocket, asleep, nobody noticed the launch
  chan_quiet: [
    '......ZZZ.',
    '........Z.',
    '..rr...Z..',
    '.rwwr.Z...',
    '.wBBw.ZZZ.',
    '.wwww.....',
    'rrwwrr....',
    'r.wwwr....',
    '..rrr.....',
    '..........',
  ],
  // half a birdhouse and the hammer that will not finish it
  chan_sideproject: [
    '..JJh.....',
    '.JJJ.h....',
    'JJJJ..h...',
    '.NNNNNN...',
    '.NNkkNN.AA',
    '.NNkkNN.xA',
    '.NNNNNN..n',
    '.hhhhhh..n',
    '..hh......',
    '..........',
  ],
};
