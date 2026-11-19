/**
 * Voice clips that were fetched, kept for the next time they are said. Whoever asks for a clip gets the same one fetch
 * whether it is one line waiting or a scene loading ahead, and a clip that is slow is never waited for longer than the
 * asker allows: it keeps coming in the background.
 */
export class ClipCache<T> {
  private readonly have = new Map<string, T | null>();
  private readonly running = new Map<string, Promise<T | null>>();

  /**
   * `fetchClip` answers with the clip, with null when the line has no clip (remembered for good), or with undefined
   * when it cannot be known yet or the fetch failed (not remembered, so a later ask tries again).
   */
  constructor(
    private readonly fetchClip: (id: string) => Promise<T | null | undefined>,
    private readonly capacity: number,
  ) {}

  /** The clip, fetched if it is not here yet. Null when there is none. */
  get(id: string): Promise<T | null> {
    const kept = this.have.get(id);
    if (kept !== undefined) return Promise.resolve(kept);
    let job = this.running.get(id);
    if (!job) {
      job = this.fetchClip(id)
        .then((clip) => {
          if (clip !== undefined) this.keep(id, clip);
          return clip ?? null;
        })
        .finally(() => this.running.delete(id));
      this.running.set(id, job);
    }
    return job;
  }

  /** The clip if it is here within `ms`, otherwise null. A late clip is kept when it lands. */
  within(id: string, ms: number): Promise<T | null> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve(null), ms);
      void this.get(id).then((clip) => {
        clearTimeout(timer);
        resolve(clip);
      });
    });
  }

  /** Fetch these in the order given, `lanes` at a time. Resolves when all of them have been tried. */
  async preload(ids: readonly string[], lanes: number): Promise<void> {
    const queue = [...new Set(ids)].filter((id) => !this.have.has(id));
    const lane = async () => {
      for (let id = queue.shift(); id !== undefined; id = queue.shift()) await this.get(id);
    };
    await Promise.all(Array.from({ length: lanes }, lane));
  }

  private keep(id: string, clip: T | null): void {
    this.have.set(id, clip);
    if (this.have.size > this.capacity) {
      const oldest = this.have.keys().next().value;
      if (oldest !== undefined) this.have.delete(oldest);
    }
  }
}
