export {};

declare global {
  interface Window {
    hiTtsApp?: {
      setLocale: (locale: "fr" | "en") => Promise<void>;
    };
    hiTtsSecureStorage?: {
      get: (key: string) => Promise<string | null>;
      set: (key: string, value: string | null) => Promise<void>;
      isEncryptionAvailable: () => Promise<boolean>;
    };
  }
}
