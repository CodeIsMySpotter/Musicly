import React from 'react';
import { useStore } from '../store/useStore';

// 2.9: Global confirm modal — controlled from Zustand store
export default function ConfirmModal() {
  const confirmModal = useStore(state => state.confirmModal);
  const hideConfirmModal = useStore(state => state.hideConfirmModal);

  if (!confirmModal) return null;

  const handleConfirm = () => {
    confirmModal.onConfirm?.();
    hideConfirmModal();
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[200] backdrop-blur-sm">
      <div className="bg-subnautica-panel border border-subnautica-border rounded-xl p-6 max-w-sm w-full shadow-[0_0_40px_rgba(56,189,248,0.1)]">
        <h3 className="text-sm font-bold text-white mb-2">{confirmModal.title}</h3>
        <p className="text-xs text-white/70 mb-5 leading-relaxed">{confirmModal.message}</p>
        <div className="flex justify-end gap-2">
          <button onClick={hideConfirmModal} className="btn-subnautica">
            Anuluj
          </button>
          <button onClick={handleConfirm} className="btn-subnautica !bg-rose-500/20 !text-rose-400 !border-rose-500/40 hover:!bg-rose-500/30">
            Usuń
          </button>
        </div>
      </div>
    </div>
  );
}
