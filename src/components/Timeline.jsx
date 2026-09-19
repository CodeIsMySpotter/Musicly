import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { Rnd } from 'react-rnd';
import { engine } from '../engine/AudioEngine';
import { useStore } from '../store/useStore';
import { Play, Square, FastForward, MousePointer2, Scissors, Pencil, ZoomIn, ZoomOut, Metronome } from 'lucide-react';

export const TRACK_HEIGHT = 40;
export const TRACK_GAP = 5;
export const TRACK_STEP_Y = TRACK_HEIGHT + TRACK_GAP; // 45px
export const BASE_BEAT_WIDTH = 80;

// 4.2: Deterministic waveform SVG generator for clip decoration
function generateWaveformPath(clipId, width, height) {
  const seed = typeof clipId === 'number' ? clipId : parseInt(clipId, 10) || 42;
  const points = [];
  const steps = Math.max(10, Math.floor(width / 4));
  for (let i = 0; i <= steps; i++) {
    const x = (i / steps) * width;
    // Pseudo-random using a simple hash of seed + i
    const val = Math.sin(seed * 0.1 + i * 0.7) * Math.cos(seed * 0.3 + i * 1.3);
    const y = height / 2 + val * (height * 0.35);
    points.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  return points.join(' ');
}

export default function Timeline({ instruments }) {
  const timelineRef = useRef(null);
  const [playheadX, setPlayheadX] = useState(0);

  const tracks = useStore(state => state.tracks);
  const clips = useStore(state => state.clips);
  const addClip = useStore(state => state.addClip);
  const updateClip = useStore(state => state.updateClip);
  const removeClip = useStore(state => state.removeClip);
  const duplicateClip = useStore(state => state.duplicateClip);
  const setSelectedClipIds = useStore(state => state.setSelectedClipIds);
  const selectedClipIds = useStore(state => state.selectedClipIds);
  const clearSelection = useStore(state => state.clearSelection);
  const activeTool = useStore(state => state.activeTool);
  const setActiveTool = useStore(state => state.setActiveTool);
  const bpm = useStore(state => state.bpm);
  const setBpm = useStore(state => state.setBpm);
  const gridSnap = useStore(state => state.gridSnap); // Now a multiplier (e.g. 0.25)
  const setGridSnap = useStore(state => state.setGridSnap);
  const zoom = useStore(state => state.zoom);
  const setZoom = useStore(state => state.setZoom);
  const isPlaying = useStore(state => state.isPlaying);
  const setIsPlaying = useStore(state => state.setIsPlaying);
  const metronomeEnabled = useStore(state => state.metronomeEnabled);
  const setMetronomeEnabled = useStore(state => state.setMetronomeEnabled);
  const showContextMenu = useStore(state => state.showContextMenu);
  const contextMenu = useStore(state => state.contextMenu);
  const hideContextMenu = useStore(state => state.hideContextMenu);
  const loopRegion = useStore(state => state.loopRegion);
  const setLoopRegion = useStore(state => state.setLoopRegion);

  const beatWidth = BASE_BEAT_WIDTH * zoom;
  const effectiveSnap = gridSnap * BASE_BEAT_WIDTH * zoom;

  // 1.4: Sync bar ruler scroll
  const barRulerRef = useRef(null);
  const handleScroll = (e) => {
    if (barRulerRef.current && timelineRef.current) {
      barRulerRef.current.scrollLeft = timelineRef.current.scrollLeft;
    }
    // 4.6: Sync Y scroll with track headers
    const headers = document.getElementById('track-headers-scroll');
    if (headers && e.target && headers.scrollTop !== e.target.scrollTop) {
      headers.scrollTop = e.target.scrollTop;
    }
  };

  // 1.6: Context menu outside click
  useEffect(() => {
    const handleGlobalClick = (e) => {
      if (contextMenu) {
        hideContextMenu();
      }
    };
    if (contextMenu) {
      // Small timeout so the event that opened the menu doesn't immediately close it
      setTimeout(() => window.addEventListener('click', handleGlobalClick), 0);
    }
    return () => window.removeEventListener('click', handleGlobalClick);
  }, [contextMenu]);

  // 3.10: Time display
  const [timeDisplay, setTimeDisplay] = useState('001:01:000');

  // Playhead animation loop
  useEffect(() => {
    let animationFrameId;
    const update = () => {
      const px = engine.getPlayheadPosition(beatWidth);
      setPlayheadX(px);

      // 3.10: Compute BAR:BEAT:TICK
      if (engine.isInitialized) {
        const seconds = engine.isInitialized ? (px / beatWidth) * (60 / bpm) : 0;
        const totalBeats = px / beatWidth;
        const bar = Math.floor(totalBeats / 4) + 1;
        const beat = Math.floor(totalBeats % 4) + 1;
        const tick = Math.floor((totalBeats % 1) * 1000);
        setTimeDisplay(`${String(bar).padStart(3, '0')}:${String(beat).padStart(2, '0')}:${String(tick).padStart(3, '0')}`);
      }

      if (isPlaying) {
        animationFrameId = requestAnimationFrame(update);
      }
    };
    if (isPlaying) {
      animationFrameId = requestAnimationFrame(update);
    } else {
      update(); // Single update when paused
    }
    return () => cancelAnimationFrame(animationFrameId);
  }, [isPlaying, beatWidth, bpm]);

  // 1.6: Horizontal wheel scroll
  useEffect(() => {
    const node = timelineRef.current;
    if (!node) return;
    const handleWheel = (e) => {
      // 3.1: Ctrl+Scroll = zoom
      if (e.ctrlKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.15 : 0.15;
        setZoom(zoom + delta);
        return;
      }
      // Regular scroll: map vertical to horizontal
      if (e.deltaY !== 0 && e.deltaX === 0) {
        e.preventDefault();
        node.scrollBy({ left: e.deltaY, behavior: 'auto' });
      }
    };
    node.addEventListener('wheel', handleWheel, { passive: false });
    return () => node.removeEventListener('wheel', handleWheel);
  }, [zoom]);

  const handlePlayToggle = useCallback(async () => {
    if (!engine.isInitialized) await engine.init();
    const newPlaying = !useStore.getState().isPlaying;
    setIsPlaying(newPlaying);
    engine.togglePlay(newPlaying);
  }, []);

  const handleReplay = useCallback(() => {
    engine.replay();
    setIsPlaying(true);
  }, []);

  // Draw tool & Selection clear
  const handleTimelineMouseDown = (e) => {
    // Close context menu on any click
    if (contextMenu) { hideContextMenu(); return; }

    // Clear selection on empty space click
    if (e.target.id === 'timeline-scroll' || e.target.id === 'timeline-bg') {
      clearSelection();
    }

    if (activeTool !== 'draw') return;
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left + timelineRef.current.scrollLeft;
    const y = e.clientY - rect.top + timelineRef.current.scrollTop;
    const snappedX = Math.round(x / effectiveSnap) * effectiveSnap;
    let trackIdx = Math.floor(y / TRACK_STEP_Y);
    trackIdx = Math.max(0, Math.min(tracks.length - 1, trackIdx));

    if (tracks[trackIdx]) {
      const trackId = tracks[trackIdx].id;
      const width = beatWidth * 2;
      
      // 2.1: Collision detection for drawing
      const hasCollision = clips.some(c => c.trackId === trackId && c.x < snappedX + width && c.x + c.width > snappedX);
      if (hasCollision) return;

      addClip({
        trackId,
        x: snappedX,
        width,
        notes: [{ id: Date.now().toString(), note: 'C3', time: 0, duration: beatWidth * 2 }]
      });
    }
  };

  // Playhead scrub
  const handlePlayheadMouseDown = (e) => {
    e.stopPropagation();
    e.preventDefault();
    const move = (ev) => {
      if (!timelineRef.current) return;
      const rect = timelineRef.current.getBoundingClientRect();
      const x = ev.clientX - rect.left + timelineRef.current.scrollLeft;
      engine.setPlayheadPosition(Math.max(0, x), beatWidth);
      setPlayheadX(engine.getPlayheadPosition(beatWidth));
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  // Helper to get track instrument color
  const getTrackColor = (trackId) => {
    const track = tracks.find(t => t.id === trackId);
    if (!track) return '#38bdf8';
    return instruments?.find(i => i.id === track.inst)?.color || '#38bdf8';
  };
  const getTrackInstName = (trackId) => {
    const track = tracks.find(t => t.id === trackId);
    if (!track) return '';
    return instruments?.find(i => i.id === track.inst)?.name || track.inst;
  };

  // 2.3: Bar numbers
  const totalBars = Math.ceil(3000 / (beatWidth * 4));

  // 3.2: Snap options (multipliers of BEAT_WIDTH)
  const snapOptions = [
    { label: '1/4', value: 0.25 },
    { label: '1/8', value: 0.125 },
    { label: '1/16', value: 0.0625 },
    { label: '1/32', value: 0.03125 },
    { label: 'Off', value: 1 / BASE_BEAT_WIDTH }, // ~1px snap
  ];

  return (
    <div className="flex-1 flex flex-col bg-subnautica-deep/80 relative">
      {/* Toolbar */}
      <div className="h-12 border-b border-subnautica-border glass-panel flex items-center px-4 gap-6 sticky top-0 z-30 shadow-lg shrink-0">
        
        {/* TRANSPORT GROUP */}
        <div className="flex items-center gap-3">
          <span className="text-[9px] font-bold text-white/30 tracking-wider absolute top-1">TRANSPORT</span>
          <div className="flex items-center gap-1.5 mt-2">
            <button onClick={handleReplay} className="btn-subnautica !px-2 !py-1" title="Go to start (Home)">
              <FastForward size={13} className="rotate-180" />
            </button>
            <button onClick={handlePlayToggle} className={`btn-subnautica !px-2 !py-1 ${isPlaying ? 'active' : ''}`} title="Play/Pause (Space)">
              {isPlaying ? <Square size={13} /> : <Play size={13} />}
            </button>
          </div>
          <span className="font-mono text-xs text-emerald-400 bg-black/30 px-2 py-0.5 rounded tracking-wider min-w-[90px] text-center mt-2">
            {timeDisplay}
          </span>
          <div className="flex items-center gap-1 text-xs mt-2">
            <span className="text-subnautica-active text-[10px]">BPM</span>
            <input
              type="number" value={bpm}
              onChange={(e) => setBpm(Math.max(20, Math.min(300, Number(e.target.value))))}
              className="w-12 bg-white/5 border border-white/10 rounded px-1 py-0.5 text-center text-white outline-none text-[11px]"
            />
          </div>
          <button
            onClick={() => setMetronomeEnabled(!metronomeEnabled)}
            className={`btn-subnautica !p-1.5 mt-2 ${metronomeEnabled ? 'active' : ''}`}
            title="Metronome"
          >
            🔔
          </button>
        </div>

        <div className="w-px h-6 bg-white/10" />

        {/* GRID GROUP */}
        <div className="flex items-center gap-3 relative">
          <span className="text-[9px] font-bold text-white/30 tracking-wider absolute top-1 -mt-3">GRID & VIEW</span>
          
          <div className="flex items-center gap-1 text-xs mt-2">
            <span className="text-white/50 text-[10px]">Snap</span>
            <select
              value={gridSnap}
              onChange={(e) => setGridSnap(Number(e.target.value))}
              className="bg-white/5 border border-white/10 rounded px-1 py-0.5 text-white outline-none text-[10px] cursor-pointer"
            >
              {snapOptions.map(opt => (
                <option key={opt.label} value={opt.value} className="bg-subnautica-deep">{opt.label}</option>
              ))}
            </select>
          </div>
          
          <div className="flex items-center gap-1 mt-2">
            <button onClick={() => setZoom(zoom - 0.25)} className="btn-subnautica !p-1.5" title="Zoom Out"><ZoomOut size={13} /></button>
            <span className="text-[10px] text-white/60 w-8 text-center">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(zoom + 0.25)} className="btn-subnautica !p-1.5" title="Zoom In"><ZoomIn size={13} /></button>
          </div>
        </div>

        <div className="w-px h-6 bg-white/10" />

        {/* TOOLS GROUP */}
        <div className="flex items-center gap-1 relative">
          <span className="text-[9px] font-bold text-white/30 tracking-wider absolute top-1 -mt-3">TOOLS</span>
          <div className="flex items-center gap-1 mt-2">
            <button onClick={() => setActiveTool('move')} className={`btn-subnautica !p-1.5 ${activeTool === 'move' ? 'active' : ''}`} title="Move Tool (V)"><MousePointer2 size={13} /></button>
            <button onClick={() => setActiveTool('draw')} className={`btn-subnautica !p-1.5 ${activeTool === 'draw' ? 'active' : ''}`} title="Draw Tool (D)"><Pencil size={13} /></button>
            <button onClick={() => setActiveTool('erase')} className={`btn-subnautica !p-1.5 ${activeTool === 'erase' ? 'active' : ''}`} title="Erase Tool (E)"><Scissors size={13} /></button>
          </div>
        </div>
      </div>

      {/* 2.3: Bar numbers ruler */}
      <div 
        ref={barRulerRef}
        className="h-5 bg-black/30 border-b border-white/5 flex items-center overflow-hidden shrink-0 relative" 
        style={{ paddingLeft: '10px' }}
      >
        <div style={{ width: `${totalBars * beatWidth * 4}px`, position: 'relative', height: '100%' }}>
          {Array.from({ length: totalBars }).map((_, i) => (
            <span
              key={i}
              className="absolute top-0 text-[9px] text-white/40 font-mono"
              style={{ left: `${i * beatWidth * 4}px`, paddingLeft: '2px' }}
            >
              {i + 1}
            </span>
          ))}

          {/* 3.1: Loop Region */}
          {loopRegion && (
            <Rnd
              bounds="parent"
              dragAxis="x"
              enableResizing={{ right: true, left: true, top: false, bottom: false, topRight: false, bottomRight: false, bottomLeft: false, topLeft: false }}
              dragGrid={[effectiveSnap, 1]}
              resizeGrid={[effectiveSnap, 1]}
              size={{ width: (loopRegion.end - loopRegion.start) * beatWidth, height: 20 }}
              position={{ x: loopRegion.start * beatWidth, y: 0 }}
              onDragStop={(e, d) => {
                const newStart = Math.max(0, d.x / beatWidth);
                setLoopRegion(newStart, newStart + (loopRegion.end - loopRegion.start));
              }}
              onResizeStop={(e, dir, ref, delta, position) => {
                const newStart = Math.max(0, position.x / beatWidth);
                const newWidth = Math.max(0.25, parseInt(ref.style.width, 10) / beatWidth);
                setLoopRegion(newStart, newStart + newWidth);
              }}
              style={{
                background: 'rgba(56, 189, 248, 0.1)',
                borderLeft: '2px solid rgba(56, 189, 248, 0.8)',
                borderRight: '2px solid rgba(56, 189, 248, 0.8)',
                cursor: 'grab',
                zIndex: 10
              }}
            />
          )}
        </div>
      </div>

      {/* Grid area */}
      <div
        id="timeline-scroll"
        ref={timelineRef}
        className="flex-1 relative overflow-auto"
        style={{ padding: '0 10px' }}
        onScroll={handleScroll}
      >
        <div
          onMouseDown={handleTimelineMouseDown}
          id="timeline-bg"
          style={{
            position: 'relative',
            width: `${totalBars * beatWidth * 4}px`,
            height: `${tracks.length * TRACK_STEP_Y}px`,
            cursor: activeTool === 'draw' ? 'crosshair' : 'default'
          }}
        >
          {/* Track lanes & grid */}
          {tracks.map((track, idx) => (
            <div key={track.id} style={{
              position: 'absolute', top: `${idx * TRACK_STEP_Y}px`,
              left: 0, right: 0, height: `${TRACK_HEIGHT}px`,
              background: 'rgba(56, 189, 248, 0.015)',
              borderBottom: '1px solid rgba(56, 189, 248, 0.04)',
              pointerEvents: 'none'
            }}>
              {Array.from({ length: totalBars * 4 }).map((_, i) => (
                <div key={i} style={{
                  position: 'absolute', left: `${i * beatWidth}px`,
                  top: 0, bottom: 0, width: '1px',
                  background: (i % 4 === 0) ? 'rgba(56, 189, 248, 0.12)' : 'rgba(255,255,255,0.025)'
                }} />
              ))}
            </div>
          ))}

          {/* 4.4: Empty state */}
          {clips.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white/30 pointer-events-none z-10" style={{ height: '50vh' }}>
              <Pencil size={48} className="mb-4 opacity-50 text-subnautica-active" />
              <p className="text-sm font-semibold tracking-wider">Draw clips on the timeline or press D to switch to Draw mode</p>
            </div>
          )}

          {/* 4.3: Playhead with glow animation */}
          <div
            onMouseDown={handlePlayheadMouseDown}
            className="playhead-glow"
            style={{
              position: 'absolute', top: 0, bottom: 0,
              left: `${playheadX}px`, width: '12px', marginLeft: '-5px',
              cursor: 'ew-resize', zIndex: 50, pointerEvents: 'auto',
              display: 'flex', justifyContent: 'center'
            }}
          >
            <div style={{ width: '2px', height: '100%', background: '#34d399', boxShadow: '0 0 10px #34d399, 0 0 20px rgba(52,211,153,0.3)' }} />
            <div style={{
              position: 'absolute', top: 0, width: 0, height: 0,
              borderLeft: '6px solid transparent', borderRight: '6px solid transparent',
              borderTop: '8px solid #34d399',
            }} />
          </div>

          {/* Clips */}
          {clips.map(clip => {
            const trackIndex = tracks.findIndex(t => t.id === clip.trackId);
            if (trackIndex === -1) return null;
            const clipColor = getTrackColor(clip.trackId);
            const clipInstName = getTrackInstName(clip.trackId);
            const isSelected = selectedClipIds.includes(clip.id);

            return (
              <Rnd
                key={clip.id}
                bounds="parent"
                dragAxis="both"
                disableDragging={activeTool !== 'move'}
                enableResizing={{ right: activeTool === 'move', left: false, top: false, bottom: false, topRight: false, bottomRight: false, bottomLeft: false, topLeft: false }}
                dragGrid={[effectiveSnap, TRACK_STEP_Y]}
                resizeGrid={[effectiveSnap, 1]}
                size={{ width: clip.width * zoom, height: TRACK_HEIGHT }}
                position={{ x: clip.x * zoom, y: trackIndex * TRACK_STEP_Y }}
                onDragStop={(e, d) => {
                  let newTrackIdx = Math.round(d.y / TRACK_STEP_Y);
                  newTrackIdx = Math.max(0, Math.min(tracks.length - 1, newTrackIdx));
                  const newTrackId = tracks[newTrackIdx].id;
                  const newX = Math.round(d.x / zoom);
                  
                  // 3.3: Duplicate with Alt+Drag
                  if (e.altKey) {
                    const hasCollision = clips.some(c => c.trackId === newTrackId && c.x < newX + clip.width && c.x + c.width > newX);
                    if (!hasCollision) {
                       addClip({ ...clip, trackId: newTrackId, x: newX, notes: clip.notes.map(n => ({...n, id: Date.now()+Math.random()})) });
                    }
                    updateClip(clip.id, { _force: Date.now() }); // Snap original back
                    return;
                  }

                  // 2.1: Collision detection
                  const hasCollision = clips.some(c => c.id !== clip.id && c.trackId === newTrackId && c.x < newX + clip.width && c.x + c.width > newX);
                  if (!hasCollision) {
                    updateClip(clip.id, { x: newX, trackId: newTrackId });
                  } else {
                    updateClip(clip.id, { _force: Date.now() }); // Force render to snap back
                  }
                }}
                onResizeStop={(e, direction, ref) => {
                  const newWidth = Math.round(parseInt(ref.style.width, 10) / zoom);
                  
                  // 2.1: Collision detection
                  const hasCollision = clips.some(c => c.id !== clip.id && c.trackId === clip.trackId && c.x < clip.x + newWidth && c.x + c.width > clip.x);
                  if (!hasCollision) {
                    updateClip(clip.id, { width: newWidth });
                  } else {
                    updateClip(clip.id, { _force: Date.now() }); // Force render to snap back
                  }
                }}
                style={{
                  background: `linear-gradient(90deg, ${clipColor}40 0%, ${clipColor}15 100%)`,
                  boxShadow: isSelected ? `0 0 15px ${clipColor}80, inset 0 0 10px ${clipColor}20` : '0 2px 8px rgba(0,0,0,0.4)',
                  border: isSelected ? `2px solid ${clipColor}` : '1px solid rgba(255,255,255,0.15)',
                  borderRadius: '4px',
                  overflow: 'hidden',
                  cursor: activeTool === 'erase' ? 'crosshair' : (activeTool === 'move' ? 'grab' : 'default'),
                  transition: 'box-shadow 0.2s, border 0.2s',
                }}
              >
                <div
                  onClick={(e) => { if (activeTool === 'move') setSelectedClipIds(clip.id, e.ctrlKey || e.metaKey); }}
                  onDoubleClick={() => setSelectedClipIds(clip.id)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    showContextMenu(e.clientX, e.clientY, clip.id);
                  }}
                  onMouseDown={(e) => {
                    if (activeTool === 'erase') { e.stopPropagation(); removeClip(clip.id); }
                  }}
                  className="w-full h-full relative flex items-center"
                >
                  {/* 2.1: Accent bar */}
                  <div className="w-1 h-full shrink-0 rounded-l-sm" style={{ background: clipColor }} />

                  {/* 2.1: Instrument name */}
                  <span className="text-[9px] font-bold ml-1.5 truncate" style={{ color: clipColor }}>
                    {clipInstName}
                  </span>

                  {/* 4.2: Waveform decoration */}
                  <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20" preserveAspectRatio="none">
                    <path d={generateWaveformPath(clip.id, clip.width * zoom, TRACK_HEIGHT)} fill="none" stroke={clipColor} strokeWidth="1.5" />
                  </svg>

                  {/* 1.5 FIX: Deterministic note preview (no Math.random) */}
                  <div className="absolute bottom-0.5 left-2 right-1 h-2 pointer-events-none opacity-40">
                    {(clip.notes || []).map((n, i) => (
                      <div key={n.id || i} style={{
                        position: 'absolute',
                        left: `${(n.time / clip.width) * 100}%`,
                        width: `${Math.max(2, (n.duration / clip.width) * 100)}%`,
                        height: '2px',
                        background: '#34d399',
                        top: `${(i * 7) % 8}px`, // Deterministic positioning
                        borderRadius: '1px',
                      }} />
                    ))}
                  </div>
                </div>
              </Rnd>
            );
          })}
        </div>
      </div>

      {/* 3.6: Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-[200] bg-subnautica-panel border border-subnautica-border rounded-lg shadow-xl py-1 min-w-[160px] backdrop-blur-md"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button className="w-full text-left px-3 py-1.5 text-xs text-white/80 hover:bg-white/10 transition-colors" onClick={() => { setSelectedClipIds(contextMenu.clipId); hideContextMenu(); }}>
            🎹 Edit (Piano Roll)
          </button>
          <button className="w-full text-left px-3 py-1.5 text-xs text-white/80 hover:bg-white/10 transition-colors" onClick={() => { duplicateClip(contextMenu.clipId); hideContextMenu(); }}>
            📋 Duplicate
          </button>
          <div className="h-px bg-white/10 my-0.5" />
          <button className="w-full text-left px-3 py-1.5 text-xs text-rose-400 hover:bg-rose-500/10 transition-colors" onClick={() => { removeClip(contextMenu.clipId); hideContextMenu(); }}>
            🗑️ Delete
          </button>
        </div>
      )}
    </div>
  );
}
