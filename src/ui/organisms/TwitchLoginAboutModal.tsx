import { AboutContent } from "../molecules/AboutContent";
import { Modal } from "../molecules/Modal";
import { useI18n } from "../context/I18nContext";

type Props = {
  onClose: () => void;
};

export const TwitchLoginAboutModal = ({ onClose }: Props) => {
  const { t } = useI18n();

  return (
    <Modal
      titleId="twitch-login-about-modal-title"
      title={t("twitchLogin.aboutPrivacyButton")}
      onClose={onClose}
    >
      <AboutContent />
    </Modal>
  );
};
