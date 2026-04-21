import { useCallback, useEffect, useRef, useState } from "react";
import {
  cancelDeviceFlow,
  openTwitchVerification,
  startDeviceFlow,
  storeToken,
  waitForDeviceToken,
  type DeviceFlowStart
} from "../../../twitchAuth";
import { Button } from "../../atoms/Button";
import { CardTitle } from "../../atoms/CardTitle";
import { useI18n } from "../../context/I18nContext";
import { TwitchLoginAboutModal } from "../../organisms/TwitchLoginAboutModal";
import { AppShellLogin } from "../../templates/AppShellLogin";
import { HiTtsLogoLink } from "../../atoms/HiTtsLogoLink";
import pkg from "../../../../package.json";

type DeviceFlowStatus =
  | { kind: "idle" }
  | { kind: "starting" }
  | { kind: "awaiting"; start: DeviceFlowStart }
  | { kind: "error"; messageKey: string };

function mapDeviceFlowError(message: string): string {
  const normalized = message.toLowerCase();
  if (normalized.includes("bridge") || normalized.includes("electron")) {
    return "twitchLogin.deviceFlow.errorBridge";
  }
  if (normalized.includes("access_denied") || normalized.includes("denied")) {
    return "twitchLogin.deviceFlow.errorDenied";
  }
  if (
    normalized.includes("expired") ||
    normalized.includes("cancelled") ||
    normalized === "aborted"
  ) {
    return "twitchLogin.deviceFlow.errorExpired";
  }
  return "twitchLogin.deviceFlow.errorGeneric";
}

export const LoginPage = () => {
  const { t } = useI18n();
  const version = pkg.version ?? "0.0.0";
  const [aboutOpen, setAboutOpen] = useState(false);
  const [status, setStatus] = useState<DeviceFlowStatus>({ kind: "idle" });
  const activeSessionRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      const sid = activeSessionRef.current;
      if (sid) {
        void cancelDeviceFlow(sid);
        activeSessionRef.current = null;
      }
    };
  }, []);

  const runDeviceFlow = useCallback(async () => {
    setStatus({ kind: "starting" });
    let started: DeviceFlowStart;
    try {
      started = await startDeviceFlow();
    } catch (err) {
      setStatus({
        kind: "error",
        messageKey: mapDeviceFlowError(err instanceof Error ? err.message : "")
      });
      return;
    }

    activeSessionRef.current = started.sessionId;
    setStatus({ kind: "awaiting", start: started });
    void openTwitchVerification(started.verificationUri);

    try {
      const token = await waitForDeviceToken(started.sessionId);
      activeSessionRef.current = null;
      await storeToken(token);
      window.location.reload();
    } catch (err) {
      if (activeSessionRef.current === started.sessionId) {
        activeSessionRef.current = null;
      }
      setStatus({
        kind: "error",
        messageKey: mapDeviceFlowError(err instanceof Error ? err.message : "")
      });
    }
  }, []);

  const handleLogin = useCallback(() => {
    void runDeviceFlow();
  }, [runDeviceFlow]);

  const handleCancel = useCallback(() => {
    const sid = activeSessionRef.current;
    if (sid) {
      void cancelDeviceFlow(sid);
      activeSessionRef.current = null;
    }
    setStatus({ kind: "idle" });
  }, []);

  const handleReopen = useCallback(() => {
    if (status.kind === "awaiting") {
      void openTwitchVerification(status.start.verificationUri);
    }
  }, [status]);

  const renderBody = () => {
    if (status.kind === "idle") {
      return (
        <>
          <Button variant="primary" onClick={handleLogin}>
            {t("twitchLogin.cta")}
          </Button>
          <p className="card-text twitch-login-note">{t("twitchLogin.tokenNote")}</p>
          <button
            type="button"
            className="twitch-login-about-button"
            onClick={() => setAboutOpen(true)}
          >
            {t("twitchLogin.aboutPrivacyButton")}
          </button>
        </>
      );
    }

    if (status.kind === "starting") {
      return (
        <>
          <Button variant="primary" disabled>
            {t("twitchLogin.deviceFlow.preparing")}
          </Button>
          <p className="card-text twitch-login-note">{t("twitchLogin.tokenNote")}</p>
        </>
      );
    }

    if (status.kind === "awaiting") {
      return (
        <>
          <div className="twitch-login-device-code-label">
            {t("twitchLogin.deviceFlow.codeLabel")}
          </div>
          <div className="twitch-login-device-code" aria-live="polite">
            {status.start.userCode || "—"}
          </div>
          <div className="twitch-login-device-actions">
            <Button
              variant="primary"
              onClick={handleReopen}
              className="twitch-login-device-action"
            >
              {t("twitchLogin.deviceFlow.reopenButton")}
            </Button>
            <Button
              variant="danger"
              onClick={handleCancel}
              className="twitch-login-device-action"
            >
              {t("twitchLogin.deviceFlow.cancelButton")}
            </Button>
          </div>
        </>
      );
    }

    return (
      <>
        <p className="twitch-login-device-error">{t(status.messageKey)}</p>
        <Button variant="primary" onClick={handleLogin}>
          {t("twitchLogin.deviceFlow.retryButton")}
        </Button>
      </>
    );
  };

  return (
    <AppShellLogin>
      <section className="card twitch-login-card">
        <div className="twitch-login-main-cta">
          <CardTitle>{t("twitchLogin.title")}</CardTitle>
          <p className="card-text twitch-login-intro">{t("twitchLogin.intro")}</p>
          {renderBody()}
        </div>

        <footer className="twitch-login-footer">
          <div className="twitch-login-footer-row">
            <HiTtsLogoLink
              imgClassName="about-footer-logo"
              linkStyle={{ width: 48, height: 48, flexShrink: 0, display: "block" }}
            />
            <div className="about-footer-meta">
              <div className="about-footer-title-row">
                <div className="about-footer-title">{t("about.footerApp")}</div>
                <div className="about-footer-version">• {`v${version}`}</div>
              </div>
              <div className="about-footer-tagline">{t("about.footerTagline")}</div>
            </div>
          </div>
        </footer>

        {aboutOpen && <TwitchLoginAboutModal onClose={() => setAboutOpen(false)} />}
      </section>
    </AppShellLogin>
  );
};
