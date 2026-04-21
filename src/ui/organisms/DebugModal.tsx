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
    const base: DebugLogType[] = ["reward", "redeem", "eleven", "system", "auth", "other"];
    return base.filter((type) => logs.some((log) => log.type === type));
  }, [logs]);

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Hi-TTS debug overlay" onClick={(e) => {
      if (e.target === e.currentTarget) onClose();
    }}>
      <div
        className="panel modal-content debug-modal"
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
                className="debug-modal-filter"
              >
                <option value="all">{t("debug.selectPlaceholder")}</option>
                {availableTypes.includes("reward") && <option value="reward">{t("debug.categoryReward")}</option>}
                {availableTypes.includes("redeem") && <option value="redeem">{t("debug.categoryRedeem")}</option>}
                {availableTypes.includes("eleven") && <option value="eleven">{t("debug.categoryEleven")}</option>}
                {availableTypes.includes("system") && <option value="system">{t("debug.categorySystem")}</option>}
                {availableTypes.includes("auth") && <option value="auth">{t("debug.categoryAuth")}</option>}
                {availableTypes.includes("other") && <option value="other">{t("debug.categoryOther")}</option>}
              </select>
            }
            onClose={onClose}
          />
        </header>
        <main className="debug-modal-main">
          {logs.length === 0 && (
            <p className="debug-modal-empty">
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
                className="debug-modal-entry"
              >
                <div className="debug-modal-meta">
                  {new Date(log.timestamp).toLocaleTimeString()} • {log.source}
                </div>
                <div>{log.message}</div>
                {Boolean(log.details) && (
                  <pre className="debug-modal-details">
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

