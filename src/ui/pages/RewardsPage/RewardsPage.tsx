import { useEffect, useState } from "react";
import { createCustomReward } from "../../../twitchApi";
import type { TwitchTokenResponse } from "../../../twitchAuth";
import { useI18n } from "../../context/I18nContext";
import { useTwitchRewards } from "../../context/TwitchRewardsContext";
import { useMissingRewardVoice } from "../../hooks/useMissingRewardVoice";
import { EmptyState } from "../../molecules/EmptyState";
import { RewardVoiceModal } from "../../organisms/RewardVoiceModal";
import { RewardItem } from "./RewardItem";
import { RewardsSplash } from "./RewardsSplash";

type Props = {
  token: TwitchTokenResponse;
  onMissingRewardVoiceChange?: (hasMissing: boolean) => void;
};

function readRootCssVar(name: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

export const RewardsPage = ({ token, onMissingRewardVoiceChange }: Props) => {
  const { t } = useI18n();
  const { loading, error, broadcasterId, rewards, setRewards } = useTwitchRewards();
  const [creating, setCreating] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [settingsRewardId, setSettingsRewardId] = useState<string | null>(null);

  const { map: rewardsMissingVoice, hasAny: hasMissing } = useMissingRewardVoice(
    rewards,
    settingsRewardId
  );

  useEffect(() => {
    onMissingRewardVoiceChange?.(hasMissing);
  }, [hasMissing, onMissingRewardVoiceChange]);

  const buildUniqueRewardTitle = (baseTitle: string): string => {
    const existingTitles = rewards.map((r) => r.title);
    if (!existingTitles.includes(baseTitle)) return baseTitle;
    let suffix = 1;
    while (suffix < 1000) {
      const candidate = `${baseTitle} (${suffix})`;
      if (!existingTitles.includes(candidate)) return candidate;
      suffix += 1;
    }
    return `${baseTitle} (${Date.now()})`;
  };

  const handleCreateReward = async () => {
    if (!broadcasterId) return;
    try {
      setCreating(true);
      setLocalError(null);

      const title = buildUniqueRewardTitle("Hi-TTS Reward");
      const reward = await createCustomReward(token.access_token, broadcasterId, {
        title,
        cost: 100,
        prompt: t("rewards.rewardPrompt"),
        is_enabled: true,
        is_user_input_required: true,
        background_color: readRootCssVar("--twitch-purple", "#9146ff"),
        is_global_cooldown_enabled: true,
        global_cooldown_seconds: 300,
        is_max_per_stream_enabled: true,
        max_per_stream: 50,
        is_max_per_user_per_stream_enabled: true,
        max_per_user_per_stream: 5,
        should_redemptions_skip_request_queue: true
      });

      if (!reward) {
        setLocalError(t("rewards.errorCreate"));
        return;
      }
      setRewards((prev) => [...prev, reward]);
    } catch {
      setLocalError(t("rewards.errorCreateShort"));
    } finally {
      setCreating(false);
    }
  };

  if (loading && !error) return <RewardsSplash />;

  return (
    <section className="card">
      {(error || localError) && (
        <p className="error-text">{localError ?? t("rewards.errorProfile")}</p>
      )}

      <div className="rewards-list-container">
        <button
          type="button"
          className="twitch-button rewards-create-btn"
          onClick={handleCreateReward}
          disabled={creating || !broadcasterId}
        >
          {creating ? t("rewards.creating") : t("rewards.createCta")}
        </button>

        {!creating && rewards.length === 0 && <EmptyState text={t("rewards.empty")} />}

        {rewards.map((reward) => (
          <RewardItem
            key={reward.id}
            reward={reward}
            missingVoice={!!rewardsMissingVoice[reward.id]}
            onOpenSettings={setSettingsRewardId}
          />
        ))}
      </div>

      {settingsRewardId &&
        (() => {
          const reward = rewards.find((r) => r.id === settingsRewardId);
          if (!reward) return null;
          return (
            <RewardVoiceModal
              rewardId={reward.id}
              rewardTitle={reward.title}
              onClose={() => setSettingsRewardId(null)}
            />
          );
        })()}
    </section>
  );
};
