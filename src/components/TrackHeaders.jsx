import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../store/useStore';
import { Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { engine } from '../engine/AudioEngine';

export default function TrackHeaders({ instruments }) {
  const tracks = useStore(state => state.tracks);
  const addTrack = useStore(state => state.addTrack);
  const updateTrack = useStore(state => state.updateTrack);
  const removeTrack = useStore(state => state.removeTrack);
  const moveTrack = useStore(state => state.moveTrack);
  const showConfirmModal = useStore(state => state.showConfirmModal);

  // Helper to get instrument color
  const getInstColor = (instId) => instruments.find(i => i.id === instId)?.color || '#666';

  return (
    <div className="w-64 glass-panel border-r border-subnautica-border flex flex-col shrink-0 z-20">
      {/* Header */}
      <div className="h-10 border-b border-subnautica-border flex items-center px-4 justify-between">
        <span className="text-xs font-bold text-subnautica-active tracking-wider">TRACKS</span>
        <button onClick={addTrack} className="btn-subnautica !px-2 !py-1" title="Add Track">
          <Plus size={14} />
        </button>
      </div>

      {/* Track List */}
      <div 
        id="track-headers-scroll" 
        className="flex-1 overflow-y-auto"
        onScroll={(e) => {
          const timeline = document.getElementById('timeline-scroll');
          if (timeline && timeline.scrollTop !== e.target.scrollTop) {
            timeline.scrollTop = e.target.scrollTop;
          }
        }}
      >
        {tracks.map((track, i) => (
          <TrackRow
            key={track.id}
            track={track}
            index={i}
            isFirst={i === 0}
            isLast={i === tracks.length - 1}
            instruments={instruments}
            instColor={getInstColor(track.inst)}
            updateTrack={updateTrack}
            removeTrack={removeTrack}
            moveTrack={moveTrack}
            showConfirmModal={showConfirmModal}
          />
        ))}
      </div>
    </div>
  );
}

// Separate component for perf (React.memo candidate)
function TrackRow({ track, index, isFirst, isLast, instruments, instColor, updateTrack, removeTrack, moveTrack, showConfirmModal }) {
  const [vuLevel, setVuLevel] = useState(0);
  const [isEditingName, setIsEditingName] = useState(false);
  const nameInputRef = useRef(null);
  const isPlaying = useStore(state => state.isPlaying);
  const animRef = useRef(null);

  // 3.7: VU Meter — poll audio level during playback
  useEffect(() => {
    if (!isPlaying) {
      setVuLevel(0);
      return;
    }
    const update = () => {
      const db = engine.getTrackLevel(track.id);
      // Convert dB to 0-100 range (roughly -60dB to 0dB)
      const normalized = Math.max(0, Math.min(100, ((db + 60) / 60) * 100));
      setVuLevel(normalized);
      animRef.current = requestAnimationFrame(update);
    };
    animRef.current = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animRef.current);
  }, [isPlaying, track.id]);

  // 2.9: Confirm before deleting track
  const handleDelete = () => {
    showConfirmModal(
      'Usuń ścieżkę',
      `Czy na pewno chcesz usunąć ścieżkę "${track.name}" i wszystkie jej klipy?`,
      () => removeTrack(track.id)
    );
  };

  // 2.10: Volume/Pan label formatters
  const volLabel = track.volume <= -60 ? '-∞ dB' : `${track.volume} dB`;
  const panLabel = track.pan === 0 ? 'C' : track.pan < 0 ? `L ${Math.abs(Math.round(track.pan * 100))}%` : `R ${Math.round(track.pan * 100)}%`;

  return (
    <div className="h-[45px] border-b border-white/5 flex items-center gap-1.5 group relative">
      {/* 2.2: Color accent bar */}
      <div className="w-1 h-full shrink-0 rounded-r-sm" style={{ background: instColor }} />

      {/* Track Info */}
      <div className="flex flex-col flex-1 min-w-0 px-1">
        {/* 3.8: Inline Rename */}
        {isEditingName ? (
          <input
            ref={nameInputRef}
            value={track.name}
            onChange={(e) => updateTrack(track.id, { name: e.target.value })}
            onBlur={() => setIsEditingName(false)}
            onKeyDown={(e) => e.key === 'Enter' && setIsEditingName(false)}
            className="bg-black/50 text-[11px] font-semibold text-white outline-none w-full px-1 border border-subnautica-active/30 rounded"
          />
        ) : (
          <span 
            onDoubleClick={() => { setIsEditingName(true); setTimeout(() => nameInputRef.current?.focus(), 0); }}
            className="text-[11px] font-semibold text-white truncate cursor-text hover:bg-white/5 rounded px-1"
          >
            {track.name}
          </span>
        )}
        <div className="flex items-center gap-1">
          {/* 2.2: Color dot */}
          <div className="w-2 h-2 rounded-full shrink-0" style={{ background: instColor }} />
          <select
            value={track.inst}
            onChange={(e) => updateTrack(track.id, { inst: e.target.value })}
            className="bg-transparent text-[9px] text-emerald-400 outline-none w-full cursor-pointer opacity-70 hover:opacity-100"
          >
            {instruments.map(inst => (
              <option key={inst.id} value={inst.id} className="bg-subnautica-deep text-white">{inst.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* M / S buttons */}
      <div className="flex gap-0.5 shrink-0">
        <button
          onClick={() => updateTrack(track.id, { mute: !track.mute })}
          className={`w-5 h-5 flex items-center justify-center rounded text-[8px] font-bold border transition-colors ${track.mute ? 'bg-rose-500/30 border-rose-500 text-rose-300' : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10'}`}
          title="Mute"
        >M</button>
        <button
          onClick={() => updateTrack(track.id, { solo: !track.solo })}
          className={`w-5 h-5 flex items-center justify-center rounded text-[8px] font-bold border transition-colors ${track.solo ? 'bg-amber-500/30 border-amber-500 text-amber-300' : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10'}`}
          title="Solo"
        >S</button>
      </div>

      {/* Volume + Pan sliders */}
      <div className="w-14 flex flex-col justify-center">
        <input
          type="range" min="-60" max="6" step="1"
          value={track.volume}
          onChange={(e) => updateTrack(track.id, { volume: parseFloat(e.target.value) })}
          className="slider-subnautica w-full"
          title={`Volume: ${volLabel}`}
        />
        <input
          type="range" min="-1" max="1" step="0.1"
          value={track.pan}
          onChange={(e) => updateTrack(track.id, { pan: parseFloat(e.target.value) })}
          className="slider-subnautica w-full mt-0.5 opacity-40"
          title={`Pan: ${panLabel}`}
        />
      </div>

      {/* 3.7: VU Meter */}
      <div className="w-1.5 h-8 bg-black/40 rounded-sm overflow-hidden mr-1 shrink-0">
        <div
          className="w-full rounded-sm transition-all duration-75"
          style={{
            height: `${vuLevel}%`,
            marginTop: `${100 - vuLevel}%`,
            background: vuLevel > 85 ? '#ef4444' : vuLevel > 60 ? '#f59e0b' : '#34d399'
          }}
        />
      </div>

      {/* Actions (hover reveal) */}
      <div className="absolute right-0.5 top-0.5 flex flex-col gap-[1px] opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={handleDelete}
          className="w-4 h-4 flex items-center justify-center bg-rose-500/20 text-rose-400 rounded hover:bg-rose-500/40"
          title="Delete Track"
        >
          <Trash2 size={10} />
        </button>
        <div className="flex gap-[1px]">
          <button
            onClick={() => moveTrack(track.id, -1)}
            disabled={isFirst}
            className={`w-4 h-4 flex items-center justify-center bg-white/5 text-white/60 rounded ${isFirst ? 'opacity-30 cursor-not-allowed' : 'hover:bg-white/20 hover:text-white'}`}
            title="Move Up"
          >
            <ArrowUp size={10} />
          </button>
          <button
            onClick={() => moveTrack(track.id, 1)}
            disabled={isLast}
            className={`w-4 h-4 flex items-center justify-center bg-white/5 text-white/60 rounded ${isLast ? 'opacity-30 cursor-not-allowed' : 'hover:bg-white/20 hover:text-white'}`}
            title="Move Down"
          >
            <ArrowDown size={10} />
          </button>
        </div>
      </div>
    </div>
  );
}
