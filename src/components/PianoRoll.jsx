import React, { useRef, useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { Rnd } from 'react-rnd';
import { X, Pencil, MousePointer2, Scissors } from 'lucide-react';
import { engine } from '../engine/AudioEngine';

// Full chromatic range across multiple octaves
const NOTES = [
  'B5','A#5','A5','G#5','G5','F#5','F5','E5','D#5','D5','C#5','C5',
  'B4','A#4','A4','G#4','G4','F#4','F4','E4','D#4','D4','C#4','C4',
  'B3','A#3','A3','G#3','G3','F#3','F3','E3','D#3','D3','C#3','C3',
  'B2','A#2','A2','G#2','G2','F#2','F2','E2','D#2','D2','C#2','C2',
  'B1','A#1','A1','G#1','G1','F#1','F1','E1','D#1','D1','C#1','C1',
];
const NOTE_HEIGHT = 18;
const BEAT_WIDTH = 80;

export default function PianoRoll({ instruments }) {
  const selectedClipId = useStore(state => state.selectedClipId);
  const setSelectedClipId = useStore(state => state.setSelectedClipId);
  const clips = useStore(state => state.clips);
  const tracks = useStore(state => state.tracks);
  const updateClipNotes = useStore(state => state.updateClipNotes);
  const gridSnap = useStore(state => state.gridSnap);

  const [tool, setTool] = useState('draw');
  const [isVisible, setIsVisible] = useState(false); // For enter animation
  const containerRef = useRef(null);

  const clip = clips.find(c => c.id === selectedClipId);

  // 4.4: Entry animation
  useEffect(() => {
    requestAnimationFrame(() => setIsVisible(true));
  }, []);

  if (!clip) return null;

  const track = tracks.find(t => t.id === clip.trackId);
  const notes = clip.notes || [];
  const instData = instruments?.find(i => i.id === track?.inst);

  // 2.6: Context info
  const clipBar = Math.floor(clip.x / (BEAT_WIDTH * 4)) + 1;
  const clipBeat = Math.floor((clip.x % (BEAT_WIDTH * 4)) / BEAT_WIDTH) + 1;

  const handleContainerMouseDown = (e) => {
    if (tool !== 'draw') return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left + containerRef.current.scrollLeft;
    const y = e.clientY - rect.top + containerRef.current.scrollTop;

    const snappedX = Math.round(x / gridSnap) * gridSnap;
    const noteIdx = Math.floor(y / NOTE_HEIGHT);

    // 2.7: Restrict notes to clip width
    if (snappedX >= clip.width) return;

    if (noteIdx >= 0 && noteIdx < NOTES.length) {
      const noteName = NOTES[noteIdx];
      const noteDuration = Math.min(gridSnap * 2, clip.width - snappedX); // Don't exceed clip
      const newNote = {
        id: Date.now().toString(),
        note: noteName,
        time: snappedX,
        duration: noteDuration
      };

      engine.playNote(track?.inst || 'pad', noteName, "8n");
      updateClipNotes(clip.id, [...notes, newNote]);
    }
  };

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => setSelectedClipId(null), 200);
  };

  return (
    <div className={`fixed inset-0 bg-black/80 flex items-center justify-center z-[100] backdrop-blur-sm p-8 transition-opacity duration-200 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
      <div className={`bg-subnautica-panel border border-subnautica-active/50 rounded-xl w-full max-w-5xl h-[80vh] flex flex-col shadow-[0_0_50px_rgba(56,189,248,0.1)] overflow-hidden transition-transform duration-200 ${isVisible ? 'translate-y-0 scale-100' : 'translate-y-8 scale-95'}`}>

        {/* Header with context info (2.6) */}
        <div className="h-14 border-b border-white/10 flex items-center justify-between px-6 bg-white/5 shrink-0">
          <div className="flex items-center gap-3">
            <div>
              <h2 className="text-sm font-bold text-emerald-400 m-0 tracking-wider">PIANO ROLL</h2>
              <p className="text-[10px] text-white/50 m-0">
                {track?.name || 'Track'} — Bar {clipBar}, Beat {clipBeat}
              </p>
            </div>
            {/* 2.6: Instrument badge */}
            {instData && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${instData.color}30`, color: instData.color, border: `1px solid ${instData.color}50` }}>
                {instData.name}
              </span>
            )}
          </div>

          <div className="flex gap-2">
            <button onClick={() => setTool('move')} className={`btn-subnautica ${tool === 'move' ? 'active' : ''}`} title="Move Tool"><MousePointer2 size={14} /></button>
            <button onClick={() => setTool('draw')} className={`btn-subnautica ${tool === 'draw' ? 'active' : ''}`} title="Draw Tool"><Pencil size={14} /></button>
            <button onClick={() => setTool('erase')} className={`btn-subnautica ${tool === 'erase' ? 'active' : ''}`} title="Erase Tool"><Scissors size={14} /></button>

            <div className="w-px bg-white/20 mx-2"></div>

            <button onClick={handleClose} className="btn-subnautica text-rose-400 hover:text-rose-300 hover:bg-rose-500/20 hover:border-rose-400">
              <X size={14} /> Close <span className="text-[9px] opacity-50 ml-1">(Esc)</span>
            </button>
          </div>
        </div>

        {/* Editor */}
        <div className="flex-1 flex overflow-hidden">
          {/* Piano Keys */}
          <div className="w-14 flex flex-col shrink-0 border-r border-white/10 bg-black/40 overflow-y-auto overflow-x-hidden">
            {NOTES.map((note) => {
              const isSharp = note.includes('#');
              const isC = note.startsWith('C') && !note.includes('#');
              return (
                <div
                  key={note}
                  className={`flex items-center justify-end pr-1.5 border-b cursor-pointer transition-colors shrink-0 ${
                    isSharp ? 'bg-slate-900 text-white/30 border-white/5 hover:bg-emerald-500/20'
                    : isC ? 'bg-white/15 text-white/90 border-white/15 hover:bg-emerald-500/30'
                    : 'bg-white/8 text-white/60 border-white/8 hover:bg-emerald-500/25'
                  }`}
                  style={{ height: NOTE_HEIGHT, minHeight: NOTE_HEIGHT }}
                  onClick={() => engine.playNote(track?.inst || 'pad', note, "8n")}
                >
                  {/* 4.5: Show note name only on C keys, hide rest */}
                  <span className="text-[8px] font-mono">
                    {isC ? note : (isSharp ? '' : '')}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Grid */}
          <div
            className="flex-1 overflow-auto relative bg-subnautica-deep"
            ref={containerRef}
            onMouseDown={handleContainerMouseDown}
            style={{ cursor: tool === 'draw' ? 'crosshair' : 'default' }}
          >
            {/* 2.7: Clip width boundary indicator */}
            <div style={{ width: clip.width + 40, height: NOTES.length * NOTE_HEIGHT, position: 'relative' }}>
              {/* Clip end boundary */}
              <div className="absolute top-0 bottom-0 w-px bg-rose-500/30" style={{ left: clip.width }} />
              <div className="absolute top-0 bottom-0 bg-black/40" style={{ left: clip.width, right: 0 }} />

              {/* Horizontal note lanes */}
              {NOTES.map((note, i) => {
                const isSharp = note.includes('#');
                const isC = note.startsWith('C') && !note.includes('#');
                return (
                  <div
                    key={i}
                    className="absolute left-0 pointer-events-none"
                    style={{
                      top: i * NOTE_HEIGHT,
                      height: NOTE_HEIGHT,
                      right: 0,
                      background: isSharp ? 'rgba(0,0,0,0.15)' : isC ? 'rgba(56, 189, 248, 0.03)' : 'transparent',
                      borderBottom: isC ? '1px solid rgba(56, 189, 248, 0.08)' : '1px solid rgba(255,255,255,0.03)'
                    }}
                  />
                );
              })}

              {/* Vertical grid */}
              {Array.from({ length: Math.ceil((clip.width + 40) / gridSnap) }).map((_, i) => (
                <div key={i} className="absolute top-0 bottom-0 pointer-events-none" style={{
                  left: i * gridSnap,
                  width: '1px',
                  background: (i * gridSnap) % BEAT_WIDTH === 0 ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.02)'
                }} />
              ))}

              {/* Notes */}
              {notes.map(noteObj => {
                const noteIdx = NOTES.indexOf(noteObj.note);
                if (noteIdx === -1) return null;

                return (
                  <Rnd
                    key={noteObj.id}
                    bounds="parent"
                    dragAxis="both"
                    disableDragging={tool !== 'move'}
                    enableResizing={{ right: tool === 'move', left: false, top: false, bottom: false, topRight: false, bottomRight: false, bottomLeft: false, topLeft: false }}
                    dragGrid={[gridSnap, NOTE_HEIGHT]}
                    resizeGrid={[gridSnap, 1]}
                    size={{ width: noteObj.duration, height: NOTE_HEIGHT - 2 }}
                    position={{ x: noteObj.time, y: noteIdx * NOTE_HEIGHT + 1 }}
                    onDragStop={(e, d) => {
                      let newNoteIdx = Math.round((d.y - 1) / NOTE_HEIGHT);
                      newNoteIdx = Math.max(0, Math.min(NOTES.length - 1, newNoteIdx));
                      const updated = notes.map(n => n.id === noteObj.id ? { ...n, time: Math.max(0, d.x), note: NOTES[newNoteIdx] } : n);
                      updateClipNotes(clip.id, updated);
                      engine.playNote(track?.inst || 'pad', NOTES[newNoteIdx], "8n");
                    }}
                    onResizeStop={(e, direction, ref) => {
                      const updated = notes.map(n => n.id === noteObj.id ? { ...n, duration: parseInt(ref.style.width, 10) } : n);
                      updateClipNotes(clip.id, updated);
                    }}
                    style={{
                      background: instData?.color || '#34d399',
                      borderRadius: '3px',
                      boxShadow: `0 0 8px ${instData?.color || '#34d399'}60`,
                      cursor: tool === 'erase' ? 'crosshair' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      paddingLeft: '3px',
                      overflow: 'hidden',
                      transition: 'filter 0.1s',
                    }}
                    className="hover:brightness-125"
                  >
                    <div
                      className="w-full h-full text-[7px] font-bold text-black/80 flex items-center leading-none"
                      onMouseDown={(e) => {
                        if (tool === 'erase') {
                          e.stopPropagation();
                          updateClipNotes(clip.id, notes.filter(n => n.id !== noteObj.id));
                        }
                      }}
                    >
                      {noteObj.note}
                    </div>
                  </Rnd>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
