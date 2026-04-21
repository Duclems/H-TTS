import { createContext, useContext, type ReactNode } from "react";
import type { TwitchTokenResponse } from "../../twitchAuth";
import { useTwitchRewardsState } from "../hooks/useTwitchRewardsState";

type Value = ReturnType<typeof useTwitchRewardsState>;

const Ctx = createContext<Value | null>(null);

type ProviderProps = {
  token: TwitchTokenResponse;
  children: ReactNode;
};

export const TwitchRewardsProvider = ({ token, children }: ProviderProps) => {
  const state = useTwitchRewardsState(token);
  return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
};

export function useTwitchRewards(): Value {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTwitchRewards must be used within a TwitchRewardsProvider");
  return ctx;
}
