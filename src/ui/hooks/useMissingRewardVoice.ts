import { useEffect, useState } from "react";
import type { TwitchCustomReward } from "../../twitchApi";
import { loadAllRewardVoiceConfigs } from "../../rewardVoiceConfig";

export function useMissingRewardVoice(
  rewards: TwitchCustomReward[],
  settingsRewardId: string | null
): { map: Record<string, boolean>; hasAny: boolean } {
  const [map, setMap] = useState<Record<string, boolean>>({});
  const [hasAny, setHasAny] = useState(false);

  useEffect(() => {
    if (rewards.length === 0) {
      setMap({});
      setHasAny(false);
      return;
    }
    const all = loadAllRewardVoiceConfigs();
    const next: Record<string, boolean> = {};
    for (const reward of rewards) {
      const cfg = all[reward.id];
      next[reward.id] = !cfg || !cfg.voiceId || !cfg.voiceId.trim();
    }
    setMap(next);
    setHasAny(Object.values(next).some(Boolean));
  }, [rewards, settingsRewardId]);

  return { map, hasAny };
}
