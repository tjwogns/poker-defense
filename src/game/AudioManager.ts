export type SoundCue = 'click' | 'card' | 'confirm' | 'fuse' | 'relic' | 'power' | 'boss' | 'win' | 'lose';

const CUES: Record<SoundCue, { notes: number[]; duration: number; type: OscillatorType; gain: number }> = {
  click: { notes: [440], duration: 0.05, type: 'sine', gain: 0.025 },
  card: { notes: [330, 415], duration: 0.07, type: 'triangle', gain: 0.035 },
  confirm: { notes: [523, 659, 784], duration: 0.11, type: 'triangle', gain: 0.045 },
  fuse: { notes: [392, 523, 784, 1047], duration: 0.12, type: 'sawtooth', gain: 0.04 },
  relic: { notes: [440, 554, 659, 880], duration: 0.15, type: 'sine', gain: 0.05 },
  power: { notes: [220, 440, 660, 990], duration: 0.1, type: 'square', gain: 0.04 },
  boss: { notes: [110, 98, 82], duration: 0.24, type: 'sawtooth', gain: 0.055 },
  win: { notes: [523, 659, 784, 1047], duration: 0.22, type: 'triangle', gain: 0.055 },
  lose: { notes: [220, 185, 147], duration: 0.25, type: 'triangle', gain: 0.05 },
};

/** 외부 음원 없이 Web Audio로 짧은 피드백음을 만든다. */
export class AudioManager {
  enabled: boolean;
  private context: AudioContext | null = null;

  constructor(enabled: boolean) {
    this.enabled = enabled;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  play(cue: SoundCue): void {
    if (!this.enabled || typeof window === 'undefined') return;
    const AudioContextClass = window.AudioContext
      ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    this.context ??= new AudioContextClass();
    void this.context.resume();
    const config = CUES[cue];
    const start = this.context.currentTime;
    config.notes.forEach((frequency, index) => {
      const oscillator = this.context!.createOscillator();
      const gain = this.context!.createGain();
      const noteStart = start + index * config.duration * 0.55;
      oscillator.type = config.type;
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(config.gain, noteStart);
      gain.gain.exponentialRampToValueAtTime(0.001, noteStart + config.duration);
      oscillator.connect(gain).connect(this.context!.destination);
      oscillator.start(noteStart);
      oscillator.stop(noteStart + config.duration);
    });
  }
}
