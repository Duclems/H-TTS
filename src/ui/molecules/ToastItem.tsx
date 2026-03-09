import { useEffect, useState } from "react";
import { Toast } from "../atoms/Toast";
import type { ToastVariant } from "../atoms/Toast";

type Props = {
  id: string;
  message: React.ReactNode;
  variant?: ToastVariant;
  onDismiss: (id: string) => void;
  durationMs?: number;
};

export const ToastItem = ({
  id,
  message,
  variant = "success",
  onDismiss,
  durationMs = 3000
}: Props) => {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const leaveDelay = Math.max(0, durationMs - 250);
    let removeTimer: number | undefined;

    const leaveTimer = window.setTimeout(() => {
      setLeaving(true);
      removeTimer = window.setTimeout(() => {
        onDismiss(id);
      }, 250);
    }, leaveDelay);

    return () => {
      window.clearTimeout(leaveTimer);
      if (removeTimer !== undefined) {
        window.clearTimeout(removeTimer);
      }
    };
  }, [id, onDismiss, durationMs]);

  return (
    <div className={`toast-item${leaving ? " toast-item--leaving" : ""}`}>
      <Toast variant={variant}>{message}</Toast>
    </div>
  );
};
