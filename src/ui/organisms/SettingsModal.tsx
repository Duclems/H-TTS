import { ElevenLabsCard } from "./ElevenLabsCard";
import { ModalHeader } from "../molecules/ModalHeader";

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
        <ModalHeader
          titleId="settings-modal-title"
          title="Paramètres ElevenLabs"
          onClose={onClose}
          closeVariant="twitch"
        />

        <div className="settings-modal-body">
          <ElevenLabsCard />
        </div>
      </div>
    </div>
  );
};
