import { useCallback, useEffect, useRef, useState } from "react";
import {
  getCachedElevenLabsApiKey,
  hydrateElevenLabsFromSecureStorage,
  saveElevenLabsConfig
} from "../../elevenLabsConfig";
import { fetchElevenUser, type ElevenUser } from "../../elevenLabsApi";
import { Button } from "../atoms/Button";
import { FormField } from "../molecules/FormField";
import { TokenChipRow } from "../molecules/TokenChipRow";
import type { ChipItem } from "../molecules/TokenChipRow";
import { UserHeader } from "../molecules/UserHeader";
import { useToast } from "../context/ToastContext";
import { useI18n } from "../context/I18nContext";
import { STORAGE_KEY_ELEVEN_LAST_USER as LAST_USER_KEY } from "../../storageKeys";

type ElevenUserInfo = {
  name: string;
  avatarUrl: string | null;
  remainingCharacters: number | null;
  characterLimit: number | null;
};

type Props = {
  onSaved?: () => void;
};

function saveLastUserInfo(info: ElevenUserInfo | null): void {
  if (info) {
    try {
      window.localStorage.setItem(LAST_USER_KEY, JSON.stringify(info));
    } catch {
      window.localStorage.removeItem(LAST_USER_KEY);
    }
  } else {
    window.localStorage.removeItem(LAST_USER_KEY);
  }
}

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

export const ElevenLabsCard = ({ onSaved }: Props) => {
  const { addToast } = useToast();
  const { t } = useI18n();
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
        saveLastUserInfo(null);
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
        saveLastUserInfo(null);
        setLoadingUser(false);
        setHasError(true);
        return;
      }

      const info = userToInfo(user, tRef.current("eleven.defaultAccount"));
      setUserInfo(info);
      saveLastUserInfo(info);
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

  const handleSave = async () => {
    const trimmed = apiKey.trim();
    await saveElevenLabsConfig({ apiKey: trimmed });
    addToast(t("eleven.cardKeySaved"));
    onSaved?.();
    await refreshUser(trimmed);
  };

  const permissionChips: ChipItem[] = [
    { label: t("eleven.permissionTts") },
    { label: t("eleven.permissionVoices") },
    { label: t("eleven.permissionUser") }
  ];

  const saveButtonDanger = !apiKey.trim() || hasError;

  return (
    <section className="card">
      {(loadingUser && !userInfo) || userInfo ? (
        <UserHeader
          loading={loadingUser}
          avatarUrl={userInfo?.avatarUrl}
          name={userInfo?.name}
          meta={
            userInfo?.remainingCharacters != null && userInfo?.characterLimit != null ? (
              <div className="eleven-user-credits">
                {t("eleven.creditsRemaining")}{" "}
                {userInfo.remainingCharacters.toLocaleString("fr-FR")} /{" "}
                {userInfo.characterLimit.toLocaleString("fr-FR")} {t("eleven.characters")}
              </div>
            ) : undefined
          }
        />
      ) : null}

      <p className="card-text" style={{ marginTop: userInfo || loadingUser ? "0.6rem" : 0 }}>
        {t("eleven.intro")}
        <br />
        {t("eleven.getFromLink")}{" "}
        <a
          href="https://elevenlabs.io/app/developers/api-keys"
          target="_blank"
          rel="noreferrer"
          style={{ color: "inherit", textDecoration: "underline dotted" }}
        >
          {t("eleven.apiKeysLink")}
        </a>
        .
      </p>
      <p className="card-text" style={{ marginTop: "0.6rem" }}>
        {t("eleven.selectPermissions")}
      </p>
      <TokenChipRow chips={permissionChips} style={{ marginTop: "0.4rem" }} />
      <p className="card-text" style={{ fontSize: "0.7rem", marginTop: "0.35rem", opacity: 0.8 }}>
        {t("eleven.keyStoredNote")}
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", marginTop: "0.6rem" }}>
        <FormField
          id="eleven-api-key"
          label={t("eleven.apiKeyLabel")}
          type="password"
          value={apiKey}
          onChange={setApiKey}
          placeholder="sk_..."
          error={hasError}
          disableLabelClick
        />
      </div>

      <Button
        variant={saveButtonDanger ? "danger" : "primary"}
        style={{ marginTop: "0.9rem" }}
        onClick={() => void handleSave()}
      >
        {t("eleven.save")}
      </Button>
    </section>
  );
};
