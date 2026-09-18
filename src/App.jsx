import { useState, useEffect } from 'react';
import { Play, Square, Settings, Volume2, Plus } from 'lucide-react';
import { engine } from './engine/AudioEngine';
import './index.css';

// Sample instruments (drag palette)
const INSTRUMENTS = [
  { id: 'kick', name: 'Deep Kick', color: 'var(--color-kick)' },
  { id: 'sub', name: 'Sub Bass', color: 'var(--color-sub)' },
  { id: 'pad', name: 'Bioluminescent Pad', color: 'var(--color-pad)' },
  { id: 'crystal', name: 'Crystal Pluck', color: 'var(--color-crystal)' },
];

export default function App() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [blocks, setBlocks] = useState([
    // Initial state
    { id: 1, inst: 'kick', track: 0, start: 0, length: 1, note: 'C1' },
    { id: 2, inst: 'pad', track: 1, start: 0, length: 4, note: 'C3' },
    { id: 3, inst: 'crystal', track: 2, start: 2, length: 1, note: 'E5' },
  ]);
  const [selectedBlock, setSelectedBlock] = useState(null);

  useEffect(() => {
    // Initialize AudioEngine on interaction
    const initAudio = async () => {
      await engine.init();
    };
    window.addEventListener('click', initAudio, { once: true });
  }, []);

  const handlePlay = async () => {
    await engine.init();
    setIsPlaying(!isPlaying);
    // TODO: Full playback logic with Tone.Transport
    if (!isPlaying) {
      engine.playNote('pad', 'C3', '2n');
    }
  };

  const addBlock = (inst) => {
    const newBlock = {
      id: Date.now(),
      inst: inst.id,
      track: Math.floor(Math.random() * 3), // eventually from drag and drop
      start: 0,
      length: 2,
      note: inst.id === 'kick' ? 'C1' : 'C3'
    };
    setBlocks([...blocks, newBlock]);
  };

  return (
    <div className="flex h-screen text-white" style={{ display: 'flex', width: '100vw' }}>
      {/* Sidebar: Instrument Palette */}
      <div style={{ width: '250px', background: 'var(--bg-panel)', borderRight: '1px solid var(--border-light)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <h2 style={{ margin: '0 0 20px 0', fontSize: '18px', color: '#38bdf8', letterSpacing: '1px' }}>
          Musicly
          <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)' }}>SUBNAUTICA SEQUENCER</span>
        </h2>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={handlePlay} className={isPlaying ? 'active' : ''} style={{ flex: 1, justifyContent: 'center' }}>
            {isPlaying ? <Square size={16} /> : <Play size={16} />}
            {isPlaying ? 'STOP' : 'PLAY'}
          </button>
        </div>

        <div style={{ marginTop: '20px' }}>
          <h3 style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '10px' }}>Sounds (Click to add)</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {INSTRUMENTS.map(inst => (
              <div 
                key={inst.id}
                onClick={() => addBlock(inst)}
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: `1px solid ${inst.color}`,
                  padding: '10px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                {inst.name} <Plus size={14} color={inst.color} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Area: Timeline */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '20px', borderBottom: '1px solid var(--border-light)' }}>
          <h3 style={{ margin: 0, fontSize: '14px', color: 'var(--text-main)' }}>Timeline (Arrangement)</h3>
          <p style={{ margin: '5px 0 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>Double-click a block to edit sound parameters.</p>
        </div>

        <div style={{ flex: 1, padding: '20px', position: 'relative', overflowX: 'auto' }}>
          {/* Timeline Grid (simple simulation) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '2000px' }}>
            {[0, 1, 2, 3].map(trackIdx => (
              <div key={trackIdx} style={{ height: '60px', background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.05)', position: 'relative', borderRadius: '4px' }}>
                {blocks.filter(b => b.track === trackIdx).map(block => {
                  const instData = INSTRUMENTS.find(i => i.id === block.inst);
                  return (
                    <div
                      key={block.id}
                      onDoubleClick={() => setSelectedBlock(block)}
                      style={{
                        position: 'absolute',
                        left: `${block.start * 100}px`,
                        width: `${block.length * 100}px`,
                        height: '100%',
                        background: instData?.color || '#fff',
                        opacity: 0.8,
                        borderRadius: '4px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        padding: '0 10px',
                        fontSize: '11px',
                        fontWeight: 'bold',
                        color: '#000',
                        boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
                        border: '1px solid rgba(255,255,255,0.5)'
                      }}
                    >
                      {instData?.name}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Editor Modal */}
      {selectedBlock && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
          background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100
        }}>
          <div style={{ background: 'var(--bg-panel)', padding: '30px', borderRadius: '12px', border: '1px solid var(--border-active)', width: '400px' }}>
            <h3 style={{ margin: '0 0 20px 0', color: 'var(--text-main)' }}>Sound Editor</h3>
            
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '5px' }}>Release time</label>
              <input type="range" min="0.1" max="5" step="0.1" defaultValue="1" style={{ width: '100%' }} />
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '5px' }}>Filtr Cutoff</label>
              <input type="range" min="100" max="10000" step="100" defaultValue="2800" style={{ width: '100%' }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '30px' }}>
              <button onClick={() => setSelectedBlock(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
