/**
 * Pure Web Audio API ambient room synthesizer.
 * Generates an ethereal, quiet gallery room tone without loading external MP3 files.
 */
class GalleryAudio {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private isPlaying = false;
  private oscillators: OscillatorNode[] = [];

  public init() {
    if (this.ctx) return;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    this.ctx = new AudioCtx();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0, this.ctx.currentTime);
    this.masterGain.connect(this.ctx.destination);
  }

  public toggle(): boolean {
    this.init();
    if (!this.ctx || !this.masterGain) return false;

    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    if (this.isPlaying) {
      // Fade out
      this.masterGain.gain.linearRampToValueAtTime(0.0001, this.ctx.currentTime + 1.2);
      setTimeout(() => {
        this.stopOscillators();
        this.isPlaying = false;
      }, 1300);
      return false;
    } else {
      // Start ambient chord (subtle warm drone: D2, A2, F#3, with low-pass filter)
      this.startAmbient();
      this.masterGain.gain.setValueAtTime(0.0001, this.ctx.currentTime);
      this.masterGain.gain.linearRampToValueAtTime(0.07, this.ctx.currentTime + 2.0);
      this.isPlaying = true;
      return true;
    }
  }

  private startAmbient() {
    if (!this.ctx || !this.masterGain) return;
    this.stopOscillators();

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(320, this.ctx.currentTime);
    filter.connect(this.masterGain);

    // Warm deep tones
    const frequencies = [73.42, 110.0, 185.0]; // D2, A2, F#3
    frequencies.forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const oscGain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq + (idx * 0.2), this.ctx.currentTime);

      oscGain.gain.setValueAtTime(0.4 / (idx + 1), this.ctx.currentTime);
      osc.connect(oscGain);
      oscGain.connect(filter);

      osc.start();
      this.oscillators.push(osc);
    });
  }

  private stopOscillators() {
    this.oscillators.forEach(osc => {
      try {
        osc.stop();
        osc.disconnect();
      } catch {
        // already stopped
      }
    });
    this.oscillators = [];
  }

  public getStatus(): boolean {
    return this.isPlaying;
  }
}

export const galleryAudio = new GalleryAudio();
