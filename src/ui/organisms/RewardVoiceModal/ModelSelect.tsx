import { MODEL_OPTIONS } from "../../../rewardVoiceConfig";
import { useI18n } from "../../context/I18nContext";

type Props = {
  modelId: string;
  setModelId: (value: string) => void;
  modelOpen: boolean;
  setModelOpen: (updater: (v: boolean) => boolean) => void;
  onOpen: () => void;
};

export const ModelSelect = ({ modelId, setModelId, modelOpen, setModelOpen, onOpen }: Props) => {
  const { t } = useI18n();

  return (
    <div className="reward-voice-dropdown-wrap">
      <div className="reward-voice-field-label">{t("rewardVoice.modelLabel")}</div>
      <button
        id="rv-model"
        type="button"
        className="field reward-voice-dropdown-trigger"
        onClick={(e) => {
          e.stopPropagation();
          setModelOpen((v) => !v);
          onOpen();
        }}
        aria-expanded={modelOpen}
        aria-haspopup="listbox"
        aria-label={t("rewardVoice.chooseModel")}
      >
        {MODEL_OPTIONS.find((m) => m.id === modelId)?.label ?? modelId}
      </button>
      {modelOpen && (
        <ul
          className="reward-voice-dropdown-list"
          role="listbox"
          aria-labelledby="rv-model"
          onClick={(e) => e.stopPropagation()}
        >
          {MODEL_OPTIONS.map((m) => (
            <li
              key={m.id}
              role="option"
              aria-selected={modelId === m.id}
              className="reward-voice-dropdown-option"
              onClick={() => {
                setModelId(m.id);
                setModelOpen(() => false);
              }}
            >
              {m.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
