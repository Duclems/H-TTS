import { useEffect, useState } from "react";

/**
 * Interroge le main process (via `window.hiTtsSecureStorage.isEncryptionAvailable`)
 * pour savoir si `safeStorage` chiffre réellement les secrets sur disque.
 *
 * - `null`  : état encore inconnu (pas de bridge ou requête en vol).
 * - `true`  : secrets chiffrés par l'OS (DPAPI / Keychain / keyring).
 * - `false` : fallback en clair actif — l'UI doit avertir l'utilisateur.
 */
export function useSecureStorageEncryption(): boolean | null {
  const [available, setAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    const bridge = typeof window !== "undefined" ? window.hiTtsSecureStorage : undefined;
    if (!bridge) {
      setAvailable(null);
      return;
    }
    bridge
      .isEncryptionAvailable()
      .then((value) => {
        if (!cancelled) setAvailable(Boolean(value));
      })
      .catch(() => {
        if (!cancelled) setAvailable(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return available;
}
