const clips = [
  '/sounds/monkey-1.ogg',
  '/sounds/monkey-2.ogg',
  '/sounds/monkey-3.ogg',
];

/** One voice at a time, with small pitch changes that retain the recorded texture. */
export class MomoSounds {
  private context: AudioContext | null = null;
  private files = new Map<string, Promise<ArrayBuffer>>();
  private buffers = new Map<string, Promise<AudioBuffer>>();
  private active: { source: AudioBufferSourceNode; gain: GainNode } | null = null;
  private fallback: HTMLAudioElement | null = null;
  private enabled = true;
  private disposed = false;
  private request = 0;
  private lastPlayed = -Infinity;
  private lastClip = -1;

  constructor() {
    // Fetch early, but create/resume the audio context only inside a user gesture.
    for (const url of clips) void this.load(url).catch(() => {});
  }

  private load(url: string) {
    let file = this.files.get(url);
    if (!file) {
      file = fetch(url).then((response) => {
        if (!response.ok) throw new Error('Sound unavailable');
        return response.arrayBuffer();
      }).catch((error: unknown) => {
        this.files.delete(url);
        throw error;
      });
      this.files.set(url, file);
    }
    return file;
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (!enabled) {
      this.request++;
      this.stop();
    }
  }

  private stop(fade = false) {
    if (this.active && this.context) {
      const { source, gain } = this.active;
      const now = this.context.currentTime;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.linearRampToValueAtTime(0, now + (fade ? 0.035 : 0));
      source.stop(now + (fade ? 0.04 : 0));
      this.active = null;
    }
    this.fallback?.pause();
    this.fallback = null;
  }

  async play() {
    const startedAt = performance.now();
    if (!this.enabled || this.disposed || startedAt - this.lastPlayed < 240) return;
    this.lastPlayed = startedAt;
    const request = ++this.request;
    // Choose a different call each time, without a predictable repeating sequence.
    const index = (this.lastClip + 1 + Math.floor(Math.random() * (clips.length - 1))) % clips.length;
    this.lastClip = index;
    const url = clips[index];
    const rate = 0.97 + Math.random() * 0.08;
    const isCurrent = () => this.enabled && !this.disposed && request === this.request;

    try {
      if (!window.AudioContext) throw new Error('Web Audio unavailable');
      this.context ??= new AudioContext();
      const context = this.context;
      if (context.state === 'suspended') await context.resume();
      let buffer = this.buffers.get(url);
      if (!buffer) {
        buffer = this.load(url).then((data) => context.decodeAudioData(data.slice(0)));
        this.buffers.set(url, buffer);
        void buffer.catch(() => this.buffers.delete(url));
      }
      const decoded = await buffer;
      // Never replay an old tap after a slow download or after muting.
      if (!isCurrent() || performance.now() - startedAt > 800) return;
      this.stop(true);
      const source = context.createBufferSource();
      source.buffer = decoded;
      source.playbackRate.value = rate;
      const gain = context.createGain();
      gain.gain.setValueAtTime(0, context.currentTime);
      gain.gain.linearRampToValueAtTime(0.65, context.currentTime + 0.015);
      source.connect(gain);
      gain.connect(context.destination);
      source.onended = () => {
        source.disconnect();
        gain.disconnect();
        if (this.active?.source === source) this.active = null;
      };
      this.active = { source, gain };
      source.start();
    } catch {
      if (!isCurrent() || performance.now() - startedAt > 800) return;
      this.stop();
      const audio = new Audio(url);
      audio.volume = 0.65;
      audio.playbackRate = rate;
      audio.preservesPitch = false;
      this.fallback = audio;
      void audio.play().catch(() => {});
    }
  }

  dispose() {
    this.disposed = true;
    this.request++;
    this.stop();
    if (this.context) void this.context.close().catch(() => {});
    this.files.clear();
    this.buffers.clear();
  }
}
