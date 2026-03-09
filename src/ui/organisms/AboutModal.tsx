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
        <ModalHeader titleId="about-modal-title" title="À propos" onClose={onClose} />

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
              <div style={{ fontSize: "0.9rem", fontWeight: 600 }}>HI-TTS</div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                Tooling TTS gratuit pour Twitch · © 2026 Hiarte
              </div>
            </div>
          </div>

          <p className="card-text">
            Application de bureau pour suivre les rewards Twitch, configurer le TTS ElevenLabs et lier les
            deux de façon simple depuis ton stream. Construite avec Electron et une intégration ElevenLabs
            en lecture seule (voix + quotas).
          </p>
          <h3 style={{ fontSize: "0.8rem", marginTop: "0.9rem", marginBottom: "0.25rem" }}>
            Politique de confidentialité (résumé)
          </h3>
          <p className="card-text" style={{ fontSize: "0.75rem" }}>
            - <strong>Twitch</strong> : le token OAuth est stocké localement dans ton navigateur (localStorage) pour
            que l&apos;application puisse accéder aux rewards et à ton profil sans te redemander de connexion à
            chaque lancement. Ce modèle est adapté à un usage perso, mais toute application ou script exécutant
            du code non maîtrisé pourrait, en théorie, lire ce token.
          </p>
          <p className="card-text" style={{ fontSize: "0.75rem", marginTop: "0.35rem" }}>
            - <strong>ElevenLabs</strong> : ta clé API est enregistrée localement dans la configuration de
            l&apos;application et utilisée uniquement pour appeler l&apos;API ElevenLabs depuis ta machine. Ne la
            partage jamais et considère que toute personne ayant accès à cette machine peut potentiellement
            l&apos;utiliser.
          </p>
          <p className="card-text" style={{ fontSize: "0.75rem", marginTop: "0.35rem", opacity: 0.85 }}>
            Aucune donnée n&apos;est envoyée vers un serveur tiers autre que les API officielles de Twitch et
            ElevenLabs. Pour une utilisation en production ou pour des streamers tiers, pense à rédiger une
            politique de confidentialité détaillée adaptée à ton contexte.
          </p>
        </div>
      </div>
    </div>
  );
};
