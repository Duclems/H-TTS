import { useEffect, useState } from "react";
import type { TwitchTokenResponse } from "../../../twitchAuth";
import {
  fetchCurrentUser,
  fetchCustomRewards,
  fetchRewardRedemptions,
  type TwitchCustomReward,
  type TwitchRewardRedemption,
  createCustomReward,
  getLastCreatedRewardId,
  clearLastCreatedRewardId
} from "../../../twitchApi";
import { speakWithElevenLabsFromText } from "../../../elevenLabsApi";

type Props = {
  token: TwitchTokenResponse;
};

export const RewardsCard = ({ token }: Props) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [broadcasterId, setBroadcasterId] = useState<string | null>(null);
  const [rewards, setRewards] = useState<TwitchCustomReward[]>([]);
  const [redemptions, setRedemptions] = useState<TwitchRewardRedemption[]>([]);
  const [lastRewardId, setLastRewardId] = useState<string | null>(getLastCreatedRewardId());

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        setLoading(true);
        setError(null);

        const user = await fetchCurrentUser(token.access_token);
        if (!user) {
          setError("Impossible de récupérer ton profil Twitch (vérifie les scopes).");
          return;
        }

        setBroadcasterId(user.id);

        const rewardsData = await fetchCustomRewards(token.access_token, user.id);
        if (cancelled) return;

        // Tant qu'aucun reward H-TTS n'est suivi, on ne montre pas les autres rewards
        if (!lastRewardId) {
          setRewards([]);
          setRedemptions([]);
          return;
        }

        // Si on a un ID de reward créé via l'app, on ne charge que celui-là
        const match = rewardsData.filter((r) => r.id === lastRewardId);
        const effectiveRewards = match.length > 0 ? match : [];

        setRewards(effectiveRewards);

        if (effectiveRewards.length === 0) {
          setRedemptions([]);

          // Si on suivait un reward qui n'existe plus, on réinitialise pour reproposer la création
          clearLastCreatedRewardId();
          setLastRewardId(null);
          return;
        }

        // On ne charge les redemptions que pour le reward suivi
        const allRedemptions: TwitchRewardRedemption[] = [];
        for (const reward of effectiveRewards) {
          const r = await fetchRewardRedemptions(token.access_token, user.id, reward.id);
          if (cancelled) return;
          allRedemptions.push(...r);
        }

        setRedemptions(allRedemptions);
      } catch (e) {
        setError("Erreur lors de la récupération des rewards/redemptions.");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [token.access_token, lastRewardId]);

  // Rafraîchissement périodique du reward suivi et de ses redemptions
  useEffect(() => {
    if (!broadcasterId || !lastRewardId) return;

    let cancelled = false;
    const intervalId = window.setInterval(async () => {
      try {
        const rewardsData = await fetchCustomRewards(token.access_token, broadcasterId);
        if (cancelled) return;

        const match = rewardsData.filter((r) => r.id === lastRewardId);
        const effectiveRewards = match.length > 0 ? match : [];
        setRewards(effectiveRewards);

        if (effectiveRewards.length === 0) {
          setRedemptions([]);

          // Reward supprimé côté Twitch → on efface l'ID suivi pour pouvoir le recréer
          clearLastCreatedRewardId();
          setLastRewardId(null);
          return;
        }

        const allRedemptions: TwitchRewardRedemption[] = [];
        for (const reward of effectiveRewards) {
          const r = await fetchRewardRedemptions(token.access_token, broadcasterId, reward.id);
          if (cancelled) return;
          allRedemptions.push(...r);
        }
        setRedemptions(allRedemptions);
      } catch {
        // on garde les anciennes valeurs en cas d'erreur temporaire
      }
    }, 2000); // toutes les 3 secondes pour suivre les redeems de près

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [token.access_token, broadcasterId, lastRewardId]);

  // Lecture audio via ElevenLabs des nouvelles redemptions (fenêtre de 10 secondes)
  useEffect(() => {
    if (redemptions.length === 0) return;

    const PROCESSED_KEY = "h_tts_eleven_processed_redemptions";
    const raw = localStorage.getItem(PROCESSED_KEY);
    const processed = new Set<string>(raw ? (JSON.parse(raw) as string[]) : []);

    const now = Date.now();
    const newlyProcessed: string[] = [];

    for (const redemption of redemptions) {
      if (processed.has(redemption.id)) continue;
      if (!redemption.user_input || !redemption.user_input.trim()) continue;

      const redeemedAt = new Date(redemption.redeemed_at).getTime();
      if (Number.isNaN(redeemedAt)) continue;

      // On ne déclenche que pour les redemptions apparues dans les 10 dernières secondes
      if (now - redeemedAt <= 10_000) {
        // eslint-disable-next-line no-console
        console.log("[H-TTS] Nouvelle redemption à lire via ElevenLabs", {
          id: redemption.id,
          user: redemption.user_display_name || redemption.user_login,
          text: redemption.user_input
        });
        void speakWithElevenLabsFromText(redemption.user_input);
      }

      processed.add(redemption.id);
      newlyProcessed.push(redemption.id);
    }

    if (newlyProcessed.length > 0) {
      localStorage.setItem(PROCESSED_KEY, JSON.stringify(Array.from(processed)));
    }
  }, [redemptions]);

  const handleCreateReward = async () => {
    if (!broadcasterId) return;

    try {
      setCreating(true);
      setError(null);

      const reward = await createCustomReward(token.access_token, broadcasterId, {
        title: "H-TTS Reward",
        cost: 100,
        prompt: "Reward générée par l'app H-TTS (exemple).",
        is_enabled: true,
        is_user_input_required: true,
        background_color: "#9146FF",
        is_global_cooldown_enabled: true,
        global_cooldown_seconds: 300, // 5 minutes
        is_max_per_stream_enabled: true,
        max_per_stream: 50,
        is_max_per_user_per_stream_enabled: true,
        max_per_user_per_stream: 5,
        should_redemptions_skip_request_queue: true
      });

      if (!reward) {
        setError(
          "Impossible de créer le reward. Vérifie les scopes, que tu es bien le propriétaire de la chaîne et que les points de chaîne / custom rewards sont activés (et que ta chaîne est éligible)."
        );
        return;
      }

      setLastRewardId(reward.id);

      // On ne garde que le reward créé via l'app
      setRewards([reward]);

      // Et on ne charge les redemptions que pour ce reward
      const r = await fetchRewardRedemptions(token.access_token, broadcasterId, reward.id);
      setRedemptions(r);
    } catch {
      setError("Erreur lors de la création du reward.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <section className="card">
      <div className="card-title">Channel Points (Rewards / Redemptions)</div>
      <p className="card-text">
        Nécessite les scopes <code>channel:read:redemptions</code> (et éventuellement{" "}
        <code>channel:manage:redemptions</code> si tu veux les modifier côté API).
        <br />
        <small>
          Les redeems sont rafraîchis toutes les{" "}
          <strong>2 secondes</strong> et chaque redeem peut déclencher un TTS pendant{" "}
          <strong>10 secondes</strong> après son apparition.
        </small>
      </p>

      {loading && <p className="card-text">Chargement des rewards…</p>}
      {error && <p className="error-text">{error}</p>}

      {!loading && !error && (
        <>
          {!lastRewardId && (
            <button
              type="button"
              className="twitch-button"
              style={{ marginBottom: "0.8rem" }}
              onClick={handleCreateReward}
              disabled={creating || !broadcasterId}
            >
              {creating ? "Création du reward…" : "Créer un reward H-TTS"}
            </button>
          )}

          {lastRewardId && (
            <p className="card-text">
              <small>
                Reward H-TTS suivi (id stocké en local) : <code>{lastRewardId}</code>
              </small>
            </p>
          )}

          {rewards.length > 0 && (
            <>
              {rewards.map((reward) => {
                const img =
                  reward.image?.url_2x ?? reward.default_image?.url_2x ?? reward.default_image?.url_1x;
                return (
                  <div
                    key={reward.id}
                    style={{
                      marginTop: "0.75rem",
                      padding: "0.7rem 0.8rem",
                      borderRadius: "0.9rem",
                      background:
                        "linear-gradient(135deg, rgba(15,15,30,0.95), rgba(15,15,35,0.9))",
                      border: "1px solid rgba(255,255,255,0.05)"
                    }}
                  >
                    <div style={{ display: "flex", gap: "0.6rem", alignItems: "center" }}>
                      <div
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 12,
                          backgroundColor: reward.background_color || "#18181b",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          overflow: "hidden"
                        }}
                      >
                        {img && (
                          <img
                            src={img}
                            alt={reward.title}
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          />
                        )}
                      </div>
                      <div>
                        <div style={{ fontSize: "0.9rem", fontWeight: 600 }}>{reward.title}</div>
                        <div style={{ fontSize: "0.8rem", opacity: 0.85 }}>
                          {reward.cost} points de chaîne
                        </div>
                      </div>
                    </div>

                    {reward.prompt && (
                      <p className="card-text" style={{ marginTop: "0.4rem" }}>
                        {reward.prompt}
                      </p>
                    )}
                  </div>
                );
              })}
            </>
          )}

          {redemptions.length > 0 && (
            <>
              <p className="card-text" style={{ marginTop: "0.75rem" }}>
                <strong>Historique des redemptions (UNFULFILLED) :</strong>
              </p>
              <ul className="rewards-list">
                {redemptions.map((r) => (
                  <li key={r.id}>
                    <strong>{r.user_display_name || r.user_login}</strong> —{" "}
                    {new Date(r.redeemed_at).toLocaleDateString()}{" "}
                    {new Date(r.redeemed_at).toLocaleTimeString()}{" "}
                    {r.user_input ? `: "${r.user_input}"` : ""}
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </section>
  );
};

