import { Link } from "react-router-dom";
import { TwitchLoginCard } from "../../organisms/TwitchLoginCard";
import { AuthenticatedTokenCard } from "../../organisms/AuthenticatedTokenCard";
import { ElevenLabsCard } from "../../organisms/ElevenLabsCard";
import { getStoredToken } from "../../../twitchAuth";

export const ConnexionPage = () => {
  const token = getStoredToken();

  return (
    <div className="app-shell">
      <header className="app-header">
        <nav className="app-header-nav">
          <Link to="/">
            <button type="button" className="nav-button">
              Accueil
            </button>
          </Link>
        </nav>
        <Link to="/connexion" className="header-settings-btn header-settings-btn-active" title="Paramètres" aria-label="Paramètres">
          ⚙
        </Link>
      </header>

      {!token && <TwitchLoginCard />}
      {token && <AuthenticatedTokenCard token={token} />}
      <ElevenLabsCard />
    </div>
  );
};
