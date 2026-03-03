import { ElevenLabsCard } from "./pages/HomePage/ElevenLabsCard";

type Props = {
  onClose: () => void;
};

export const SettingsModal = ({ onClose }: Props) => {
  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="panel modal-content settings-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="settings-modal-header">
          <h2 id="settings-modal-title" className="card-title">
            Paramètres ElevenLabs
          </h2>
          <button
            type="button"
            className="settings-modal-close"
            onClick={onClose}
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>

        <div className="settings-modal-body">
          <ElevenLabsCard />
        </div>
      </div>
    </div>
  );
};
