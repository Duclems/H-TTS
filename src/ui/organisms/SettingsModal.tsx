import { ElevenLabsCard } from "./ElevenLabsCard";
import { Modal } from "../molecules/Modal";
import { useI18n } from "../context/I18nContext";

type Props = {
  onClose: () => void;
  onElevenLabsSaved?: () => void;
};

export const SettingsModal = ({ onClose, onElevenLabsSaved }: Props) => {
  const { t } = useI18n();

  return (
    <Modal
      titleId="settings-modal-title"
      title={t("settings.elevenTitle")}
      onClose={onClose}
      mainClassName="settings-modal-body"
    >
      <ElevenLabsCard onSaved={onElevenLabsSaved} />
    </Modal>
  );
};
