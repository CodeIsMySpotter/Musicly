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
      (state) => ({ tracks: state.tracks, clips: state.clips, bpm: state.bpm, loopRegion: state.loopRegion }),
      ({ tracks, clips, bpm, loopRegion }) => {
        this.sync(tracks, clips, bpm, loopRegion);
      },
      { equalityFn: (a, b) => a.tracks === b.tracks && a.clips === b.clips && a.bpm === b.bpm && a.loopRegion === b.loopRegion }
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

  sync(tracks, clips, bpm, loopRegion) {
    if (!this.isInitialized) return;

    if (this.lastBpm !== bpm) {
      Tone.Transport.bpm.value = bpm;
      this.lastBpm = bpm;
    }
    
    if (loopRegion) {
      Tone.Transport.loopStart = loopRegion.start * Tone.Time("4n").toSeconds();
      Tone.Transport.loopEnd = Math.max(loopRegion.start + 0.25, loopRegion.end) * Tone.Time("4n").toSeconds();
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
          duration: noteDurationBeat * Tone.Time("4n").toSeconds(),
          velocity: noteEvent.velocity !== undefined ? noteEvent.velocity : 0.8
        });
      });
    });

    this.part = new Tone.Part((time, value) => {
      const strip = this.trackStrips[value.trackId];
      if (!strip) return;

      try {
        if (value.instId === 'snare' || value.instId === 'hat') {
          strip.synth.triggerAttackRelease(value.duration, time, value.velocity);
        } else {
          strip.synth.triggerAttackRelease(value.note, value.duration, time, value.velocity);
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
          note: i % 4 === 0 ? 'G5' : 'C5',
          isDownbeat: i % 4 === 0
        });
      }
      this.metronomePart = new Tone.Part((time, value) => {
        this.metronomeSynth.triggerAttackRelease(value.note, "32n", time, value.isDownbeat ? 0.5 : 0.25);
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

  startIsolatedPlayback(clipId, trackId) {
    if (!this.isInitialized) return;
    
    // 1. Mute all tracks except the one being edited
    Object.keys(this.trackStrips).forEach(tid => {
      this.trackStrips[tid].channel.mute = (tid !== trackId);
    });

    // 2. Set loop to clip boundaries
    const clip = useStore.getState().clips.find(c => c.id === clipId);
    if (clip) {
      this.originalLoopStart = Tone.Transport.loopStart;
      this.originalLoopEnd = Tone.Transport.loopEnd;
      this.originalLoop = Tone.Transport.loop;
      
      const startSec = (clip.x / BEAT_WIDTH) * Tone.Time("4n").toSeconds();
      const endSec = ((clip.x + clip.width) / BEAT_WIDTH) * Tone.Time("4n").toSeconds();
      
      Tone.Transport.loopStart = startSec;
      Tone.Transport.loopEnd = endSec;
      Tone.Transport.loop = true;
      Tone.Transport.seconds = startSec;
    }
    
    this.effects.masterGain.gain.rampTo(0.9, 0.05);
    Tone.Transport.start();
  }

  stopIsolatedPlayback() {
    if (!this.isInitialized) return;
    Tone.Transport.pause();
    this.effects.masterGain.gain.rampTo(0, 0.05);
    
    // Release synths
    Object.values(this.trackStrips).forEach(strip => {
      const synth = strip.synth;
      if (synth.releaseAll) synth.releaseAll();
      else if (synth.triggerRelease) synth.triggerRelease(Tone.now());
    });
    
    // Restore loop
    if (this.originalLoopStart !== undefined) {
      Tone.Transport.loopStart = this.originalLoopStart;
      Tone.Transport.loopEnd = this.originalLoopEnd;
      Tone.Transport.loop = this.originalLoop;
    }
    
    // Restore mutes from store
    const tracks = useStore.getState().tracks;
    const anySolo = tracks.some(t => t.solo);
    tracks.forEach(t => {
      if (this.trackStrips[t.id]) {
        this.trackStrips[t.id].channel.mute = t.mute || (anySolo && !t.solo);
      }
    });
  }

  async exportWav(tracks, clips, bpm) {
    // Determine max duration
    const beatTime = 60 / bpm;
    let maxSeconds = 0;
    clips.forEach(clip => {
      const endBeat = (clip.x + clip.width) / BEAT_WIDTH;
      const endSec = endBeat * beatTime;
      if (endSec > maxSeconds) maxSeconds = endSec;
    });
    maxSeconds += 2; // reverb tail

    const buffer = await Tone.Offline(({ transport }) => {
      transport.bpm.value = bpm;

      // Create effects
      const masterGain = new Tone.Gain(0.9).toDestination();
      const masterDelay = new Tone.FeedbackDelay({ delayTime: "8n", feedback: 0.3, wet: 0.2 }).connect(masterGain);
      const masterReverb = new Tone.Reverb({ decay: 6.0, wet: 0.4 }).connect(masterDelay);
      const masterFilter = new Tone.Filter({ frequency: 2800, type: "lowpass", rolloff: -24 }).connect(masterReverb);

      // Create tracks
      const strips = {};
      tracks.forEach(track => {
        const channel = new Tone.Channel().connect(masterFilter);
        const synth = createSynth(track.inst);
        synth.connect(channel);
        channel.volume.value = track.volume;
        channel.pan.value = track.pan;
        channel.mute = track.mute;
        strips[track.id] = { channel, synth, instId: track.inst };
      });

      // Schedule events
      const events = [];
      clips.forEach(clip => {
        const track = tracks.find(t => t.id === clip.trackId);
        if (!track) return;
        const clipStartBeat = clip.x / BEAT_WIDTH;
        (clip.notes || []).forEach(noteEvent => {
          const noteStartBeat = clipStartBeat + (noteEvent.time / BEAT_WIDTH);
          const noteDurationBeat = noteEvent.duration / BEAT_WIDTH;
          events.push({
            time: noteStartBeat * beatTime,
            trackId: track.id,
            instId: track.inst,
            note: noteEvent.note,
            duration: noteDurationBeat * beatTime,
            velocity: noteEvent.velocity !== undefined ? noteEvent.velocity : 0.8
          });
        });
      });

      new Tone.Part((time, value) => {
        const strip = strips[value.trackId];
        if (!strip) return;
        if (value.instId === 'snare' || value.instId === 'hat') {
          strip.synth.triggerAttackRelease(value.duration, time, value.velocity);
        } else {
          strip.synth.triggerAttackRelease(value.note, value.duration, time, value.velocity);
        }
      }, events).start(0);

      transport.start();
    }, maxSeconds);

    return this.audioBufferToWavUrl(buffer.get());
  }

  // AudioBuffer to WAV Blob URL helper
  audioBufferToWavUrl(buffer) {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;
    
    const result = new Float32Array(buffer.length * numChannels);
    for (let channel = 0; channel < numChannels; channel++) {
      const channelData = buffer.getChannelData(channel);
      for (let i = 0; i < buffer.length; i++) {
        result[i * numChannels + channel] = channelData[i];
      }
    }

    const dataLength = result.length * (bitDepth / 8);
    const bufferArray = new ArrayBuffer(44 + dataLength);
    const view = new DataView(bufferArray);

    const writeString = (offset, string) => {
      for (let i = 0; i < string.length; i++) view.setUint8(offset + i, string.charCodeAt(i));
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + dataLength, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true); // fmt chunk size
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * (bitDepth / 8), true);
    view.setUint16(32, numChannels * (bitDepth / 8), true);
    view.setUint16(34, bitDepth, true);
    writeString(36, 'data');
    view.setUint32(40, dataLength, true);

    let offset = 44;
    for (let i = 0; i < result.length; i++, offset += 2) {
      let s = Math.max(-1, Math.min(1, result[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }

    const blob = new Blob([view], { type: 'audio/wav' });
    return URL.createObjectURL(blob);
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
  async playNote(instrument, note, duration = "8n", velocity = 0.8) {
    if (!this.isInitialized) {
      await this.init();
    }
    // Lazy-create preview synths so they don't interfere with track synths
    if (!this.previewSynths[instrument]) {
      this.previewSynths[instrument] = createSynth(instrument);
      this.previewSynths[instrument].toDestination();
    }
    const synth = this.previewSynths[instrument];
    try {
      if (instrument === 'snare' || instrument === 'hat') {
        synth.triggerAttackRelease(duration, Tone.now(), velocity);
      } else {
        synth.triggerAttackRelease(note, duration, Tone.now(), velocity);
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
