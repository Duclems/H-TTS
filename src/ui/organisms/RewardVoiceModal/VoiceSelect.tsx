import { useI18n } from "../../context/I18nContext";
import type { VoiceEntry } from "../../hooks/useRewardVoiceForm";

type Props = {
  voices: VoiceEntry[];
  voiceId: string;
  setVoiceId: (value: string) => void;
  voicesLoading: boolean;
  lastVoiceLabel: string;
  isElevenKeyValid: boolean;
  voiceOpen: boolean;
  setVoiceOpen: (updater: (v: boolean) => boolean) => void;
  onOpen: () => void;
  saveLastVoiceLabel: (label: string) => void;
};

export const VoiceSelect = ({
  voices,
  voiceId,
  setVoiceId,
  voicesLoading,
  lastVoiceLabel,
  isElevenKeyValid,
  voiceOpen,
  setVoiceOpen,
  onOpen,
  saveLastVoiceLabel
}: Props) => {
  const { t } = useI18n();

  if (voicesLoading) {
    return (
      <div className="reward-voice-dropdown-wrap reward-voice-field-first">
        <div className="reward-voice-field-label">{t("rewardVoice.voiceLabel")}</div>
        <input
          id="rv-voice-id"
          type="text"
          value={lastVoiceLabel}
          placeholder={t("rewardVoice.chooseVoice")}
          className="field"
          disabled
          readOnly
        />
      </div>
    );
  }

  if (voices.length === 0) {
    return (
      <div className="reward-voice-dropdown-wrap reward-voice-field-first">
        <div className="reward-voice-field-label">{t("rewardVoice.voiceLabel")}</div>
        <input
          id="rv-voice-id"
          type="text"
          value={isElevenKeyValid ? voiceId : lastVoiceLabel}
          onChange={(e) => {
            if (isElevenKeyValid) setVoiceId(e.target.value);
          }}
          placeholder={t("rewardVoice.chooseVoice")}
          className="field"
          disabled={!isElevenKeyValid}
          readOnly={!isElevenKeyValid}
        />
      </div>
    );
  }

  return (
    <div className="reward-voice-dropdown-wrap reward-voice-field-first">
      <div className="reward-voice-field-label">{t("rewardVoice.voiceLabel")}</div>
      <button
        id="rv-voice-id"
        type="button"
        className="field reward-voice-dropdown-trigger"
        onClick={(e) => {
          if (!isElevenKeyValid) return;
          e.stopPropagation();
          setVoiceOpen((v) => !v);
          onOpen();
        }}
        aria-expanded={voiceOpen}
        aria-haspopup="listbox"
        aria-label={t("rewardVoice.chooseVoice")}
        disabled={!isElevenKeyValid}
      >
        {voices.find((v) => v.voice_id === voiceId)?.name ?? t("rewardVoice.chooseVoice")}
      </button>
      {voiceOpen && isElevenKeyValid && (
        <ul
          className="reward-voice-dropdown-list"
          role="listbox"
          aria-labelledby="rv-voice-id"
          onClick={(e) => e.stopPropagation()}
        >
          <li
            role="option"
            aria-selected={!voiceId}
            className="reward-voice-dropdown-option"
            onClick={() => {
              setVoiceId("");
              setVoiceOpen(() => false);
            }}
          >
            {t("rewardVoice.chooseVoice")}
          </li>
          {voices.map((v) => (
            <li
              key={v.voice_id}
              role="option"
              aria-selected={voiceId === v.voice_id}
              className="reward-voice-dropdown-option"
              onClick={() => {
                setVoiceId(v.voice_id);
                saveLastVoiceLabel(v.name);
                setVoiceOpen(() => false);
              }}
            >
              {v.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
