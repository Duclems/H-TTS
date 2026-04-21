import { useCallback, useState } from "react";
import { Button } from "../atoms/Button";
import { ModalHeader } from "../molecules/ModalHeader";
import { useI18n } from "../context/I18nContext";
import { useEscapeToClose } from "../hooks/useEscapeToClose";
import { useRewardVoiceForm } from "../hooks/useRewardVoiceForm";
import { VoiceSelect } from "./RewardVoiceModal/VoiceSelect";
import { ModelSelect } from "./RewardVoiceModal/ModelSelect";
import { VoiceRangeSliders } from "./RewardVoiceModal/VoiceRangeSliders";
import { VoiceTestBlock } from "./RewardVoiceModal/VoiceTestBlock";

type Props = {
  rewardId: string;
  rewardTitle: string;
  onClose: () => void;
};

export const RewardVoiceModal = ({ rewardId, onClose }: Props) => {
  const { t } = useI18n();
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);

  useEscapeToClose(onClose);

  const renderQuotaErrorToast = useCallback(
    () => (
      <>
        {t("rewardVoice.errorEleven")}{" "}
        <a href="https://elevenlabs.io/app/voice-lab" target="_blank" rel="noreferrer">
          {t("rewardVoice.myVoicesLink")}
        </a>
        .
      </>
    ),
    [t]
  );

  const form = useRewardVoiceForm({
    rewardId,
    onSaved: onClose,
    renderQuotaErrorToast
  });

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reward-voice-modal-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="panel modal-content settings-modal-content reward-voice-modal"
        onClick={(e) => {
          e.stopPropagation();
          setVoiceOpen(false);
          setModelOpen(false);
        }}
      >
        <ModalHeader
          titleId="reward-voice-modal-title"
          title={t("rewardVoice.modalTitle")}
          onClose={onClose}
          closeAriaLabel={t("modal.close")}
        />

        <div className="reward-voice-modal-body">
          <div className="reward-voice-modal-fields">
            <VoiceSelect
              voices={form.voices}
              voiceId={form.voiceId}
              setVoiceId={form.setVoiceId}
              voicesLoading={form.voicesLoading}
              lastVoiceLabel={form.lastVoiceLabel}
              isElevenKeyValid={form.isElevenKeyValid}
              voiceOpen={voiceOpen}
              setVoiceOpen={setVoiceOpen}
              onOpen={() => setModelOpen(false)}
              saveLastVoiceLabel={form.saveLastVoiceLabel}
            />

            <ModelSelect
              modelId={form.modelId}
              setModelId={form.setModelId}
              modelOpen={modelOpen}
              setModelOpen={setModelOpen}
              onOpen={() => setVoiceOpen(false)}
            />

            <VoiceRangeSliders
              speed={form.speed}
              setSpeed={form.setSpeed}
              stability={form.stability}
              setStability={form.setStability}
              similarityBoost={form.similarityBoost}
              setSimilarityBoost={form.setSimilarityBoost}
              style={form.style}
              setStyle={form.setStyle}
            />

            <VoiceTestBlock
              testText={form.testText}
              setTestText={form.setTestText}
              onTest={() => void form.handleTest()}
              disabled={!form.voiceId.trim()}
            />
          </div>
        </div>

        <div className="reward-voice-modal-footer">
          <Button variant="primary" onClick={() => void form.handleSave()}>
            {t("rewardVoice.save")}
          </Button>
        </div>
      </div>
    </div>
  );
};
