import { voiceLineId } from '../src/content/vo';

// The contract's test vector. tools/tts/idtest.py must print the same id.
console.log(voiceLineId('dave', 'Did anyone actually read the diff?'));
