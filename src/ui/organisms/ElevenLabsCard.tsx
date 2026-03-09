import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { loadElevenLabsConfig, saveElevenLabsConfig } from "../../elevenLabsConfig";
import { fetchElevenUser } from "../../elevenLabsApi";
import { Avatar } from "../atoms/Avatar";
import { Button } from "../atoms/Button";
import { FormField } from "../molecules/FormField";
import { Skeleton } from "../atoms/Skeleton";
import { TokenChipRow } from "../molecules/TokenChipRow";
import type { ChipItem } from "../molecules/TokenChipRow";
import { useToast } from "../context/ToastContext";

const LAST_USER_KEY = "h_tts_eleven_last_user";

function getInitialApiKey(): string {
  return loadElevenLabsConfig().apiKey ?? "";
}

type ElevenUserInfo = {
  name: string;
  avatarUrl: string | null;
  remainingCharacters: number | null;
  characterLimit: number | null;
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

function getInitialUserInfo(): ElevenUserInfo | null {
  if (!getInitialApiKey().trim()) return null;
  try {
    const raw = window.localStorage.getItem(LAST_USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ElevenUserInfo;
    if (typeof parsed?.name !== "string") return null;
    return {
      name: parsed.name,
      avatarUrl: typeof parsed.avatarUrl === "string" ? parsed.avatarUrl : null,
      remainingCharacters:
        typeof parsed.remainingCharacters === "number" ? parsed.remainingCharacters : null,
      characterLimit: typeof parsed.characterLimit === "number" ? parsed.characterLimit : null
    };
  } catch {
    return null;
  }
}

export const ElevenLabsCard = () => {
  const { addToast } = useToast();
  const [apiKey, setApiKey] = useState(getInitialApiKey);
  const [userInfo, setUserInfo] = useState<ElevenUserInfo | null>(getInitialUserInfo);
  const [loadingUser, setLoadingUser] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const cfg = loadElevenLabsConfig();
    setApiKey(cfg.apiKey);

    if (!cfg.apiKey.trim()) {
      setUserInfo(null);
      saveLastUserInfo(null);
      setLoadingUser(false);
      setHasError(false);
      return;
    }

    const invalidKey = window.localStorage.getItem("h_tts_eleven_invalid_key");
    if (invalidKey && invalidKey === cfg.apiKey) {
      setUserInfo(null);
      saveLastUserInfo(null);
      setLoadingUser(false);
      setHasError(true);
      return;
    }

    void (async () => {
      setLoadingUser(true);
      setHasError(false);
      const user = await fetchElevenUser();
      if (!user) {
        setUserInfo(null);
        saveLastUserInfo(null);
        setLoadingUser(false);
        setHasError(true);
        window.localStorage.setItem("h_tts_eleven_invalid_key", cfg.apiKey);
        return;
      }

      const avatarUrl = (user as any).profile_picture ?? (user as any).image_url ?? null;
      const subscription = user.subscription;
      const remaining =
        subscription && typeof subscription.character_limit === "number"
          ? subscription.character_limit - (subscription.character_count ?? 0)
          : null;

      const info: ElevenUserInfo = {
        name: (user as any).first_name || "Compte ElevenLabs",
        avatarUrl,
        remainingCharacters: remaining,
        characterLimit: subscription?.character_limit ?? null
      };
      setUserInfo(info);
      saveLastUserInfo(info);
      setLoadingUser(false);
      setHasError(false);
      window.localStorage.removeItem("h_tts_eleven_invalid_key");
    })();
  }, []);

  const handleSave = async () => {
    const trimmed = apiKey.trim();
    saveElevenLabsConfig({ apiKey: trimmed });
    addToast("Clé sauvegarder");

    if (!trimmed) {
      setUserInfo(null);
      saveLastUserInfo(null);
      setLoadingUser(false);
      setHasError(false);
      window.localStorage.removeItem("h_tts_eleven_invalid_key");
      return;
    }

    const invalidKey = window.localStorage.getItem("h_tts_eleven_invalid_key");
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
      window.localStorage.setItem("h_tts_eleven_invalid_key", trimmed);
      return;
    }

    const avatarUrl = (user as any).profile_picture ?? (user as any).image_url ?? null;
    const subscription = user.subscription;
    const remaining =
      subscription && typeof subscription.character_limit === "number"
        ? subscription.character_limit - (subscription.character_count ?? 0)
        : null;

    const info: ElevenUserInfo = {
      name: (user as any).first_name || "Compte ElevenLabs",
      avatarUrl,
      remainingCharacters: remaining,
      characterLimit: subscription?.character_limit ?? null
    };
    setUserInfo(info);
    saveLastUserInfo(info);
    setLoadingUser(false);
    setHasError(false);
    window.localStorage.removeItem("h_tts_eleven_invalid_key");
  };

  const permissionChips: ChipItem[] = [
    { label: "Text to Speech" },
    { label: "Voix" },
    { label: "Utilisateur" }
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
                Crédits restants :{" "}
                {userInfo.remainingCharacters.toLocaleString("fr-FR")} /{" "}
                {userInfo.characterLimit.toLocaleString("fr-FR")} caractères
              </div>
            )}
          </div>
        </div>
      )}

      <p className="card-text" style={{ marginTop: userInfo || loadingUser ? "0.6rem" : 0 }}>
        Récupère ta clé API ElevenLabs. Elle est utilisée pour tous les TTS.
        <br />
        Tu peux la récupérer depuis{" "}
        <a
          href="https://elevenlabs.io/app/developers/api-keys"
          target="_blank"
          rel="noreferrer"
          style={{ color: "inherit", textDecoration: "underline dotted" }}
        >
          la page des clés API ElevenLabs
        </a>
        .
      </p>
      <p className="card-text" style={{ marginTop: userInfo || loadingUser ? "0.6rem" : 0 }}>
        Sélectionne les champs suivants pour configurer le TTS :
      </p>
      <TokenChipRow chips={permissionChips} style={{ marginTop: "0.4rem" }} />

      <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", marginTop: "0.6rem" }}>
        <FormField
          id="eleven-api-key"
          label="Clé API ElevenLabs"
          type="password"
          value={apiKey}
          onChange={setApiKey}
          placeholder="sk_..."
          error={hasError}
        />
      </div>

      <Button
        variant={saveButtonDanger ? "danger" : "primary"}
        style={{ marginTop: "0.9rem" }}
        onClick={handleSave}
      >
        Sauvegarder
      </Button>
    </section>
  );
};
