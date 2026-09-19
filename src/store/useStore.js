import { create } from 'zustand';
import { temporal } from 'zundo';
import { subscribeWithSelector } from 'zustand/middleware';

export const useStore = create(
  subscribeWithSelector(
    temporal(
      (set, get) => ({
        // --- Project Settings ---
        bpm: 80,
        gridSnap: 20, // pixels — 1/4 beat (BEAT_WIDTH=80)
        zoom: 1, // multiplier (0.25 – 4)

        // --- Transport ---
        isPlaying: false,
        setIsPlaying: (isPlaying) => set({ isPlaying }),

        // --- Tracks ---
        tracks: [
          { id: 't1', name: 'Track 1', inst: 'kick', volume: 0, pan: 0, mute: false, solo: false },
          { id: 't2', name: 'Track 2', inst: 'pad', volume: 0, pan: 0, mute: false, solo: false },
          { id: 't3', name: 'Track 3', inst: 'crystal', volume: 0, pan: 0, mute: false, solo: false },
          { id: 't4', name: 'Track 4', inst: 'sub', volume: 0, pan: 0, mute: false, solo: false },
        ],

        // --- Clips (formerly blocks) ---
        clips: [
          { id: 1, trackId: 't1', x: 0, width: 80 * 2, notes: [{ id: 'n1', note: 'C1', time: 0, duration: 80 }] },
          { id: 2, trackId: 't2', x: 0, width: 80 * 4, notes: [{ id: 'n2', note: 'C3', time: 0, duration: 80 * 4 }] },
          { id: 3, trackId: 't3', x: 80 * 2, width: 80, notes: [{ id: 'n3', note: 'C4', time: 0, duration: 80 }] },
        ],

        // --- Metronome ---
        metronomeEnabled: false,
        setMetronomeEnabled: (v) => set({ metronomeEnabled: v }),

        // --- UI State ---
        activeTool: 'move', // move, draw, erase
        selectedClipId: null,
        
        // --- Confirm Modal ---
        confirmModal: null, // { title, message, onConfirm }
        showConfirmModal: (title, message, onConfirm) => set({ confirmModal: { title, message, onConfirm } }),
        hideConfirmModal: () => set({ confirmModal: null }),

        // --- Context Menu ---
        contextMenu: null, // { x, y, clipId }
        showContextMenu: (x, y, clipId) => set({ contextMenu: { x, y, clipId } }),
        hideContextMenu: () => set({ contextMenu: null }),

        // --- Actions ---
        setBpm: (bpm) => set({ bpm }),
        setGridSnap: (gridSnap) => set({ gridSnap }),
        setZoom: (zoom) => set({ zoom: Math.max(0.25, Math.min(4, zoom)) }),
        setActiveTool: (activeTool) => set({ activeTool }),
        setSelectedClipId: (selectedClipId) => set({ selectedClipId }),

        // Tracks Actions
        addTrack: () => set((state) => ({
          tracks: [...state.tracks, {
            id: `t${Date.now()}`,
            name: `Track ${state.tracks.length + 1}`,
            inst: 'kick',
            volume: 0, pan: 0, mute: false, solo: false
          }]
        })),
        updateTrack: (id, updates) => set((state) => ({
          tracks: state.tracks.map(t => t.id === id ? { ...t, ...updates } : t)
        })),
        removeTrack: (id) => set((state) => ({
          tracks: state.tracks.filter(t => t.id !== id),
          clips: state.clips.filter(c => c.trackId !== id)
        })),

        // Clips Actions
        addClip: (clip) => set((state) => ({
          clips: [...state.clips, { id: Date.now(), ...clip }]
        })),
        updateClip: (id, updates) => set((state) => ({
          clips: state.clips.map(c => c.id === id ? { ...c, ...updates } : c)
        })),
        removeClip: (id) => set((state) => ({
          clips: state.clips.filter(c => c.id !== id),
          selectedClipId: state.selectedClipId === id ? null : state.selectedClipId
        })),
        // 3.5: Duplicate a clip with deep-copied notes
        duplicateClip: (id) => set((state) => {
          const original = state.clips.find(c => c.id === id);
          if (!original) return {};
          const newClip = {
            ...original,
            id: Date.now(),
            x: original.x + original.width + 20, // Place right after original
            notes: (original.notes || []).map(n => ({ ...n, id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}` }))
          };
          return { clips: [...state.clips, newClip] };
        }),

        // Notes Actions (inside clips)
        updateClipNotes: (clipId, notes) => set((state) => ({
          clips: state.clips.map(c => c.id === clipId ? { ...c, notes } : c)
        })),

        loadProject: (data) => set({
          tracks: data.tracks || [],
          clips: data.clips || [],
          bpm: data.bpm || 80
        })
      }),
      {
        limit: 50,
        // Only track undo/redo for data changes, not UI state
        partialize: (state) => ({
          tracks: state.tracks,
          clips: state.clips,
          bpm: state.bpm
        })
      }
    )
  )
);
