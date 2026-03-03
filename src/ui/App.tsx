import { useEffect, useState } from "react";
import { TwitchLoginCard } from "./pages/HomePage/TwitchLoginCard";
import { RewardsCard } from "./pages/HomePage/RewardsCard";
import { getStoredToken } from "../twitchAuth";
import { loadElevenLabsConfig } from "../elevenLabsConfig";
import { fetchElevenUser } from "../elevenLabsApi";
import { SettingsModal } from "./SettingsModal";
import { TwitchSessionModal } from "./TwitchSessionModal";
import { AboutModal } from "./AboutModal";

export const App = () => {
  const token = getStoredToken();
  const { apiKey } = loadElevenLabsConfig();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [twitchOpen, setTwitchOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [isElevenValid, setIsElevenValid] = useState<boolean | null>(null);
  const [rewardsTab, setRewardsTab] = useState<"history" | "rewards">("history");
  const [elevenCredits, setElevenCredits] = useState<{ remaining: number; limit: number } | null>(
    null
  );

  useEffect(() => {
    let cancelled = false;

    const checkEleven = async () => {
      const trimmed = apiKey.trim();
      if (!trimmed) {
        setIsElevenValid(false);
        setElevenCredits(null);
        return;
      }

      const user = await fetchElevenUser();
      if (cancelled) return;

      const sub = user?.subscription;
      const hasCreditsInfo =
        !!sub && typeof sub.character_limit === "number" && typeof sub.character_count === "number";

      setIsElevenValid(hasCreditsInfo);
      if (hasCreditsInfo && sub) {
        const remaining = Math.max(0, sub.character_limit - sub.character_count);
        setElevenCredits({ remaining, limit: sub.character_limit });
      } else {
        setElevenCredits(null);
      }
    };

    void checkEleven();

    return () => {
      cancelled = true;
    };
  }, [apiKey]);

  const formatCredits = (value: number): string => {
    if (value >= 1_000_000) {
      return `${(value / 1_000_000).toFixed(2)}M`;
    }
    if (value >= 1_000) {
      return `${(value / 1_000).toFixed(1)}k`;
    }
    return `${value}`;
  };

  const isTwitchConnected = !!token;
  const isFullyLinked = isTwitchConnected && !!isElevenValid;

  return (
    <div className="app-shell">
      <div className="app-shell-header">
        {isTwitchConnected && rewardsTab === "history" && (
          <div className="app-header-main">
            <div className="app-header-main-top">
              <div className="app-title">Historique des redeems</div>
              {elevenCredits && (
                <div className="app-header-credits">
                  Crédits restants :{" "}
                  <strong>
                    {formatCredits(elevenCredits.remaining)} / {formatCredits(elevenCredits.limit)}
                  </strong>
                </div>
              )}
            </div>
            <p className="app-subtitle">
              Les redeems sont rafraîchis toutes les <strong>seconde</strong> et chaque redeem peut
              déclencher un TTS pendant <strong>10 secondes</strong> après son apparition.
            </p>
          </div>
        )}
        {isTwitchConnected && rewardsTab === "rewards" && (
          <div className="app-header-main">
            <div className="app-header-main-top">
              <div className="app-title">Création de rewards</div>
              {elevenCredits && (
                <div className="app-header-credits">
                  Crédits restants :{" "}
                  <strong>
                    {formatCredits(elevenCredits.remaining)} / {formatCredits(elevenCredits.limit)}
                  </strong>
                </div>
              )}
            </div>
            <p className="app-subtitle">Permet de créer un reward pour faire fonctionner le TTS.</p>
          </div>
        )}
      </div>

      <main className="app-main">
        {!token && <TwitchLoginCard />}
        {token && <RewardsCard token={token} activeTab={rewardsTab} />}
      </main>

      {isTwitchConnected && (
        <footer className="app-footer">
          <div className="app-header-main-tabs">
            <button
              type="button"
              className={
                rewardsTab === "history"
                  ? "app-header-tab app-header-tab-active"
                  : "app-header-tab"
              }
              onClick={() => setRewardsTab("history")}
            >
              <span className="app-header-tab-icon">
                <img src="/house.svg" alt="" aria-hidden="true" />
              </span>
              <span>Accueil</span>
            </button>
            <button
              type="button"
              className={
                rewardsTab === "rewards"
                  ? "app-header-tab app-header-tab-active"
                  : "app-header-tab"
              }
              onClick={() => setRewardsTab("rewards")}
            >
              <span className="app-header-tab-icon">
                <img src="/reward.svg" alt="" aria-hidden="true" />
              </span>
              <span>Rewards</span>
            </button>
          </div>
          <div className="app-header-icons">
            <button
              type="button"
              className="header-settings-btn"
              title="Session Twitch"
              aria-label="Afficher la session Twitch"
              onClick={() => setTwitchOpen(true)}
            >
              <img src="/twitch.svg" alt="Twitch" />
            </button>
            <button
              type="button"
              className="header-settings-btn"
              title="Paramètres ElevenLabs"
              aria-label={
                isFullyLinked
                  ? "Paramètres connectés (Twitch et ElevenLabs configurés)"
                  : "Paramètres ElevenLabs à compléter"
              }
              onClick={() => setSettingsOpen(true)}
            >
              <img
                src={isFullyLinked ? "/link.svg" : "/unlink.svg"}
                alt={isFullyLinked ? "Lié" : "Non lié"}
              />
            </button>
            <button
              type="button"
              className="header-settings-btn"
              title="À propos"
              aria-label="Afficher les informations à propos"
              onClick={() => setAboutOpen(true)}
            >
              <img src="/settings.svg" alt="À propos" />
            </button>
          </div>
        </footer>
      )}

      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
      {twitchOpen && <TwitchSessionModal onClose={() => setTwitchOpen(false)} />}
      {aboutOpen && <AboutModal onClose={() => setAboutOpen(false)} />}
    </div>
  );
};

