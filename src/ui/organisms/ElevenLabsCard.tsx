import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import {
  getCachedElevenLabsApiKey,
  hydrateElevenLabsFromSecureStorage,
  saveElevenLabsConfig
} from "../../elevenLabsConfig";
import { fetchElevenUser } from "../../elevenLabsApi";
import { Avatar } from "../atoms/Avatar";
import { Button } from "../atoms/Button";
import { FormField } from "../molecules/FormField";
import { Skeleton } from "../atoms/Skeleton";
import { TokenChipRow } from "../molecules/TokenChipRow";
import type { ChipItem } from "../molecules/TokenChipRow";
import { useToast } from "../context/ToastContext";
import { useI18n } from "../context/I18nContext";
import {
  STORAGE_KEY_ELEVEN_INVALID_KEY,
  STORAGE_KEY_ELEVEN_LAST_USER as LAST_USER_KEY
} from "../../storageKeys";

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

export const ElevenLabsCard = ({ onSaved }: Props) => {
  const { addToast } = useToast();
  const { t } = useI18n();
  const [apiKey, setApiKey] = useState("");
  const [userInfo, setUserInfo] = useState<ElevenUserInfo | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      await hydrateElevenLabsFromSecureStorage();
      if (cancelled) return;

      const cfgKey = getCachedElevenLabsApiKey();
      setApiKey(cfgKey);

      if (!cfgKey.trim()) {
        setUserInfo(null);
        saveLastUserInfo(null);
        setLoadingUser(false);
        setHasError(false);
        return;
      }

      const invalidKey = window.localStorage.getItem(STORAGE_KEY_ELEVEN_INVALID_KEY);
      if (invalidKey && invalidKey === cfgKey) {
        setUserInfo(null);
        saveLastUserInfo(null);
        setLoadingUser(false);
        setHasError(true);
        return;
      }

      setLoadingUser(true);
      setHasError(false);
      const user = await fetchElevenUser();
      if (cancelled) return;

      if (!user) {
        setUserInfo(null);
        saveLastUserInfo(null);
        setLoadingUser(false);
        setHasError(true);
        window.localStorage.setItem(STORAGE_KEY_ELEVEN_INVALID_KEY, cfgKey);
        return;
      }

      const avatarUrl = (user as any).profile_picture ?? (user as any).image_url ?? null;
      const subscription = user.subscription;
      const remaining =
        subscription && typeof subscription.character_limit === "number"
          ? subscription.character_limit - (subscription.character_count ?? 0)
          : null;

      const info: ElevenUserInfo = {
        name: (user as any).first_name || t("eleven.defaultAccount"),
        avatarUrl,
        remainingCharacters: remaining,
        characterLimit: subscription?.character_limit ?? null
      };
      setUserInfo(info);
      saveLastUserInfo(info);
      setLoadingUser(false);
      setHasError(false);
      window.localStorage.removeItem(STORAGE_KEY_ELEVEN_INVALID_KEY);
    })();

    return () => {
      cancelled = true;
    };
  }, [t]);

  const handleSave = async () => {
    const trimmed = apiKey.trim();
    await saveElevenLabsConfig({ apiKey: trimmed });
    addToast(t("eleven.cardKeySaved"));
    onSaved?.();

    if (!trimmed) {
      setUserInfo(null);
      saveLastUserInfo(null);
      setLoadingUser(false);
      setHasError(false);
      window.localStorage.removeItem(STORAGE_KEY_ELEVEN_INVALID_KEY);
      return;
    }

    const invalidKey = window.localStorage.getItem(STORAGE_KEY_ELEVEN_INVALID_KEY);
    if (invalidKey && invalidKey === trimmed) {
      setUserInfo(null);
      saveLastUserInfo(null);
      setLoadingUser(false);
      setHasError(true);
      return;
    }

    setLoadingUser(true);
    setHasError(false);
    const user = await fetchElevenUser();
    if (!user) {
      setUserInfo(null);
      saveLastUserInfo(null);
      setLoadingUser(false);
      setHasError(true);
      window.localStorage.setItem(STORAGE_KEY_ELEVEN_INVALID_KEY, trimmed);
      return;
    }

    const avatarUrl = (user as any).profile_picture ?? (user as any).image_url ?? null;
    const subscription = user.subscription;
    const remaining =
      subscription && typeof subscription.character_limit === "number"
        ? subscription.character_limit - (subscription.character_count ?? 0)
        : null;

    const info: ElevenUserInfo = {
      name: (user as any).first_name || t("eleven.defaultAccount"),
      avatarUrl,
      remainingCharacters: remaining,
      characterLimit: subscription?.character_limit ?? null
    };
    setUserInfo(info);
    saveLastUserInfo(info);
    setLoadingUser(false);
    setHasError(false);
    window.localStorage.removeItem(STORAGE_KEY_ELEVEN_INVALID_KEY);
  };

  const permissionChips: ChipItem[] = [
    { label: t("eleven.permissionTts") },
    { label: t("eleven.permissionVoices") },
    { label: t("eleven.permissionUser") }
  ];

  const saveButtonDanger = !apiKey.trim() || hasError;

  return (
    <section className="card">
      {loadingUser && !userInfo && (
        <div className="eleven-user-header">
          <div className="eleven-user-avatar">
            <Skeleton variant="avatar" />
          </div>
          <div className="eleven-user-meta">
            <Skeleton variant="line" lineSize="main" style={{ "--skeleton-line-height": "10px" } as CSSProperties} />
            <Skeleton variant="line" lineSize="small" style={{ "--skeleton-line-height": "8px" } as CSSProperties} />
          </div>
        </div>
      )}
      {userInfo && (
        <div className="eleven-user-header">
          <Avatar src={userInfo.avatarUrl} initial={userInfo.name} alt={userInfo.name} />
          <div className="eleven-user-meta">
            <div className="eleven-user-name">{userInfo.name}</div>
            {userInfo.remainingCharacters != null && userInfo.characterLimit != null && (
              <div className="eleven-user-credits">
                {t("eleven.creditsRemaining")}{" "}
                {userInfo.remainingCharacters.toLocaleString("fr-FR")} /{" "}
                {userInfo.characterLimit.toLocaleString("fr-FR")} {t("eleven.characters")}
              </div>
            )}
          </div>
        </div>
      )}

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
