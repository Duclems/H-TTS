import { useEffect } from "react";

export function useDebugShortcut(toggle: () => void): void {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key?.toLowerCase() === "h" && event.ctrlKey && event.shiftKey && event.altKey) {
        event.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [toggle]);
}
