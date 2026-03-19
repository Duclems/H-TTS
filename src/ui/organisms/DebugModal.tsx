import { useEffect, useMemo, useState } from "react";
import { subscribeDebug, type DebugLogEntry, type DebugLogType } from "../../debugLog";
import { ModalHeader } from "../molecules/ModalHeader";
import { useI18n } from "../context/I18nContext";

type Props = {
  onClose: () => void;
};

export const DebugModal = ({ onClose }: Props) => {
  const { t } = useI18n();
  const [logs, setLogs] = useState<DebugLogEntry[]>([]);
  const [filter, setFilter] = useState<DebugLogType | "all">("all");

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  useEffect(() => {
    const unsubscribe = subscribeDebug(setLogs);
    return () => unsubscribe();
  }, []);

  const availableTypes = useMemo(() => {
    const base: DebugLogType[] = ["reward", "redeem", "tmi", "eleven", "system", "auth", "other"];
    return base.filter((type) => logs.some((log) => log.type === type));
  }, [logs]);

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Hi-TTS debug overlay" onClick={(e) => {
      if (e.target === e.currentTarget) onClose();
    }}>
      <div
        className="panel modal-content"
        style={{
          maxWidth: "640px",
          maxHeight: "80vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <header>
          <ModalHeader
            titleId="hi-tts-debug-modal-title"
            title={t("debug.title")}
            rightContent={
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as DebugLogType | "all")}
                style={{
                  fontSize: "0.8rem",
                  height: "1.75rem",
                  padding: "0 0.75rem",
                  borderRadius: "999px",
                  border: "1px solid var(--border-main)",
                  backgroundColor: "var(--bg-raised)",
                  color: "var(--text)",
                  maxWidth: "260px",
                }}
              >
                <option value="all">{t("debug.selectPlaceholder")}</option>
                {availableTypes.includes("reward") && <option value="reward">{t("debug.categoryReward")}</option>}
                {availableTypes.includes("redeem") && <option value="redeem">{t("debug.categoryRedeem")}</option>}
                {availableTypes.includes("tmi") && <option value="tmi">{t("debug.categoryTmi")}</option>}
                {availableTypes.includes("eleven") && <option value="eleven">{t("debug.categoryEleven")}</option>}
                {availableTypes.includes("system") && <option value="system">{t("debug.categorySystem")}</option>}
                {availableTypes.includes("auth") && <option value="auth">{t("debug.categoryAuth")}</option>}
                {availableTypes.includes("other") && <option value="other">{t("debug.categoryOther")}</option>}
              </select>
            }
            onClose={onClose}
          />
        </header>
        <main
          style={{
            padding: "0.5rem 0.9rem 0.75rem",
            overflowY: "auto",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, Courier New, monospace",
            fontSize: "0.75rem",
          }}
        >
          {logs.length === 0 && (
            <p style={{ margin: 0, color: "var(--text-muted)" }}>
              {t("debug.empty")}
            </p>
          )}
          {logs
            .filter((log) => filter === "all" || log.type === filter)
            .slice()
            .reverse()
            .map((log, index) => (
              <div
                key={index}
                style={{
                  borderBottom: "1px solid var(--border-main)",
                  padding: "0.4rem 0",
                }}
              >
                <div style={{ color: "var(--text-muted)" }}>
                  {new Date(log.timestamp).toLocaleTimeString()} • {log.source}
                </div>
                <div>{log.message}</div>
                {Boolean(log.details) && (
                  <pre
                    style={{
                      margin: "0.25rem 0 0",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      color: "var(--text-muted)",
                    }}
                  >
                    {typeof log.details === "string"
                      ? log.details
                      : JSON.stringify(log.details, null, 2)}
                  </pre>
                )}
              </div>
            ))}
        </main>
      </div>
    </div>
  );
};

