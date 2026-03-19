import { useEffect } from "react";
import { AuthenticatedTokenCard } from "./AuthenticatedTokenCard";
import { getStoredToken } from "../../twitchAuth";
import { ModalHeader } from "../molecules/ModalHeader";
import { useI18n } from "../context/I18nContext";

type Props = {
  onClose: () => void;
};

export const TwitchSessionModal = ({ onClose }: Props) => {
  const { t } = useI18n();
  const token = getStoredToken();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="twitch-session-modal-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="panel modal-content settings-modal-content" onClick={(e) => e.stopPropagation()}>
        <ModalHeader titleId="twitch-session-modal-title" title={t("twitchSession.title")} onClose={onClose} closeAriaLabel={t("modal.close")} />

        <div className="settings-modal-body">
          {token && <AuthenticatedTokenCard token={token} />}
        </div>
      </div>
    </div>
  );
};
