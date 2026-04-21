import { useCallback, useEffect, useRef, useState } from "react";
import { getStoredToken, type TwitchTokenResponse } from "../twitchAuth";
import {
  getCachedElevenLabsApiKey,
  hydrateElevenLabsFromSecureStorage
} from "../elevenLabsConfig";
import { ToastProvider } from "./context/ToastContext";
import { TwitchRewardsProvider } from "./context/TwitchRewardsContext";
import { useI18n } from "./context/I18nContext";
import { useDebugShortcut } from "./hooks/useDebugShortcut";
import { useElevenLabsHealth } from "./hooks/useElevenLabsHealth";
import { AboutModal } from "./organisms/AboutModal";
import { DebugModal } from "./organisms/DebugModal";
import { SettingsModal } from "./organisms/SettingsModal";
import { TwitchSessionModal } from "./organisms/TwitchSessionModal";
import { HistoryPage } from "./pages/HistoryPage/HistoryPage";
import { LoginPage } from "./pages/LoginPage/LoginPage";
import { SplashPage } from "./pages/LoginPage/SplashPage";
import { RewardsPage } from "./pages/RewardsPage/RewardsPage";
import {
  AppHeaderMain,
  AppShellAuthenticated
} from "./templates/AppShellAuthenticated";

type TabId = "history" | "rewards";

export const App = () => {
  const { t } = useI18n();
  const [bootLoading, setBootLoading] = useState(true);
  const [token, setToken] = useState<TwitchTokenResponse | null>(null);
  const [elevenApiKey, setElevenApiKey] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [twitchOpen, setTwitchOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("history");
  const [hasMissingRewardVoice, setHasMissingRewardVoice] = useState(false);
  const mainRef = useRef<HTMLElement | null>(null);

  const toggleDebug = useCallback(() => setDebugOpen((prev) => !prev), []);
  useDebugShortcut(toggleDebug);

  const elevenHealth = useElevenLabsHealth(elevenApiKey, !bootLoading);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const stored = await getStoredToken();
        await hydrateElevenLabsFromSecureStorage();
        if (!cancelled) {
          setToken(stored);
          setElevenApiKey(getCachedElevenLabsApiKey());
        }
      } finally {
        if (!cancelled) setBootLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  const formatCredits = useCallback((value: number): string => {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
    return `${value}`;
  }, []);

  const isTwitchConnected = !!token;
  const isFullyLinked =
    isTwitchConnected && !!elevenHealth.isValid && elevenHealth.permissionsOk !== false;
  const hasElevenKey = !!elevenApiKey.trim();
  const showElevenError =
    !hasElevenKey || elevenHealth.isValid === false || elevenHealth.permissionsOk === false;

  const handleTabChange = (tab: TabId) => {
    setActiveTab(tab);
    mainRef.current?.scrollTo({ top: 0, behavior: "auto" });
  };

  const handleElevenLabsSaved = () => {
    setElevenApiKey(getCachedElevenLabsApiKey());
  };

  if (bootLoading) {
    return (
      <ToastProvider>
        <SplashPage />
      </ToastProvider>
    );
  }

  if (!token) {
    return (
      <ToastProvider>
        <LoginPage />
      </ToastProvider>
    );
  }

  const header =
    activeTab === "history" ? (
      <AppHeaderMain
        title={t("app.history")}
        subtitleHtml={t("app.redeemsRefresh")}
        credits={elevenHealth.credits}
        formatCredits={formatCredits}
        creditsLabel={t("app.creditsRemaining")}
      />
    ) : (
      <AppHeaderMain
        title={t("app.rewardsManagement")}
        subtitle={t("app.rewardsSubtitle")}
        credits={elevenHealth.credits}
        formatCredits={formatCredits}
        creditsLabel={t("app.creditsRemaining")}
      />
    );

  return (
    <ToastProvider>
      <TwitchRewardsProvider token={token}>
        <AppShellAuthenticated
          ref={mainRef}
          header={header}
          activeTab={activeTab}
          onTabChange={handleTabChange}
          hasMissingRewardVoice={hasMissingRewardVoice}
          isFullyLinked={isFullyLinked}
          hasElevenKey={hasElevenKey}
          showElevenError={showElevenError}
          onOpenTwitch={() => setTwitchOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenAbout={() => setAboutOpen(true)}
        >
          {activeTab === "history" ? (
            <HistoryPage />
          ) : (
            <RewardsPage
              token={token}
              onMissingRewardVoiceChange={setHasMissingRewardVoice}
            />
          )}
        </AppShellAuthenticated>

        {settingsOpen && (
          <SettingsModal
            onClose={() => setSettingsOpen(false)}
            onElevenLabsSaved={handleElevenLabsSaved}
          />
        )}
        {twitchOpen && <TwitchSessionModal token={token} onClose={() => setTwitchOpen(false)} />}
        {aboutOpen && <AboutModal onClose={() => setAboutOpen(false)} />}
        {debugOpen && <DebugModal onClose={() => setDebugOpen(false)} />}
      </TwitchRewardsProvider>
    </ToastProvider>
  );
};
