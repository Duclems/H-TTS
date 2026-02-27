import { ElevenLabsCard } from "../HomePage/ElevenLabsCard";
import { ElevenLabsVoiceCard } from "../HomePage/ElevenLabsVoiceCard";
import { Link } from "react-router-dom";
import { ThemeToggle } from "../../ThemeToggle";

export const ElevenLabsSettingsPage = () => {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-main">
          <div className="app-title">Paramètres · ElevenLabs</div>
          <div className="app-subtitle">
            Configuration des clés API et des voix utilisées pour le TTS.
          </div>
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
        <ThemeToggle />
      </header>

      <ElevenLabsCard />
      <ElevenLabsVoiceCard />
    </div>
  );
};


