import { AuthenticatedTokenCard } from "./AuthenticatedTokenCard";
import { getStoredToken } from "../../twitchAuth";

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
        <div className="settings-modal-header">
          <h2 id="twitch-session-modal-title" className="card-title">
            Connexion Twitch
          </h2>
          <button
            type="button"
            className="settings-modal-close settings-modal-close-twitch"
            onClick={onClose}
            aria-label="Fermer"
          >
            <img src="/cross.svg" alt="Fermer" />
          </button>
        </div>

        <div className="settings-modal-body">
          {token && <AuthenticatedTokenCard token={token} />}
        </div>
      </div>
    </div>
  );
};
