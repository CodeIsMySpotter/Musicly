import * as Tone from 'tone';

class AudioEngine {
  constructor() {
    this.isInitialized = false;
    this.synths = {};
    this.effects = {};
  }

  async init() {
    if (this.isInitialized) return;
    await Tone.start();

    // Master FX
    this.effects.masterGain = new Tone.Gain(0.9).toDestination();
    this.effects.masterReverb = new Tone.Reverb({ decay: 5.5, wet: 0.5 }).connect(this.effects.masterGain);
    this.effects.masterFilter = new Tone.Filter({ frequency: 2800, type: "lowpass", rolloff: -24 }).connect(this.effects.masterReverb);
    
    // Synths
    this.synths.kick = new Tone.MembraneSynth({
      pitchDecay: 0.08, octaves: 4,
      oscillator: { type: "sine" },
      envelope: { attack: 0.001, decay: 0.45, sustain: 0.01, release: 0.3 }
    }).connect(this.effects.masterGain);

    this.synths.pad = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "fatcustom", partials: [1, 0.4, 0.2], spread: 20, count: 3 },
      envelope: { attack: 1.2, decay: 1.5, sustain: 0.8, release: 2.5 }
    }).connect(this.effects.masterFilter);

    this.synths.crystal = new Tone.FMSynth({
      harmonicity: 2.0, modulationIndex: 2.5,
      oscillator: { type: "triangle" }, modulation: { type: "sine" },
      envelope: { attack: 0.005, decay: 0.2, sustain: 0.02, release: 0.25 },
    }).connect(this.effects.masterReverb);

    this.synths.sub = new Tone.MonoSynth({
      oscillator: { type: "sine" },
      envelope: { attack: 0.04, decay: 1.2, sustain: 0.6, release: 0.8 }
    }).connect(this.effects.masterGain);

    Tone.Transport.bpm.value = 80;
    this.isInitialized = true;
  }

  playNote(instrument, note, duration = "8n") {
    if (!this.isInitialized) return;
    const synth = this.synths[instrument];
    if (synth) {
      synth.triggerAttackRelease(note, duration);
    }
  }

  updateSynthParams(instrument, params) {
    if (!this.isInitialized || !this.synths[instrument]) return;
    const synth = this.synths[instrument];
    
    // Update ADSR
    if (params.envelope && synth.set) {
      synth.set({ envelope: params.envelope });
    }
  }
}

export const engine = new AudioEngine();
