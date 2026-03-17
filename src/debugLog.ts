export type DebugLogType = "reward" | "redeem" | "tmi" | "eleven" | "system" | "auth" | "other";

export type DebugLogEntry = {
  timestamp: number;
  type: DebugLogType;
  source: string;
  message: string;
  details?: unknown;
};

let entries: DebugLogEntry[] = [];
const listeners: ((all: DebugLogEntry[]) => void)[] = [];

export function logDebug(entry: DebugLogEntry): void {
  entries = [...entries, entry].slice(-200);
  for (const listener of listeners) {
    listener(entries);
  }
}

export function subscribeDebug(
  listener: (all: DebugLogEntry[]) => void
): () => void {
  listeners.push(listener);
  listener(entries);
  return () => {
    const idx = listeners.indexOf(listener);
    if (idx >= 0) {
      listeners.splice(idx, 1);
    }
  };
}

