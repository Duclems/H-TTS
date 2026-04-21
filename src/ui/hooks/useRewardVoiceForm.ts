import { type ReactNode, useCallback, useEffect, useState } from "react";
import {
  loadRewardVoiceConfig,
  saveRewardVoiceConfig,
  getDefaultRewardVoiceConfig,
  type RewardVoiceConfig
} from "../../rewardVoiceConfig";
import { speakWithElevenLabsFromText, fetchElevenVoices, fetchElevenUser } from "../../elevenLabsApi";
import { STORAGE_KEY_REWARD_VOICE_LABELS as VOICE_LABEL_CACHE_KEY } from "../../storageKeys";
import { useToast } from "../context/ToastContext";
import { useI18n } from "../context/I18nContext";

export type VoiceEntry = { voice_id: string; name: string };

type Options = {
  rewardId: string;
  onSaved: () => void;
  renderQuotaErrorToast: () => ReactNode;
};

export function useRewardVoiceForm({ rewardId, onSaved, renderQuotaErrorToast }: Options) {
  const { addToast } = useToast();
  const { t } = useI18n();

  const [voiceId, setVoiceId] = useState("");
  const [voices, setVoices] = useState<VoiceEntry[]>([]);
  const [modelId, setModelId] = useState("eleven_turbo_v2_5");
  const [stability, setStability] = useState(0.5);
  const [similarityBoost, setSimilarityBoost] = useState(0.75);
  const [style, setStyle] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [testText, setTestText] = useState("");
  const [isElevenKeyValid, setIsElevenKeyValid] = useState(true);
  const [voicesLoading, setVoicesLoading] = useState(true);
  const [lastVoiceLabel, setLastVoiceLabel] = useState("");

  const saveLastVoiceLabel = useCallback(
    (label: string) => {
      setLastVoiceLabel(label);
      try {
        const raw = localStorage.getItem(VOICE_LABEL_CACHE_KEY);
        const map = raw ? (JSON.parse(raw) as Record<string, string>) : {};
        map[rewardId] = label;
        localStorage.setItem(VOICE_LABEL_CACHE_KEY, JSON.stringify(map));
      } catch {
        /* ignore */
      }
    },
    [rewardId]
  );

  useEffect(() => {
    let initialVoiceId = "";
    const existing = loadRewardVoiceConfig(rewardId);
    if (existing) {
      initialVoiceId = existing.voiceId;
      setVoiceId(existing.voiceId);
      setModelId(existing.modelId);
      setStability(existing.stability);
      setSimilarityBoost(existing.similarityBoost);
      setStyle(existing.style);
      setSpeed(existing.speed);
    } else {
      const def = getDefaultRewardVoiceConfig();
      initialVoiceId = def.voiceId;
      setVoiceId(def.voiceId);
      setModelId(def.modelId);
      setStability(def.stability);
      setSimilarityBoost(def.similarityBoost);
      setStyle(def.style);
      setSpeed(def.speed);
    }

    try {
      const raw = localStorage.getItem(VOICE_LABEL_CACHE_KEY);
      const map = raw ? (JSON.parse(raw) as Record<string, string>) : {};
      if (typeof map[rewardId] === "string") {
        setLastVoiceLabel(map[rewardId]);
      }
    } catch {
      /* ignore */
    }

    void (async () => {
      setVoicesLoading(true);
      const user = await fetchElevenUser();
      setIsElevenKeyValid(!!user);

      const list = await fetchElevenVoices();
      const sorted = [...list].sort((a, b) => a.name.localeCompare(b.name, "fr-FR"));
      setVoices(sorted);
      if (initialVoiceId) {
        const matched = sorted.find((v) => v.voice_id === initialVoiceId);
        if (matched?.name) {
          saveLastVoiceLabel(matched.name);
        }
      }
      setVoicesLoading(false);
    })();
  }, [rewardId, saveLastVoiceLabel]);

  const getConfig = useCallback(
    (): RewardVoiceConfig => ({
      voiceId: voiceId.trim(),
      modelId,
      stability,
      similarityBoost,
      style,
      speed
    }),
    [voiceId, modelId, stability, similarityBoost, style, speed]
  );

  const handleSave = useCallback(async () => {
    const cfg = getConfig();

    if (!cfg.voiceId) {
      saveRewardVoiceConfig(rewardId, cfg);
      addToast(t("rewardVoice.saved"));
      onSaved();
      return;
    }

    const result = await speakWithElevenLabsFromText(t("rewardVoice.saved"), cfg);
    if (!result.httpOk && result.status === 402) {
      addToast(renderQuotaErrorToast(), "danger", 8000);
      return;
    }

    saveRewardVoiceConfig(rewardId, cfg);
    addToast(t("rewardVoice.saved"));
    onSaved();
  }, [getConfig, rewardId, addToast, t, onSaved, renderQuotaErrorToast]);

  const handleTest = useCallback(async () => {
    const cfg = getConfig();
    if (!cfg.voiceId) return;
    const result = await speakWithElevenLabsFromText(
      testText.trim() || t("rewardVoice.testPhrase"),
      cfg
    );
    if (!result.httpOk && result.status === 402) {
      addToast(renderQuotaErrorToast(), "danger", 8000);
    }
  }, [getConfig, testText, t, addToast, renderQuotaErrorToast]);

  return {
    voiceId,
    setVoiceId,
    voices,
    modelId,
    setModelId,
    stability,
    setStability,
    similarityBoost,
    setSimilarityBoost,
    style,
    setStyle,
    speed,
    setSpeed,
    testText,
    setTestText,
    isElevenKeyValid,
    voicesLoading,
    lastVoiceLabel,
    saveLastVoiceLabel,
    handleSave,
    handleTest
  };
}
