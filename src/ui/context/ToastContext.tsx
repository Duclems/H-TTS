import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { ToastItem } from "../molecules/ToastItem";
import type { ToastVariant } from "../atoms/Toast";

type ToastEntry = {
  id: string;
  message: React.ReactNode;
  variant: ToastVariant;
  durationMs?: number;
};

type ToastContextValue = {
  addToast: (message: React.ReactNode, variant?: ToastVariant, durationMs?: number) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

let toastId = 0;
function nextId() {
  return `toast-${++toastId}`;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);

  const addToast = useCallback(
    (message: React.ReactNode, variant: ToastVariant = "success", durationMs?: number) => {
      const id = nextId();
      setToasts((prev) => [...prev, { id, message, variant, durationMs }]);
    },
    []
  );

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const value = useMemo(() => ({ addToast }), [addToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-container" aria-label="Notifications">
        {toasts.map((t) => (
          <ToastItem
            key={t.id}
            id={t.id}
            message={t.message}
            variant={t.variant}
            onDismiss={removeToast}
            durationMs={t.durationMs}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return ctx;
}
