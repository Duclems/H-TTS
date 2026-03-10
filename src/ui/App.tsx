import { useEffect, useState } from "react";
import { TwitchLoginCard } from "./organisms/TwitchLoginCard";
import { RewardsCard } from "./organisms/RewardsCard";
import { getStoredToken } from "../twitchAuth";
import { loadElevenLabsConfig } from "../elevenLabsConfig";
import { fetchElevenUser, checkElevenPermissions } from "../elevenLabsApi";
import { ToastProvider } from "./context/ToastContext";
import { SettingsModal } from "./organisms/SettingsModal";
import { TwitchSessionModal } from "./organisms/TwitchSessionModal";
import { AboutModal } from "./organisms/AboutModal";
import { useI18n } from "./context/I18nContext";

const ELEVEN_CHECK_INTERVAL_MS = 10_000;

export const App = () => {
  const { t } = useI18n();
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

      setIsElevenValid(!!user && hasCreditsInfo);
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
  const showElevenError =
    !hasElevenKey || isElevenValid === false || elevenPermissionsOk === false;

  const handleTabChange = (tab: "history" | "rewards") => {
    setRewardsTab(tab);
    const main = document.querySelector<HTMLElement>(".app-main");
    if (main) {
      main.scrollTo({ top: 0, behavior: "auto" });
    }
  };

  return (
    <ToastProvider>
    <div className={`app-shell${!token ? " app-shell--login" : ""}`}>
      <div className="app-shell-header">
        {isTwitchConnected && rewardsTab === "history" && (
          <div className="app-header-main">
            <div className="app-header-main-top">
              <div className="app-title">{t("app.history")}</div>
              {elevenCredits && (
                <div className="app-header-credits">
                  {t("app.creditsRemaining")}{" "}
                  <strong>
                    {formatCredits(elevenCredits.remaining)} / {formatCredits(elevenCredits.limit)}
                  </strong>
                </div>
              )}
            </div>
            <p className="app-subtitle" dangerouslySetInnerHTML={{ __html: t("app.redeemsRefresh") }} />
          </div>
        )}
        {isTwitchConnected && rewardsTab === "rewards" && (
          <div className="app-header-main">
            <div className="app-header-main-top">
              <div className="app-title">{t("app.rewardsManagement")}</div>
              {elevenCredits && (
                <div className="app-header-credits">
                  {t("app.creditsRemaining")}{" "}
                  <strong>
                    {formatCredits(elevenCredits.remaining)} / {formatCredits(elevenCredits.limit)}
                  </strong>
                </div>
              )}
            </div>
            <p className="app-subtitle">
              {t("app.rewardsSubtitle")}
            </p>
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
              <span>{t("app.home")}</span>
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
              <span>{t("app.rewards")}</span>
            </button>
          </div>
          <div className="app-header-icons">
            <button
              type="button"
              className="header-settings-btn"
              title={t("app.twitchSession")}
              aria-label={t("app.twitchSessionAria")}
              onClick={() => setTwitchOpen(true)}
            >
              <img src="/twitch.svg" alt="Twitch" />
            </button>
            <button
              type="button"
              className={
                !hasElevenKey
                  ? "header-settings-btn header-settings-btn-eleven-missing"
                  : showElevenError
                    ? "header-settings-btn header-settings-btn-eleven-error"
                    : "header-settings-btn"
              }
              title={t("app.elevenSettings")}
              aria-label={
                isFullyLinked
                  ? t("app.elevenConnected")
                  : !hasElevenKey
                    ? t("app.elevenKeyMissing")
                    : showElevenError
                      ? t("app.elevenKeyInvalid")
                      : t("app.elevenToComplete")
              }
              onClick={() => setSettingsOpen(true)}
            >
              <img
                src={isFullyLinked ? "/link.svg" : "/unlink.svg"}
                alt={isFullyLinked ? t("app.linked") : t("app.unlinked")}
              />
            </button>
            <button
              type="button"
              className="header-settings-btn"
              title={t("settings.titleAbout")}
              aria-label={t("settings.titleAbout")}
              onClick={() => setAboutOpen(true)}
            >
              <img src="/settings.svg" alt={t("settings.titleAbout")} />
            </button>
          </div>
        </footer>
      )}

      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
      {twitchOpen && <TwitchSessionModal onClose={() => setTwitchOpen(false)} />}
      {aboutOpen && <AboutModal onClose={() => setAboutOpen(false)} />}
    </div>
    </ToastProvider>
  );
};

