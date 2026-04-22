import { forwardRef, isValidElement, type ReactNode } from "react";
import { useI18n } from "../context/I18nContext";

type TabId = "history" | "rewards";

type HeaderCreditsProps = {
  title: string;
  subtitle?: ReactNode;
  credits: { remaining: number; limit: number } | null;
  formatCredits: (value: number) => string;
  creditsLabel: string;
};

export const AppHeaderMain = ({
  title,
  subtitle,
  credits,
  formatCredits,
  creditsLabel
}: HeaderCreditsProps) => (
  <div className="app-header-main">
    <div className="app-header-main-top">
      <div className="app-title">{title}</div>
      {credits && (
        <div className="app-header-credits">
          {creditsLabel}{" "}
          <strong>
            {formatCredits(credits.remaining)} / {formatCredits(credits.limit)}
          </strong>
        </div>
      )}
    </div>
    {subtitle == null || subtitle === false ? null : isValidElement(subtitle) ? (
      subtitle
    ) : (
      <p className="app-subtitle">{subtitle}</p>
    )}
  </div>
);

type Props = {
  header: ReactNode;
  children: ReactNode;
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  hasMissingRewardVoice: boolean;
  isFullyLinked: boolean;
  hasElevenKey: boolean;
  showElevenError: boolean;
  onOpenTwitch: () => void;
  onOpenSettings: () => void;
  onOpenAbout: () => void;
};

export const AppShellAuthenticated = forwardRef<HTMLElement, Props>(function AppShellAuthenticated(
  {
    header,
    children,
    activeTab,
    onTabChange,
    hasMissingRewardVoice,
    isFullyLinked,
    hasElevenKey,
    showElevenError,
    onOpenTwitch,
    onOpenSettings,
    onOpenAbout
  },
  mainRef
) {
  const { t } = useI18n();

  return (
    <div className="app-shell">
      <div className="app-shell-header">{header}</div>

      <main className="app-main" ref={mainRef}>
        {children}
      </main>

      <footer className="app-footer">
        <div className="app-header-main-tabs">
          <button
            type="button"
            className={
              activeTab === "history"
                ? "app-header-tab app-header-tab-active"
                : "app-header-tab"
            }
            onClick={() => onTabChange("history")}
          >
            <span className="app-header-tab-icon">
              <img src="/house.svg" alt="" aria-hidden="true" />
            </span>
            <span>{t("app.home")}</span>
          </button>
          <button
            type="button"
            className={`${activeTab === "rewards" ? "app-header-tab app-header-tab-active" : "app-header-tab"}${
              hasMissingRewardVoice ? " app-header-tab-rewards-error" : ""
            }`}
            onClick={() => onTabChange("rewards")}
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
            onClick={onOpenTwitch}
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
            onClick={onOpenSettings}
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
            onClick={onOpenAbout}
          >
            <img src="/settings.svg" alt={t("settings.titleAbout")} />
          </button>
        </div>
      </footer>
    </div>
  );
});
