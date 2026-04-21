import { Button } from "../../atoms/Button";
import { useI18n } from "../../context/I18nContext";

type Props = {
  testText: string;
  setTestText: (value: string) => void;
  onTest: () => void;
  disabled: boolean;
};

export const VoiceTestBlock = ({ testText, setTestText, onTest, disabled }: Props) => {
  const { t } = useI18n();

  return (
    <div>
      <label htmlFor="rv-test" className="reward-voice-field-label">
        {t("rewardVoice.testLabel")}
      </label>
      <input
        id="rv-test"
        type="text"
        value={testText}
        onChange={(e) => setTestText(e.target.value)}
        placeholder={t("rewardVoice.testPlaceholder")}
        className="field reward-voice-input"
      />
      <Button
        variant="primary"
        className="reward-voice-test-btn"
        onClick={onTest}
        disabled={disabled}
      >
        {t("rewardVoice.testButton")}
      </Button>
    </div>
  );
};
