import { useEffect, useState } from "react";
import { subscribeDebug, type DebugLogEntry } from "../../debugLog";
import { ModalHeader } from "../molecules/ModalHeader";

type Props = {
  onClose: () => void;
};

export const DebugModal = ({ onClose }: Props) => {
  const [logs, setLogs] = useState<DebugLogEntry[]>([]);

  useEffect(() => {
    const unsubscribe = subscribeDebug(setLogs);
    return () => unsubscribe();
  }, []);

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="HI-TTS debug overlay" onClick={(e) => {
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
            title="HI-TTS • Debug"
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
              Aucun log pour l’instant. Les erreurs ou événements techniques apparaîtront ici.
            </p>
          )}
          {logs
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

