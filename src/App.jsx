import { useEffect, useState, useCallback } from 'react';
import { engine } from './engine/AudioEngine';
import { useStore } from './store/useStore';
import TrackHeaders from './components/TrackHeaders';
import Timeline from './components/Timeline';
import PianoRoll from './components/PianoRoll';
import ConfirmModal from './components/ConfirmModal';
import { Save, FolderOpen, Download, Undo2, Redo2, Volume2 } from 'lucide-react';
import './index.css';

// 1.2 FIX: Direct hex colors instead of broken CSS variables
export const INSTRUMENTS = [
  { id: 'kick', name: 'Sonar Ping', color: '#f43f5e' },
  { id: 'sub', name: 'Deep Sea Sub', color: '#3b82f6' },
  { id: 'pad', name: 'Whale Song Pad', color: '#a855f7' },
  { id: 'crystal', name: 'Bioluminescent Arp', color: '#2dd4bf' },
  { id: 'snare', name: 'Ocean Snare', color: '#f59e0b' },
  { id: 'hat', name: 'Coral Hat', color: '#facc15' },
  { id: 'lead', name: 'Abyssal Lead', color: '#ef4444' },
  { id: 'keys', name: 'Sunbeam Keys', color: '#84cc16' },
];

export default function App() {
  // 1.7 FIX: isPlaying now lives in Zustand store
  const isPlaying = useStore(state => state.isPlaying);
  const setIsPlaying = useStore(state => state.setIsPlaying);
  const selectedClipIds = useStore(state => state.selectedClipIds);
  const setSelectedClipIds = useStore(state => state.setSelectedClipIds);
  const clearSelection = useStore(state => state.clearSelection);
  const loadProject = useStore(state => state.loadProject);
  const setActiveTool = useStore(state => state.setActiveTool);
  const removeSelectedClips = useStore(state => state.removeSelectedClips);
  const copySelectedClips = useStore(state => state.copySelectedClips);
  const pasteClips = useStore(state => state.pasteClips);
  const toasts = useStore(state => state.toasts);
  const addToast = useStore(state => state.addToast);

  const [isExporting, setIsExporting] = useState(false);
  const [masterVolume, setMasterVolume] = useState(90); // 0-100 range for UI

  // Zundo undo/redo
  const undo = useStore.temporal?.getState().undo || (() => {});
  const redo = useStore.temporal?.getState().redo || (() => {});

  useEffect(() => {
    const initAudio = async () => {
      await engine.init();
    };
    window.addEventListener('click', initAudio, { once: true });
  }, []);

  // 2.5: Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't trigger shortcuts when typing in inputs
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;

      if (e.code === 'Space') {
        e.preventDefault();
        handlePlayToggle();
      } else if (e.key === 'v' && !e.ctrlKey && !e.metaKey) {
        setActiveTool('move');
      } else if ((e.key === 'd' || e.key === 'b') && !e.ctrlKey && !e.metaKey) {
        setActiveTool('draw');
      } else if (e.key === 'e' && !e.ctrlKey && !e.metaKey) {
        setActiveTool('erase');
      } else if (e.key === 'c' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        copySelectedClips();
        addToast('Copied to clipboard');
      } else if (e.key === 'v' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        const currentBeat = engine.getPlayheadPosition(80) / 80;
        pasteClips(currentBeat);
        addToast('Pasted clips');
      } else if (e.key === 'z' && e.ctrlKey && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.key === 'z' && e.ctrlKey && e.shiftKey) || (e.key === 'y' && e.ctrlKey)) {
        e.preventDefault();
        redo();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        removeSelectedClips();
      } else if (e.key === 'Escape') {
        clearSelection();
      } else if (e.key === 'Home') {
        handleReplay();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedClipIds, isPlaying]);

  const handlePlayToggle = useCallback(async () => {
    if (!engine.isInitialized) {
      await engine.init();
    }
    const currentPlaying = useStore.getState().isPlaying;
    const newPlaying = !currentPlaying;
    setIsPlaying(newPlaying);
    engine.togglePlay(newPlaying);
  }, []);

  const handleReplay = useCallback(() => {
    engine.replay();
    setIsPlaying(true);
  }, []);

  const handleSave = () => {
    const state = useStore.getState();
    const data = JSON.stringify({ tracks: state.tracks, clips: state.clips, bpm: state.bpm }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'musicly_subnautica.json';
    a.click();
    URL.revokeObjectURL(url);
    addToast('Project saved ✓');
  };

  const handleLoad = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        loadProject(data);
        addToast('Project loaded ✓');
      } catch (error) {
        addToast('Invalid project file', 'error');
      }
    };
    reader.readAsText(file);
  };

  const handleExport = async () => {
    if (isExporting) return;
    setIsExporting(true);
    addToast('Rendering WAV...', 'info');
    try {
      const url = await engine.exportWav(useStore.getState().tracks, useStore.getState().clips, useStore.getState().bpm);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'musicly_bounce.wav';
      a.click();
      URL.revokeObjectURL(url);
      addToast('Export complete ✓');
    } catch (err) {
      console.error(err);
      addToast('Export failed', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  // 3.8: Master Volume control
  const handleMasterVolume = (e) => {
    const val = parseInt(e.target.value);
    setMasterVolume(val);
    if (engine.isInitialized && engine.effects.masterGain) {
      engine.effects.masterGain.gain.rampTo(val / 100, 0.05);
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-subnautica-base text-white overflow-hidden font-sans selection:bg-subnautica-active/30">
      {/* 4.1: Animated ocean bubbles background */}
      <div className="ocean-bubbles" aria-hidden="true">
        {Array.from({ length: 15 }).map((_, i) => (
          <div key={i} className="bubble" style={{
            left: `${(i * 7.3) % 100}%`,
            animationDelay: `${(i * 1.7) % 12}s`,
            animationDuration: `${8 + (i * 3) % 10}s`,
            width: `${3 + (i * 2) % 6}px`,
            height: `${3 + (i * 2) % 6}px`,
            opacity: 0.1 + (i % 5) * 0.05,
          }} />
        ))}
      </div>

      {/* Topbar */}
      <div className="h-14 border-b border-subnautica-border glass-panel flex items-center px-6 justify-between shrink-0 relative z-10">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold font-mono tracking-wider text-subnautica-active drop-shadow-[0_0_10px_rgba(56,189,248,0.5)]">
            MUSICLY <span className="text-emerald-400 text-sm">OS</span>
          </h1>
          <div className="h-6 w-px bg-white/20 mx-2"></div>

          <button className="btn-subnautica" onClick={handleSave} title="Save Project (Ctrl+S)">
            <Save size={14} /> Save
          </button>

          <label className="btn-subnautica cursor-pointer" title="Load Project">
            <FolderOpen size={14} /> Load
            <input type="file" className="hidden" accept=".json" onChange={handleLoad} />
          </label>

          <button className={`btn-subnautica ${isExporting ? 'active' : ''}`} onClick={handleExport} title="Export Audio">
            <Download size={14} /> {isExporting ? 'Stop Export' : 'Export'}
          </button>
        </div>

        <div className="flex items-center gap-3">
          {/* 3.8: Master Volume */}
          <div className="flex items-center gap-2 mr-4">
            <Volume2 size={14} className="text-subnautica-active" />
            <input
              type="range" min="0" max="100" step="1"
              value={masterVolume}
              onChange={handleMasterVolume}
              className="slider-subnautica w-20"
              title={`Master Volume: ${masterVolume}%`}
            />
          </div>

          <button className="btn-subnautica" onClick={() => undo()} title="Undo (Ctrl+Z)">
            <Undo2 size={14} /> Undo
          </button>
          <button className="btn-subnautica" onClick={() => redo()} title="Redo (Ctrl+Shift+Z)">
            <Redo2 size={14} /> Redo
          </button>
        </div>
      </div>

      {/* Main Workspace */}
      <div className="flex flex-1 overflow-hidden relative z-10">
        <TrackHeaders instruments={INSTRUMENTS} />
        <Timeline instruments={INSTRUMENTS} />
      </div>

      {/* Piano Roll Modal with animation (4.4) */}
      {selectedClipIds.length > 0 && (
        <PianoRoll clipId={selectedClipIds[0]} instruments={INSTRUMENTS} />
      )}

      {/* Confirm Modal (rendered globally, controlled by store) */}
      <ConfirmModal />

      {/* 4.5: Toast Notifications */}
      <div className="fixed bottom-4 right-4 z-[200] flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <div key={toast.id} className="bg-subnautica-panel border border-subnautica-active/50 rounded shadow-lg px-4 py-2 text-[11px] font-semibold text-white/90 backdrop-blur-md transition-all duration-300 transform translate-y-0 opacity-100">
            {toast.message}
          </div>
        ))}
      </div>
    </div>
  );
}
