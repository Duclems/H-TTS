export type DebugLogType = "reward" | "redeem" | "eleven" | "system" | "auth" | "other";

export type DebugLogEntry = {
  timestamp: number;
  type: DebugLogType;
  source: string;
  message: string;
  details?: unknown;
};

const MAX_ENTRIES = 200;

const buffer: DebugLogEntry[] = [];
const listeners: ((all: DebugLogEntry[]) => void)[] = [];

export function logDebug(entry: DebugLogEntry): void {
  buffer.push(entry);
  if (buffer.length > MAX_ENTRIES) {
    buffer.shift();
  }
  if (listeners.length === 0) return;
  const snapshot = buffer.slice();
  for (const listener of listeners) {
    listener(snapshot);
  }
}

export function subscribeDebug(
  listener: (all: DebugLogEntry[]) => void
): () => void {
  listeners.push(listener);
  listener(buffer.slice());
  return () => {
    const idx = listeners.indexOf(listener);
    if (idx >= 0) {
      listeners.splice(idx, 1);
    }
  };
}

