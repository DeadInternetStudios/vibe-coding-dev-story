import { OfflineAudioContext as NodeOfflineAudioContext } from 'node-web-audio-api';
import { describe, expect, it } from 'vitest';
import { INSTRUMENTS, noteVoice } from './synth/instruments';
import { createRuntime } from './synth/runtime';
import { playVoice, type VoiceSpec } from './synth/voice';

const AUTOMATION = [
  'setValueAtTime',
  'linearRampToValueAtTime',
  'exponentialRampToValueAtTime',
  'setTargetAtTime',
  'setValueCurveAtTime',
] as const;

/** Plays one voice on a context that counts the automation events on every oscillator's frequency. */
function watchFrequency(voice: VoiceSpec): { events: number; hz: number[] } {
  const ctx = new NodeOfflineAudioContext(1, 4800, 48000) as unknown as OfflineAudioContext;
  const oscillators: OscillatorNode[] = [];
  let events = 0;
  const create = ctx.createOscillator.bind(ctx);
  ctx.createOscillator = () => {
    const osc = create();
    for (const method of AUTOMATION) {
      const real = osc.frequency[method].bind(osc.frequency) as (...args: unknown[]) => AudioParam;
      (osc.frequency as unknown as Record<string, unknown>)[method] = (...args: unknown[]) => {
        events++;
        return real(...args);
      };
    }
    oscillators.push(osc);
    return osc;
  };
  expect(playVoice(createRuntime(ctx), voice, ctx.destination)).toBe(true);
  return { events, hz: oscillators.map((o) => o.frequency.value) };
}

/**
 * A browser starts an oscillator's phase from the note's offset inside the render quantum
 * when its frequency is automated: up to half a cycle at 1 kHz, measured in Chromium by
 * tools/audio/startprobe.ts. node-web-audio-api does not do this, so only a test that looks
 * at the parameter can keep a steady note from going back to automating it.
 */
describe('oscillator frequency', () => {
  it('a steady note sets the plain value and schedules no automation, so a browser starts it at a fixed phase', () => {
    const { events, hz } = watchFrequency(noteVoice(INSTRUMENTS.chord, 440, 0.1, 0.5, 0.8));
    expect(events).toBe(0);
    expect(hz).toEqual([440, 440]);
  });

  it('a vibrato note is steady too: the vibrato rides on detune, not on the frequency', () => {
    expect(INSTRUMENTS.lead.vib).toBeDefined();
    const { events, hz } = watchFrequency(noteVoice(INSTRUMENTS.lead, 440, 0.1, 0.5, 0.8));
    expect(events).toBe(0);
    expect(hz).toContain(440);
  });

  it('a bend is automated: an anchor at the start and a ramp to the target', () => {
    const { events } = watchFrequency(noteVoice(INSTRUMENTS.lead, 440, 0.1, 0.5, 0.8, undefined, 7));
    expect(events).toBe(2);
  });

  it('an arpeggio is automated: an anchor and a change at every step', () => {
    const { events } = watchFrequency(noteVoice(INSTRUMENTS.arp, 440, 0.1, 0.5, 0.8, [0, 4, 7]));
    expect(events).toBeGreaterThan(3);
  });
});
