import { describe, expect, it } from 'vitest';
import { fit } from './text';

describe('fit', () => {
  it('leaves short text alone', () => {
    expect(fit('Pipe Connect', 12)).toBe('Pipe Connect');
  });

  it('ends a cut in three dots and stays within the limit', () => {
    const cut = fit('Hermit Linux, the sequel', 12);
    expect(cut).toBe('Hermit Li...');
    expect(cut.length).toBeLessThanOrEqual(12);
  });

  it('does not leave a comma or a space before the dots', () => {
    expect(fit('Hermit Linux, the sequel', 16)).toBe('Hermit Linux...');
    expect(fit('Doggo & Co. Limited', 9)).toBe('Doggo...');
  });
});
