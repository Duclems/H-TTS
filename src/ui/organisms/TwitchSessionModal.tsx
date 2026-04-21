import { AuthenticatedTokenCard } from "./AuthenticatedTokenCard";
import type { TwitchTokenResponse } from "../../twitchAuth";
import { Modal } from "../molecules/Modal";
import { useI18n } from "../context/I18nContext";

type Props = {
  token: TwitchTokenResponse;
  onClose: () => void;
};

export const TwitchSessionModal = ({ token, onClose }: Props) => {
  const { t } = useI18n();

  return (
    <Modal
      titleId="twitch-session-modal-title"
      title={t("twitchSession.title")}
      onClose={onClose}
      mainClassName="settings-modal-body"
    >
      {token && <AuthenticatedTokenCard token={token} />}
    </Modal>
  );
};
