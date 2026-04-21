export type DebugLogType = "reward" | "redeem" | "eleven" | "system" | "auth" | "other";

export type DebugLogEntry = {
  timestamp: number;
  type: DebugLogType;
  source: string;
  message: string;
  details?: unknown;
};

const MAX_ENTRIES = 200;

// Buffer interne muté en place (push + shift). On en produit un snapshot
// immuable (`slice()`) avant de notifier les listeners : React (DebugModal) a
// besoin d'une nouvelle référence pour détecter le changement d'état, mais on
// évite le double coût de l'ancienne version (`[...entries, entry].slice(-200)`
// → 2 allocations + une copie complète à chaque log).
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

