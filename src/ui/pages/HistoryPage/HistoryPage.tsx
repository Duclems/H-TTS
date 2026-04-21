import { useI18n } from "../../context/I18nContext";
import { useTwitchRewards } from "../../context/TwitchRewardsContext";
import {
  computeEmoteMatch,
  type EmoteMatch
} from "../../hooks/useTwitchRewardsState";
import { EmptyState } from "../../molecules/EmptyState";
import { RewardsSplash } from "../RewardsPage/RewardsSplash";
import { RedemptionItem } from "./RedemptionItem";

export const HistoryPage = () => {
  const { t } = useI18n();
  const {
    loading,
    error,
    visibleRedemptions,
    userAvatars,
    emoteMatches,
    chatMessagesRef
  } = useTwitchRewards();

  if (loading && !error) return <RewardsSplash />;
  if (error) return <p className="error-text">{t(`rewards.errorProfile`)}</p>;

  if (visibleRedemptions.length === 0) {
    return (
      <section className="card">
        <div className="rewards-history-container">
          <EmptyState text={t("rewards.historyEmpty")} variant="history" logoFaded />
        </div>
      </section>
    );
  }

  const resolveEmoteMatch = (id: string, redemption: Parameters<typeof computeEmoteMatch>[0]): EmoteMatch => {
    const cached = emoteMatches[id];
    if (cached) return cached;
    return computeEmoteMatch(redemption, chatMessagesRef.current);
  };

  return (
    <section className="card">
      <div className="rewards-history-container">
        {visibleRedemptions.map((r) => {
          const loginKey = r.user_login.toLowerCase();
          return (
            <RedemptionItem
              key={r.id}
              redemption={r}
              avatarUrl={userAvatars[loginKey] ?? null}
              emoteMatch={resolveEmoteMatch(r.id, r)}
            />
          );
        })}
      </div>
    </section>
  );
};
