import { TwitchLoginCard } from "./pages/HomePage/TwitchLoginCard";
import { AuthenticatedTokenCard } from "./pages/HomePage/AuthenticatedTokenCard";
import { RewardsCard } from "./pages/HomePage/RewardsCard";
import { ElevenLabsCard } from "./pages/HomePage/ElevenLabsCard";
import { ElevenLabsVoiceCard } from "./pages/HomePage/ElevenLabsVoiceCard";
import { getStoredToken } from "../twitchAuth";

export const App = () => {
  const token = getStoredToken();

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-icon">H</div>
        <div>
          <div className="app-title">H-TTS · Twitch Desktop</div>
          <div className="app-subtitle">
            Connexion à Twitch via OAuth2 (client-side uniquement).
          </div>
        </div>
      </header>

      {!token && <TwitchLoginCard />}
      {token && (
        <>
          <AuthenticatedTokenCard token={token} />
          <RewardsCard token={token} />
          <ElevenLabsCard />
          <ElevenLabsVoiceCard />
        </>
      )}
    </div>
  );
};

