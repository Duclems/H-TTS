## Hi-TTS · Client desktop React (Vite) avec OAuth2 Twitch

Cette app est un client React (Vite) structuré en **Atomik React** qui permet de :

- **Se connecter à Twitch via OAuth2 (Implicit Grant)** en utilisant **uniquement le `client_id`**.
- **Stocker le token côté client** (localStorage) pour une utilisation ultérieure par ton appli desktop (Electron, Tauri, etc.).

### 1. Installation et lancement (version desktop Electron)

- **Installer les dépendances**

```bash
npm install
```

- **Lancer l’app desktop en dev (Electron + Vite)**

```bash
npm run dev
```

Cela va :

- démarrer le serveur Vite sur `http://localhost:55510`,
- ouvrir une fenêtre **Electron** qui charge cette URL.

### 2. Configuration des variables d’environnement

Copie le fichier `.env.example` en `.env` :

```bash
cp .env.example .env
```

Puis remplis :

- **`VITE_TWITCH_CLIENT_ID`** : ton client id Twitch (obtenu depuis le portail développeur, configuré en **Client Type: Public** pour autoriser le Device Code Flow).
- **`VITE_TWITCH_SCOPES`** : scopes Twitch requis, par ex. :
  - `user:read:email`
  - `channel:read:redemptions`
  - `channel:manage:redemptions`

Référence Twitch : [Docs Authentication](https://dev.twitch.tv/docs/authentication/).

### 3. Flow OAuth2 utilisé (Device Code Flow)

Hi-TTS utilise le **Device Code Flow** de Twitch ([doc officielle](https://dev.twitch.tv/docs/authentication/getting-tokens-oauth/#device-code-grant-flow)), conçu pour les applications desktop sans backend. Il remplace l'ancien Implicit Grant (déprécié OAuth 2.1) et apporte un **refresh token** (rolling, ~30 jours) pour éviter de se reconnecter toutes les 4 h.

Déroulé :

1. Le processus **main** Electron appelle `POST https://id.twitch.tv/oauth2/device` avec `client_id` + `scopes`.
2. Twitch renvoie `device_code`, `user_code` et `verification_uri` (contient déjà `user_code` en query string).
3. L'app affiche `user_code` dans la fenêtre et ouvre `verification_uri` dans le **navigateur système** (via `shell.openExternal`). Twitch n'est donc jamais chargé dans la fenêtre Electron qui expose le preload.
4. Le main process poll `POST https://id.twitch.tv/oauth2/token` avec `grant_type=urn:ietf:params:oauth:grant-type:device_code` jusqu'à ce que l'utilisateur valide.
5. Une fois le token obtenu, il est persisté via `safeStorage` (`electron/secureStorage.cjs`). Le `device_code` lui ne sort jamais du main process.
6. Le refresh est automatique : `App.tsx` programme un timer 5 min avant expiration, et le boot effectue un refresh silencieux si le token stocké est proche de sa deadline. Un échec de refresh purge le token et renvoie sur la page de connexion.

Bridge IPC (renderer ↔ main) exposé via `contextBridge` dans `electron/preload.cjs` sous `window.hiTtsTwitchOAuth`.

Durcissement de navigation dans `electron/navigationGuard.cjs` :

- `will-navigate` / `will-redirect` : tout ce qui n'est pas `http://localhost:55510` est bloqué. Les URLs web légitimes sont redirigées vers le navigateur système, les schemes non-web sont drop.
- `setWindowOpenHandler` : idem, `deny` par défaut.
- `will-attach-webview` : webviews désactivées.
- Permissions navigateur (micro, géoloc, notifications…) : deny global.

### 4. Structure Atomik React

Organisation simplifiée (**Atomik/Atomic Design**) :

```text
src/
  config.ts                -> Lecture des variables d'env (client_id, scopes)
  twitchAuth.ts            -> Bridge Device Code Flow + refresh + stockage token chiffré
  styles/                  -> Entrée CSS unique `styles/index.css`
    base.css               -> Reset, variables, police Figtree, keyframes globaux
    atoms.css              -> Styles des composants de base (boutons, champs, pills, chips, toasts…)
    molecules.css          -> Compositions simples (headers de modals, dropdowns, sliders…)
    organisms.css          -> Blocs complets (cartes, listes de rewards, blocs ElevenLabs…)
    templates.css          -> Layout app-shell (header, main, footer, onglets)

  ui/
    App.tsx                -> Shell principal (header historique/rewards, corps, footer, modals)

    atoms/                 -> Petits composants réutilisables (Button, Input, Label, Chip, Avatar, Skeleton, Toast…)
    molecules/             -> Combinaisons d'atoms (FormField, TokenChipRow, ModalHeader, ToastItem…)
    organisms/             -> Blocs fonctionnels complets :
                               - TwitchLoginCard, AuthenticatedTokenCard
                               - RewardsCard (unique pour rewards + historique)
                               - SettingsModal, TwitchSessionModal, AboutModal
                               - ElevenLabsCard, RewardVoiceModal
    pages/
      LoginPage/                   -> UI Device Code Flow (user_code + ouverture navigateur)
      HistoryPage/                 -> Historique des redemptions Hi-TTS
      RewardsPage/                 -> Gestion des Custom Rewards
```

L'application tourne dans une fenêtre **Electron** (`electron/main.cjs`) qui charge le build Vite et expose une icône de tray pour tourner en arrière-plan.

### 5. Accès aux Channel Points (rewards / redemptions)

- L’app récupère :
  - ton **profil utilisateur** (`/helix/users`),
  - la liste des **Custom Rewards** (`/helix/channel_points/custom_rewards`),
  - les **redemptions UNFULFILLED** pour chaque reward (`/helix/channel_points/custom_rewards/redemptions`).

- Tout cela se fait côté client avec le token OAuth2 obtenu via le Device Code Flow (voir [Authentication | Twitch Developers](https://dev.twitch.tv/docs/authentication/)).

- Attention : pour que les endpoints Channel Points fonctionnent (pas de 403), il faut :
  - que ta chaîne ait les **points de chaîne activés** (généralement affilié/partner),
  - que tu sois **le broadcaster** (même compte que la chaîne),
  - que les scopes `channel:read:redemptions` et `channel:manage:redemptions` soient bien accordés.

### 5. Intégration desktop

Pour en faire une **vraie app desktop** :

- Tu peux emballer cette app Vite/React dans :
  - **Electron**, ou
  - **Tauri**, ou
  - tout autre shell desktop qui ouvre l’UI dans une WebView.

Dans ce cas :

- Tu peux continuer à utiliser **le flow implicit** côté client (sans secret).
- Ou bien migrer vers un **flow Authorization Code + PKCE** si tu ajoutes un backend ou que tu veux gérer des refresh tokens plus proprement.

### 6. Sécurité

- Le **`client_id`** n’est pas secret, il peut être exposé dans le front.
- Ne mets **jamais** de **client secret** dans `.env` côté front.
- Le token est stocké dans `localStorage` pour simplicité de démo ; pour une vraie app en prod, réfléchis aux risques (XSS, etc.) et éventuellement déplace la logique sensible côté backend.


