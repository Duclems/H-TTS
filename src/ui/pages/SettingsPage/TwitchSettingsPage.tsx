import { Link } from "react-router-dom";
import { TwitchLoginCard } from "../HomePage/TwitchLoginCard";
import { AuthenticatedTokenCard } from "../HomePage/AuthenticatedTokenCard";
import { getStoredToken } from "../../../twitchAuth";
export const TwitchSettingsPage = () => {
  const token = getStoredToken();

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-main">
          <div className="app-title">Paramètres · Twitch</div>
          <div className="app-subtitle">Connexion OAuth2 à Twitch et informations de session.</div>
          <nav className="app-header-nav">
            <Link to="/">
              <button type="button" className="nav-button">
                Accueil
              </button>
            </Link>
            <Link to="/twitch">
              <button type="button" className="nav-button">
                Twitch
              </button>
            </Link>
            <Link to="/settings/elevenlabs">
              <button type="button" className="nav-button">
                ElevenLabs
              </button>
            </Link>
          </nav>
        </div>
      </header>

      {!token && <TwitchLoginCard />}
      {token && <AuthenticatedTokenCard token={token} />}
    </div>
  );
};

