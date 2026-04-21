import type { TwitchRewardRedemption } from "../../../twitchApi";
import type { ParsedEmote } from "../../../twitchChat";
import type { EmoteMatch } from "../../hooks/useTwitchRewardsState";

type Props = {
  redemption: TwitchRewardRedemption;
  emoteMatch: EmoteMatch;
  avatarUrl: string | null;
};

function renderMessageWithEmotes(text: string, emotes: ParsedEmote[]) {
  if (!text || emotes.length === 0) return text;

  const segments: React.ReactNode[] = [];
  let cursor = 0;

  const sorted = [...emotes]
    .flatMap((e) => e.positions.map((p) => ({ emote: e, start: p.start, end: p.end })))
    .sort((a, b) => a.start - b.start);

  sorted.forEach(({ emote, start, end }, index) => {
    if (start > cursor) segments.push(text.slice(cursor, start));
    const key = `${emote.id}-${index}-${start}`;
    segments.push(
      <img
        key={key}
        src={emote.urls["2x"]}
        alt={emote.code}
        title={emote.code}
        className="rewards-emote-inline"
      />
    );
    cursor = end + 1;
  });

  if (cursor < text.length) segments.push(text.slice(cursor));
  return segments;
}

export const RedemptionItem = ({ redemption, emoteMatch, avatarUrl }: Props) => {
  const date = new Date(redemption.redeemed_at);
  const user = redemption.user_display_name || redemption.user_login;
  const initial = user.charAt(0).toUpperCase();

  return (
    <div className="panel rewards-history-item">
      <div className="rewards-history-item-main">
        <div className="rewards-history-avatar">
          {avatarUrl ? <img src={avatarUrl} alt={user} /> : <span>{initial}</span>}
        </div>
        <div className="rewards-history-text">
          <div className="rewards-history-title">
            {user} a {redemption.reward.title}
          </div>
          <div className="rewards-history-meta">
            {date.toLocaleDateString()} {date.toLocaleTimeString()}
          </div>
        </div>
      </div>
      {redemption.user_input && (
        <p className="rewards-history-message">
          {renderMessageWithEmotes(
            emoteMatch.chatText ?? redemption.user_input,
            emoteMatch.emotes
          )}
        </p>
      )}
    </div>
  );
};
