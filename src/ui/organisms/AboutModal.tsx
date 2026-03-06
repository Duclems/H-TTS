import { ModalHeader } from "../molecules/ModalHeader";

type Props = {
  onClose: () => void;
};

export const AboutModal = ({ onClose }: Props) => {
  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="about-modal-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="panel modal-content settings-modal-content" onClick={(e) => e.stopPropagation()}>
        <ModalHeader
          titleId="about-modal-title"
          title="À propos"
          onClose={onClose}
          closeVariant="default"
        />

        <div className="settings-modal-body">
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.6rem" }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                backgroundColor: "var(--bg-hover)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0
              }}
            >
              <img
                src="/settings.svg"
                alt="settings"
                style={{ width: 28, height: 28, display: "block", filter: "brightness(1)" }}
              />
            </div>
            <div>
              <div style={{ fontSize: "0.9rem", fontWeight: 600 }}>H-TTS · Twitch Desktop</div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Tooling TTS pour Twitch</div>
            </div>
          </div>

          <p className="card-text">
            Application de bureau pour suivre les rewards Twitch, configurer le TTS ElevenLabs et lier les
            deux de façon simple depuis ton stream. Construite avec Electron et une intégration ElevenLabs
            en lecture seule (voix + quotas).
          </p>
        </div>
      </div>
    </div>
  );
};
