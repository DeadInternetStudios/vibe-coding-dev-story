/**
 * Test runs make no sound on the machine they run on. A link with a test hook in it (?debug, ?demo, ?scene) and any
 * browser driven by automation get a silent output: every sound still plays inside the page, so timing and pacing
 * are the same, and none of it reaches the speakers. `?sound=1` gives a person their sound back on a test link.
 * Automation never gets it.
 */
export function quietRun(search: string, automated: boolean): boolean {
  if (automated) return true;
  const q = new URLSearchParams(search);
  if (q.get('sound') === '1') return false;
  return q.has('debug') || q.has('demo') || q.has('scene');
}

/** An output that takes sound in and plays none. Wire everything to this instead of to the speakers. */
export function silentSink(ctx: BaseAudioContext): AudioNode {
  const sink = ctx.createGain();
  sink.gain.value = 0;
  sink.connect(ctx.destination);
  return sink;
}
