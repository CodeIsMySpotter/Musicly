import * as Tone from 'tone';
import { useStore } from '../store/useStore';

// Factory: creates a synth instance for the given instrument id
function createSynth(instId) {
  switch (instId) {
    case 'kick':
      return new Tone.MembraneSynth({
        pitchDecay: 0.08, octaves: 4,
        oscillator: { type: "sine" },
        envelope: { attack: 0.001, decay: 0.45, sustain: 0.01, release: 0.3 }
      });
    case 'pad':
      return new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "fatcustom", partials: [1, 0.4, 0.2], spread: 20, count: 3 },
        envelope: { attack: 1.2, decay: 1.5, sustain: 0.8, release: 2.5 }
      });
    case 'crystal':
      return new Tone.FMSynth({
        harmonicity: 2.0, modulationIndex: 2.5,
        oscillator: { type: "triangle" }, modulation: { type: "sine" },
        envelope: { attack: 0.005, decay: 0.2, sustain: 0.02, release: 0.25 },
      });
    case 'sub':
      return new Tone.MonoSynth({
        oscillator: { type: "sine" },
        envelope: { attack: 0.04, decay: 1.2, sustain: 0.6, release: 0.8 }
      });
    case 'snare':
      return new Tone.NoiseSynth({
        noise: { type: "white" },
        envelope: { attack: 0.005, decay: 0.1, sustain: 0, release: 0.1 }
      });
    case 'hat':
      return new Tone.MetalSynth({
        frequency: 200, envelope: { attack: 0.001, decay: 0.1, release: 0.01 },
        harmonicity: 5.1, modulationIndex: 32, resonance: 4000, octaves: 1.5
      });
    case 'lead':
      return new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "sawtooth" },
        envelope: { attack: 0.01, decay: 0.3, sustain: 0.5, release: 1.0 }
      });
    case 'keys':
      return new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "square" },
        envelope: { attack: 0.02, decay: 0.4, sustain: 0.2, release: 1.2 }
      });
    default:
      return new Tone.Synth();
  }
}

const BEAT_WIDTH = 80;

class AudioEngine {
  constructor() {
    this.isInitialized = false;
    this.effects = {};
    this.part = null;
    this.recorder = null;
    this.lastBpm = 80;
    // 1.3 FIX: Per-track synth+channel, keyed by track.id
    // { [trackId]: { channel: Tone.Channel, synth: Tone.Synth, instId: string, meter: Tone.Meter } }
    this.trackStrips = {};
    // Metronome
    this.metronomeSynth = null;
    this.metronomePart = null;
    // Preview synth (for piano roll auditioning, not tied to any track)
    this.previewSynths = {};
  }

  async init() {
    if (this.isInitialized) return;
    await Tone.start();

    // Master FX chain — Subnautica theme
    this.effects.masterGain = new Tone.Gain(0.9).toDestination();
    this.effects.masterDelay = new Tone.FeedbackDelay({ delayTime: "8n", feedback: 0.3, wet: 0.2 }).connect(this.effects.masterGain);
    this.effects.masterReverb = new Tone.Reverb({ decay: 6.0, wet: 0.4 }).connect(this.effects.masterDelay);
    this.effects.masterFilter = new Tone.Filter({ frequency: 2800, type: "lowpass", rolloff: -24 }).connect(this.effects.masterReverb);

    // Metronome synth — short click sound
    this.metronomeSynth = new Tone.Synth({
      oscillator: { type: "triangle" },
      envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.02 }
    }).connect(this.effects.masterGain);

    Tone.Transport.loop = true;
    Tone.Transport.loopEnd = "16m";
    this.isInitialized = true;

    // 1.4 FIX: Subscribe ONLY to tracks, clips, bpm changes using subscribeWithSelector
    useStore.subscribe(
      (state) => ({ tracks: state.tracks, clips: state.clips, bpm: state.bpm }),
      ({ tracks, clips, bpm }) => {
        this.sync(tracks, clips, bpm);
      },
      { equalityFn: (a, b) => a.tracks === b.tracks && a.clips === b.clips && a.bpm === b.bpm }
    );

    // Subscribe to metronome toggle
    useStore.subscribe(
      (state) => state.metronomeEnabled,
      (enabled) => this._syncMetronome(enabled)
    );

    // Initial sync
    const s = useStore.getState();
    this.sync(s.tracks, s.clips, s.bpm);
  }

  sync(tracks, clips, bpm) {
    if (!this.isInitialized) return;

    if (this.lastBpm !== bpm) {
      Tone.Transport.bpm.value = bpm;
      this.lastBpm = bpm;
    }

    // 1. Reconcile per-track channel strips (create/update/remove)
    const activeTrackIds = new Set(tracks.map(t => t.id));

    // Remove strips for deleted tracks
    Object.keys(this.trackStrips).forEach(id => {
      if (!activeTrackIds.has(id)) {
        this.trackStrips[id].synth.dispose();
        this.trackStrips[id].channel.dispose();
        this.trackStrips[id].meter.dispose();
        delete this.trackStrips[id];
      }
    });

    // Create or update strips
    const anySolo = tracks.some(t => t.solo);
    tracks.forEach(track => {
      const existing = this.trackStrips[track.id];

      if (!existing) {
        // Brand new track — create channel + synth + meter
        const channel = new Tone.Channel().connect(this.effects.masterFilter);
        const meter = new Tone.Meter({ smoothing: 0.8 });
        channel.connect(meter);
        const synth = createSynth(track.inst);
        synth.connect(channel);

        this.trackStrips[track.id] = { channel, synth, instId: track.inst, meter };
      } else if (existing.instId !== track.inst) {
        // Instrument changed on this track — swap the synth
        existing.synth.dispose();
        const newSynth = createSynth(track.inst);
        newSynth.connect(existing.channel);
        existing.synth = newSynth;
        existing.instId = track.inst;
      }

      // Update channel parameters
      const strip = this.trackStrips[track.id];
      strip.channel.volume.value = track.volume;
      strip.channel.pan.value = track.pan;
      strip.channel.mute = track.mute || (anySolo && !track.solo);
    });

    // 2. Schedule events from clips
    if (this.part) {
      this.part.dispose();
    }

    const events = [];
    clips.forEach(clip => {
      const track = tracks.find(t => t.id === clip.trackId);
      if (!track) return;

      const clipStartBeat = clip.x / BEAT_WIDTH;

      (clip.notes || []).forEach(noteEvent => {
        const noteStartBeat = clipStartBeat + (noteEvent.time / BEAT_WIDTH);
        const noteDurationBeat = noteEvent.duration / BEAT_WIDTH;

        events.push({
          time: noteStartBeat * Tone.Time("4n").toSeconds(),
          trackId: track.id,
          instId: track.inst,
          note: noteEvent.note,
          duration: noteDurationBeat * Tone.Time("4n").toSeconds()
        });
      });
    });

    this.part = new Tone.Part((time, value) => {
      const strip = this.trackStrips[value.trackId];
      if (!strip) return;

      try {
        if (value.instId === 'snare' || value.instId === 'hat') {
          strip.synth.triggerAttackRelease(value.duration, time);
        } else {
          strip.synth.triggerAttackRelease(value.note, value.duration, time);
        }
      } catch (err) {
        console.error("Error playing synth:", value.instId, err);
      }
    }, events).start(0);
  }

  _syncMetronome(enabled) {
    if (!this.isInitialized) return;
    if (this.metronomePart) {
      this.metronomePart.dispose();
      this.metronomePart = null;
    }
    if (enabled) {
      // Click on every beat for 64 bars
      const events = [];
      for (let i = 0; i < 256; i++) {
        events.push({
          time: i * Tone.Time("4n").toSeconds(),
          note: i % 4 === 0 ? 'G5' : 'C5'
        });
      }
      this.metronomePart = new Tone.Part((time, value) => {
        this.metronomeSynth.triggerAttackRelease(value.note, "32n", time, i % 4 === 0 ? 0.5 : 0.25);
      }, events).start(0);
    }
  }

  togglePlay(isPlaying) {
    if (isPlaying) {
      this.effects.masterGain.gain.rampTo(0.9, 0.05);
      Tone.Transport.start();
    } else {
      Tone.Transport.pause();
      this.effects.masterGain.gain.rampTo(0, 0.05);

      Object.values(this.trackStrips).forEach(strip => {
        const synth = strip.synth;
        if (synth.releaseAll) synth.releaseAll();
        else if (synth.triggerRelease) synth.triggerRelease(Tone.now());
      });
    }
  }

  startRecording() {
    this.recorder = new Tone.Recorder();
    this.effects.masterGain.connect(this.recorder);
    this.recorder.start();
    Tone.Transport.start();
  }

  async stopRecording() {
    Tone.Transport.pause();
    if (this.recorder) {
      const recording = await this.recorder.stop();
      this.effects.masterGain.disconnect(this.recorder);
      this.recorder.dispose();
      this.recorder = null;
      return URL.createObjectURL(recording);
    }
    return null;
  }

  getPlayheadPosition(beatWidth = 80) {
    if (!this.isInitialized) return 0;
    const lookaheadCompensation = Tone.Transport.state === 'started' ? 0.05 : 0;
    const currentBeat = (Tone.Transport.seconds + lookaheadCompensation) / Tone.Time("4n").toSeconds();
    return currentBeat * beatWidth;
  }

  setPlayheadPosition(pixels, beatWidth = 80) {
    if (!this.isInitialized) return;
    const beatTime = Tone.Time("4n").toSeconds();
    if (beatTime > 0) {
      Tone.Transport.seconds = (pixels / beatWidth) * beatTime;
    }
  }

  seek(secondsOffset) {
    if (!this.isInitialized) return;
    Tone.Transport.seconds = Math.max(0, Tone.Transport.seconds + secondsOffset);
  }

  replay() {
    if (!this.isInitialized) return;
    Tone.Transport.seconds = 0;
    Tone.Transport.start();
  }

  // Preview a note (for Piano Roll auditioning) — uses a separate preview synth
  playNote(instrument, note, duration = "8n") {
    if (!this.isInitialized) return;
    // Lazy-create preview synths so they don't interfere with track synths
    if (!this.previewSynths[instrument]) {
      this.previewSynths[instrument] = createSynth(instrument);
      this.previewSynths[instrument].connect(this.effects.masterFilter);
    }
    const synth = this.previewSynths[instrument];
    try {
      if (instrument === 'snare' || instrument === 'hat') {
        synth.triggerAttackRelease(duration);
      } else {
        synth.triggerAttackRelease(note, duration);
      }
    } catch (err) {
      console.error("Error playing preview:", instrument, err);
    }
  }

  // 3.7: Get meter level for a track (returns dB value)
  getTrackLevel(trackId) {
    const strip = this.trackStrips[trackId];
    if (!strip) return -100;
    return strip.meter.getValue();
  }
}

export const engine = new AudioEngine();
