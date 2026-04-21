import { FormField } from "../molecules/FormField";
import { TokenChipRow } from "../molecules/TokenChipRow";
import type { ChipItem } from "../molecules/TokenChipRow";
import { UserHeader } from "../molecules/UserHeader";
import { useI18n } from "../context/I18nContext";
import type { ElevenUserInfo } from "../hooks/useElevenLabsForm";

type Props = {
  apiKey: string;
  setApiKey: (value: string) => void;
  userInfo: ElevenUserInfo | null;
  loadingUser: boolean;
  hasError: boolean;
};

export const ElevenLabsCard = ({ apiKey, setApiKey, userInfo, loadingUser, hasError }: Props) => {
  const { t } = useI18n();

  const permissionChips: ChipItem[] = [
    { label: t("eleven.permissionTts") },
    { label: t("eleven.permissionVoices") },
    { label: t("eleven.permissionUser") }
  ];

  return (
    <>
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

      <p className="card-text" style={{ marginTop: userInfo || loadingUser ? "0.35rem" : 0 }}>
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
      <p className="card-text" style={{ marginTop: "0.35rem" }}>
        {t("eleven.selectPermissions")}
      </p>
      <TokenChipRow chips={permissionChips} style={{ marginTop: "0.25rem" }} />
      <p className="card-text" style={{ fontSize: "0.7rem", marginTop: "0.25rem", opacity: 0.8 }}>
        {t("eleven.keyStoredNote")}
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "0.4rem" }}>
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
    </>
  );
};
