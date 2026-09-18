# Architecture & Roadmap: Musicly (Subnautica Ambient Sequencer)

This document outlines the roadmap to transform the current prototype into a full-fledged browser-based DAW tailored for ambient, underwater-style music creation.

## 1. Current State
- **Framework:** React + Vite
- **Audio Engine:** `Tone.js` wrapped in `AudioEngine.js`
- **UI:** Basic Timeline visualization, Sidebar with instruments, simple Synth Editor modal.
- **Capabilities:** Can trigger hardcoded notes when pressing play. Timeline blocks exist visually but are not fully wired to the sequencer.

## 2. Roadmap to Full Editor

### Phase 1: Interactive Timeline (Drag & Drop)
**Goal:** Allow users to freely place, move, and resize blocks on the timeline.
- [ ] **Drag & Drop Implementation:** Use a library like `dnd-kit` or native HTML5 Drag and Drop to allow dragging instruments from the Sidebar to the Timeline tracks.
- [ ] **Block Resizing:** Allow dragging the edges of blocks to change their duration (translates to note length in `Tone.js`).
- [ ] **Track Management:** Add ability to add, delete, and mute/solo specific tracks.

### Phase 2: Sequencer Integration
**Goal:** Connect the visual timeline directly to `Tone.Transport`.
- [ ] **Time synchronization:** Map pixels on the timeline to musical time (e.g., 100px = 1 bar).
- [ ] **Playhead:** Create a visual playhead line that sweeps across the timeline during playback.
- [ ] **Dynamic Scheduling:** When a block is placed, schedule its start and duration in `Tone.Transport.schedule`. Ensure dynamic updates (if a block is moved while playing, reschedule it).

### Phase 3: Advanced Sound Design (Synth Editor)
**Goal:** Allow deep customization of the Subnautica-like sounds.
- [ ] **ADSR Controls:** Visual envelopes for Attack, Decay, Sustain, Release inside the double-click modal.
- [ ] **Filter Controls:** LPF/HPF cutoff sliders, resonance (Q), and filter sweeps.
- [ ] **Layering System:** Allow a single "instrument" to trigger multiple Tone.js synths simultaneously (e.g., Sub Bass + Bioluminescent Pad).
- [ ] **FX Chain:** Add per-track Reverb and Delay sends.

### Phase 4: Automation & Saving
**Goal:** Make songs dynamic and allow saving/sharing.
- [ ] **Automation Curves:** Allow drawing lines on tracks to automate Filter Cutoff or Volume over time (crucial for ambient swells).
- [ ] **JSON Export/Import:** Serialize the `blocks` state and instrument parameters to a `.json` file for saving and loading projects.
- [ ] **Audio Export (Bounce):** Use `Tone.Offline` to render the composition to a `.wav` file.

## 3. Project Structure Guidelines
- `/src/components`: UI elements (Timeline, Sidebar, Modals).
- `/src/engine`: Audio logic, Tone.js wrappers, playback scheduling.
- `/src/utils`: Helper functions for pixel-to-time math.
- `/src/assets`: Custom sound samples (if not using synthesized sounds).
