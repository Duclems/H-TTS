import { AuthenticatedTokenCard } from "./AuthenticatedTokenCard";
import { getStoredToken } from "../../twitchAuth";
import { ModalHeader } from "../molecules/ModalHeader";

type Props = {
  onClose: () => void;
};

export const TwitchSessionModal = ({ onClose }: Props) => {
  const token = getStoredToken();

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="twitch-session-modal-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="panel modal-content settings-modal-content" onClick={(e) => e.stopPropagation()}>
        <ModalHeader titleId="twitch-session-modal-title" title="Connexion Twitch" onClose={onClose} />

        <div className="settings-modal-body">
          {token && <AuthenticatedTokenCard token={token} />}
        </div>
      </div>
    </div>
  );
};
