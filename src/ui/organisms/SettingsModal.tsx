import { ElevenLabsCard } from "./ElevenLabsCard";
import { Button } from "../atoms/Button";
import { Modal } from "../molecules/Modal";
import { useI18n } from "../context/I18nContext";
import { useElevenLabsForm } from "../hooks/useElevenLabsForm";

type Props = {
  onClose: () => void;
  onElevenLabsSaved?: () => void;
};

export const SettingsModal = ({ onClose, onElevenLabsSaved }: Props) => {
  const { t } = useI18n();
  const {
    apiKey,
    setApiKey,
    userInfo,
    loadingUser,
    hasError,
    handleSave,
    saveButtonDanger
  } = useElevenLabsForm({ onSaved: onElevenLabsSaved });

  return (
    <Modal
      titleId="settings-modal-title"
      title={t("settings.elevenTitle")}
      onClose={onClose}
      footer={
        <Button
          variant={saveButtonDanger ? "danger" : "primary"}
          style={{ width: "100%" }}
          onClick={() => void handleSave()}
        >
          {t("eleven.save")}
        </Button>
      }
    >
      <ElevenLabsCard
        apiKey={apiKey}
        setApiKey={setApiKey}
        userInfo={userInfo}
        loadingUser={loadingUser}
        hasError={hasError}
      />
    </Modal>
  );
};
