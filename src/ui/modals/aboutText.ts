/** What the player is told about listening to the voices. A machine checks the words; a person is a different thing, and the popup says which has happened. */
export function voiceNote(heardBy: string | null): string {
  return heardBy
    ? `A machine checked every clip against its words, and ${heardBy} has heard them.`
    : 'A machine checked every clip against its words. No person has heard them all yet.';
}

/** What a player is owed: who made the parts, what the game keeps about them, and that the jokes are jokes. */
export function aboutRows(voicesHeardBy: string | null): readonly (readonly [string, string])[] {
  return [
    ['MADE WITH', 'Phaser 4. The pixel art, music and sound effects were made for this game. Fonts: Silkscreen, Jersey, Tiny5 and VT323, under the SIL Open Font License.'],
    ['AI VOICES', `Twenty characters, each invented from a text description by Qwen3-TTS 1.7B VoiceDesign and rendered offline. ${voiceNote(voicesHeardBy)} Sounds off? Turn AI VOICES down in Settings.`],
    ['PRIVACY', 'No accounts. No tracking. Your saves and scores stay in this browser, on this device.'],
    ['NOTE', 'A parody. Not affiliated with Reddit, Hacker News, Product Hunt, LinkedIn or anyone else named in a joke. Every post and person in here is made up.'],
  ];
}
