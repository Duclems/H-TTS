import { useCallback, useEffect, useRef, useState } from "react";
import {
  getCachedElevenLabsApiKey,
  hydrateElevenLabsFromSecureStorage,
  saveElevenLabsConfig
} from "../../elevenLabsConfig";
import { fetchElevenUser, type ElevenUser } from "../../elevenLabsApi";
import { useI18n } from "../context/I18nContext";
import { useToast } from "../context/ToastContext";

export type ElevenUserInfo = {
  name: string;
  avatarUrl: string | null;
  remainingCharacters: number | null;
  characterLimit: number | null;
};

function userToInfo(user: ElevenUser, defaultName: string): ElevenUserInfo {
  const avatarUrl = user.profile_picture ?? user.image_url ?? null;
  const subscription = user.subscription;
  const remaining =
    subscription && typeof subscription.character_limit === "number"
      ? subscription.character_limit - (subscription.character_count ?? 0)
      : null;
  return {
    name: user.first_name || defaultName,
    avatarUrl,
    remainingCharacters: remaining,
    characterLimit: subscription?.character_limit ?? null
  };
}

type Options = {
  onSaved?: () => void;
};

export function useElevenLabsForm({ onSaved }: Options = {}) {
  const { t } = useI18n();
  const { addToast } = useToast();
  const [apiKey, setApiKey] = useState("");
  const [userInfo, setUserInfo] = useState<ElevenUserInfo | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [hasError, setHasError] = useState(false);

  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  }, [t]);

  const refreshUser = useCallback(
    async (key: string, cancelledRef?: { current: boolean }): Promise<void> => {
      const cancelled = () => cancelledRef?.current === true;

      if (!key.trim()) {
        if (cancelled()) return;
        setUserInfo(null);
        setLoadingUser(false);
        setHasError(false);
        return;
      }

      if (cancelled()) return;
      setLoadingUser(true);
      setHasError(false);

      const user = await fetchElevenUser();
      if (cancelled()) return;

      if (!user) {
        setUserInfo(null);
        setLoadingUser(false);
        setHasError(true);
        return;
      }

      setUserInfo(userToInfo(user, tRef.current("eleven.defaultAccount")));
      setLoadingUser(false);
      setHasError(false);
    },
    []
  );

  useEffect(() => {
    const cancelRef = { current: false };
    void (async () => {
      await hydrateElevenLabsFromSecureStorage();
      if (cancelRef.current) return;
      const cfgKey = getCachedElevenLabsApiKey();
      setApiKey(cfgKey);
      await refreshUser(cfgKey, cancelRef);
    })();
    return () => {
      cancelRef.current = true;
    };
  }, [refreshUser]);

  const handleSave = useCallback(async () => {
    const trimmed = apiKey.trim();
    await saveElevenLabsConfig({ apiKey: trimmed });
    addToast(tRef.current("eleven.cardKeySaved"));
    onSaved?.();
    await refreshUser(trimmed);
  }, [apiKey, addToast, onSaved, refreshUser]);

  const saveButtonDanger = !apiKey.trim() || hasError;

  return {
    apiKey,
    setApiKey,
    userInfo,
    loadingUser,
    hasError,
    handleSave,
    saveButtonDanger
  };
}
