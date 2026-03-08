import { useEffect } from "react";
import { Toast } from "../atoms/Toast";
import type { ToastVariant } from "../atoms/Toast";

type Props = {
  id: string;
  message: string;
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
  useEffect(() => {
    const t = window.setTimeout(() => {
      onDismiss(id);
    }, durationMs);
    return () => window.clearTimeout(t);
  }, [id, onDismiss, durationMs]);

  return (
    <div className="toast-item">
      <Toast variant={variant}>{message}</Toast>
    </div>
  );
};
