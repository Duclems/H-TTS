import { useEffect, useState } from "react";
import { TwitchLoginCard } from "./pages/HomePage/TwitchLoginCard";
import { RewardsCard } from "./pages/HomePage/RewardsCard";
import { getStoredToken } from "../twitchAuth";
import { loadElevenLabsConfig } from "../elevenLabsConfig";
import { fetchElevenUser, checkElevenPermissions } from "../elevenLabsApi";
import { SettingsModal } from "./SettingsModal";
import { TwitchSessionModal } from "./TwitchSessionModal";
import { AboutModal } from "./AboutModal";

const ELEVEN_CHECK_INTERVAL_MS = 10_000; // vérification des droits ElevenLabs toutes les 60 s

export const App = () => {
  const token = getStoredToken();
  const { apiKey } = loadElevenLabsConfig();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [twitchOpen, setTwitchOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [isElevenValid, setIsElevenValid] = useState<boolean | null>(null);
  const [elevenPermissionsOk, setElevenPermissionsOk] = useState<boolean | null>(null);
  const [rewardsTab, setRewardsTab] = useState<"history" | "rewards">("history");
  const [hasMissingRewardVoice, setHasMissingRewardVoice] = useState(false);
  const [elevenCredits, setElevenCredits] = useState<{ remaining: number; limit: number } | null>(
    null
  );

  useEffect(() => {
    let cancelled = false;

    const checkEleven = async () => {
      const trimmed = apiKey.trim();
      if (!trimmed) {
        setIsElevenValid(false);
        setElevenPermissionsOk(null);
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

      if (user) {
        const checks = await checkElevenPermissions();
        if (!cancelled) {
          setElevenPermissionsOk(checks.user && checks.voices && checks.tts);
        }
      } else {
        setElevenPermissionsOk(null);
      }
    };

    void checkEleven();

    const intervalId = setInterval(() => {
      void checkEleven();
    }, ELEVEN_CHECK_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
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
  const isFullyLinked =
    isTwitchConnected && !!isElevenValid && elevenPermissionsOk !== false;
   const hasElevenKey = !!apiKey.trim();

  const handleTabChange = (tab: "history" | "rewards") => {
    setRewardsTab(tab);
    const main = document.querySelector<HTMLElement>(".app-main");
    if (main) {
      main.scrollTo({ top: 0, behavior: "auto" });
    }
  };

  return (
    <div className="app-shell">
      <div className="app-shell-header">
        {isTwitchConnected && rewardsTab === "history" && (
          <div className="app-header-main">
            <div className="app-header-main-top">
              <div className="app-title">Historique</div>
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
        {token && (
          <RewardsCard
            token={token}
            activeTab={rewardsTab}
            onMissingRewardVoiceChange={setHasMissingRewardVoice}
          />
        )}
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
              onClick={() => handleTabChange("history")}
            >
              <span className="app-header-tab-icon">
                <img src="/house.svg" alt="" aria-hidden="true" />
              </span>
              <span>Accueil</span>
            </button>
            <button
              type="button"
              className={`${rewardsTab === "rewards" ? "app-header-tab app-header-tab-active" : "app-header-tab"}${
                hasMissingRewardVoice ? " app-header-tab-rewards-error" : ""
              }`}
              onClick={() => handleTabChange("rewards")}
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
              className={
                !hasElevenKey
                  ? "header-settings-btn header-settings-btn-eleven-missing"
                  : isElevenValid === false || elevenPermissionsOk === false
                    ? "header-settings-btn header-settings-btn-eleven-error"
                    : "header-settings-btn"
              }
              title="Paramètres ElevenLabs"
              aria-label={
                isFullyLinked
                  ? "Paramètres connectés (Twitch et ElevenLabs configurés)"
                  : !hasElevenKey
                    ? "Clé ElevenLabs manquante"
                    : isElevenValid === false || elevenPermissionsOk === false
                      ? "Clé ElevenLabs invalide ou autorisations incomplètes"
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
              title="Paramètres"
              aria-label="Afficher les paramètres"
              onClick={() => setAboutOpen(true)}
            >
              <img src="/settings.svg" alt="Paramètres" />
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

