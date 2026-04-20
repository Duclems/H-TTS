export {};

declare global {
  interface Window {
    hiTtsSecureStorage?: {
      get: (key: string) => Promise<string | null>;
      set: (key: string, value: string | null) => Promise<void>;
      isEncryptionAvailable: () => Promise<boolean>;
    };
  }
}
