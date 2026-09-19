import { create } from 'zustand';
import { temporal } from 'zundo';
import { subscribeWithSelector } from 'zustand/middleware';

export const useStore = create(
  subscribeWithSelector(
    temporal(
      (set, get) => ({
        // --- Project Settings ---
        bpm: 80,
        gridSnap: 0.25, // multiplier of BEAT_WIDTH (e.g. 0.25 = 1/4 beat)
        zoom: 1, // multiplier (0.25 – 4)

        // --- Transport ---
        isPlaying: false,
        setIsPlaying: (isPlaying) => set({ isPlaying }),
        loopRegion: { start: 0, end: 16 }, // in beats
        setLoopRegion: (start, end) => set({ loopRegion: { start, end } }),

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
        selectedClipIds: [],
        clipboard: [],
        confirmModal: null, // { title, message, onConfirm }
        showConfirmModal: (title, message, onConfirm) => set({ confirmModal: { title, message, onConfirm } }),
        hideConfirmModal: () => set({ confirmModal: null }),

        // --- Toasts ---
        toasts: [],
        addToast: (message, type = 'success') => {
          const id = Date.now();
          set((state) => ({ toasts: [...state.toasts, { id, message, type }] }));
          setTimeout(() => get().removeToast(id), 3000);
        },
        removeToast: (id) => set((state) => ({ toasts: state.toasts.filter(t => t.id !== id) })),

        // --- Context Menu ---
        contextMenu: null, // { x, y, clipId }
        showContextMenu: (x, y, clipId) => set({ contextMenu: { x, y, clipId } }),
        hideContextMenu: () => set({ contextMenu: null }),

        // --- Actions ---
        setBpm: (bpm) => set({ bpm }),
        setGridSnap: (gridSnap) => set({ gridSnap }),
        setZoom: (zoom) => set({ zoom: Math.max(0.25, Math.min(4, zoom)) }),
        setActiveTool: (activeTool) => set({ activeTool }),
        
        setSelectedClipIds: (id, append = false) => set((state) => {
          if (append) {
            if (state.selectedClipIds.includes(id)) {
              return { selectedClipIds: state.selectedClipIds.filter(x => x !== id) };
            }
            return { selectedClipIds: [...state.selectedClipIds, id] };
          }
          return { selectedClipIds: id ? [id] : [] };
        }),
        clearSelection: () => set({ selectedClipIds: [] }),

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
        moveTrack: (id, direction) => set((state) => {
          const index = state.tracks.findIndex(t => t.id === id);
          if (index < 0) return {};
          if (direction === -1 && index === 0) return {};
          if (direction === 1 && index === state.tracks.length - 1) return {};
          const newTracks = [...state.tracks];
          const temp = newTracks[index];
          newTracks[index] = newTracks[index + direction];
          newTracks[index + direction] = temp;
          return { tracks: newTracks };
        }),

        // Clips Actions
        addClip: (clip) => set((state) => ({
          clips: [...state.clips, { id: Date.now(), ...clip }]
        })),
        updateClip: (id, updates) => set((state) => ({
          clips: state.clips.map(c => c.id === id ? { ...c, ...updates } : c)
        })),
        removeClip: (id) => set((state) => ({
          clips: state.clips.filter(c => c.id !== id),
          selectedClipIds: state.selectedClipIds.filter(x => x !== id)
        })),
        removeSelectedClips: () => set((state) => ({
          clips: state.clips.filter(c => !state.selectedClipIds.includes(c.id)),
          selectedClipIds: []
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

        // 3.6: Clipboard operations
        copySelectedClips: () => set((state) => {
          const toCopy = state.clips.filter(c => state.selectedClipIds.includes(c.id));
          if (toCopy.length === 0) return {};
          // Sort by x position
          toCopy.sort((a, b) => a.x - b.x);
          return { clipboard: toCopy };
        }),
        pasteClips: (playheadBeat) => set((state) => {
          if (!state.clipboard || state.clipboard.length === 0) return {};
          
          const BEAT_WIDTH = 80;
          const playheadX = playheadBeat * BEAT_WIDTH;
          const firstClipX = state.clipboard[0].x;
          const offset = playheadX - firstClipX;
          
          const newClips = state.clipboard.map(c => ({
            ...c,
            id: Date.now() + Math.random(),
            x: Math.max(0, c.x + offset),
            notes: (c.notes || []).map(n => ({ ...n, id: Date.now() + Math.random() }))
          }));
          
          return {
            clips: [...state.clips, ...newClips],
            selectedClipIds: newClips.map(c => c.id)
          };
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
