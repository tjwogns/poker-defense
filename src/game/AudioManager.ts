export type SoundCue = 'click' | 'card' | 'confirm' | 'fuse' | 'relic' | 'boss' | 'win' | 'lose';

const CUES: Record<SoundCue, { notes: number[]; duration: number; type: OscillatorType; gain: number }> = {
  click: { notes: [440], duration: 0.05, type: 'sine', gain: 0.025 },
  card: { notes: [330, 415], duration: 0.07, type: 'triangle', gain: 0.035 },
  confirm: { notes: [523, 659, 784], duration: 0.11, type: 'triangle', gain: 0.045 },
  fuse: { notes: [392, 523, 784, 1047], duration: 0.12, type: 'sawtooth', gain: 0.04 },
  relic: { notes: [440, 554, 659, 880], duration: 0.15, type: 'sine', gain: 0.05 },
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
    const activation = navigator.userActivation;
    // Chrome은 사용자 입력 없이 만든 AudioContext를 suspended 상태로 두며 경고한다.
    // 첫 실제 클릭·키 입력이 올 때까지 생성과 resume 자체를 미룬다.
    if ((!this.context || this.context.state !== 'running') && activation && !activation.isActive) return;
    const AudioContextClass = window.AudioContext
      ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    this.context ??= new AudioContextClass();
    const context = this.context;
    if (context.state === 'running') {
      this.schedule(context, cue);
      return;
    }
    if (context.state === 'closed') {
      this.context = null;
      return;
    }
    void context.resume()
      .then(() => {
        if (this.enabled && this.context === context && context.state === 'running') {
          this.schedule(context, cue);
        }
      })
      .catch(() => undefined);
  }

  destroy(): void {
    const context = this.context;
    this.context = null;
    if (context && context.state !== 'closed') void context.close().catch(() => undefined);
  }

  private schedule(context: AudioContext, cue: SoundCue): void {
    const config = CUES[cue];
    const start = context.currentTime;
    config.notes.forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const noteStart = start + index * config.duration * 0.55;
      oscillator.type = config.type;
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(config.gain, noteStart);
      gain.gain.exponentialRampToValueAtTime(0.001, noteStart + config.duration);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(noteStart);
      oscillator.stop(noteStart + config.duration);
    });
  }
}
