import type { TwitchCustomReward } from "../../../twitchApi";
import { useI18n } from "../../context/I18nContext";

type Props = {
  reward: TwitchCustomReward;
  missingVoice: boolean;
  onOpenSettings: (rewardId: string) => void;
};

export const RewardItem = ({ reward, missingVoice, onOpenSettings }: Props) => {
  const { t } = useI18n();
  const img =
    reward.image?.url_2x ?? reward.default_image?.url_2x ?? reward.default_image?.url_1x;

  return (
    <div className="panel">
      <div className="rewards-reward-item-header">
        <div
          className="rewards-reward-swatch"
          style={
            reward.background_color ? { backgroundColor: reward.background_color } : undefined
          }
        >
          {img && <img src={img} alt={reward.title} />}
        </div>
        <div className="rewards-reward-info">
          <div className="rewards-reward-title">{reward.title}</div>
          <div className="rewards-reward-cost">
            {reward.cost} {t("rewards.points")}
          </div>
        </div>
        <button
          type="button"
          className={
            missingVoice
              ? "twitch-button twitch-button-voice-error rewards-reward-settings-btn"
              : "twitch-button rewards-reward-settings-btn"
          }
          onClick={() => onOpenSettings(reward.id)}
        >
          {t("rewards.settings")}
        </button>
      </div>

      {reward.prompt && <p className="card-text rewards-reward-prompt">{reward.prompt}</p>}
    </div>
  );
};
