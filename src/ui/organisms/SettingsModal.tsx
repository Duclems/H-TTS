import { ElevenLabsCard } from "./ElevenLabsCard";
import { ModalHeader } from "../molecules/ModalHeader";
import { useI18n } from "../context/I18nContext";

type Props = {
  onClose: () => void;
};

export const SettingsModal = ({ onClose }: Props) => {
  const { t } = useI18n();
  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="panel modal-content settings-modal-content" onClick={(e) => e.stopPropagation()}>
        <ModalHeader titleId="settings-modal-title" title={t("settings.elevenTitle")} onClose={onClose} closeAriaLabel={t("modal.close")} />

        <div className="settings-modal-body">
          <ElevenLabsCard />
        </div>
      </div>
    </div>
  );
};
