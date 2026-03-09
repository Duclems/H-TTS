## HI-TTS · Client desktop React (Vite) avec OAuth2 Twitch

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

- démarrer le serveur Vite sur `http://localhost:5173`,
- ouvrir une fenêtre **Electron** qui charge cette URL.

### 2. Configuration des variables d’environnement

Copie le fichier `.env.example` en `.env` :

```bash
cp .env.example .env
```

Puis remplis :

- **`VITE_TWITCH_CLIENT_ID`** : ton client id Twitch (obtenu depuis le portail développeur).
- **`VITE_TWITCH_REDIRECT_URI`** : doit correspondre exactement à l’URL de callback enregistrée chez Twitch (par ex. `http://localhost:5173/auth/callback`).
- **`VITE_TWITCH_SCOPES`** : scopes Twitch requis, par ex. :
  - `user:read:email`
  - `channel:read:redemptions`
  - `channel:manage:redemptions`

Référence Twitch : [Docs Authentication](https://dev.twitch.tv/docs/authentication/).

### 3. Flow OAuth2 utilisé (Implicit Grant)

- Utilisation de l’endpoint d’auth Twitch :

  - `https://id.twitch.tv/oauth2/authorize`
  - `response_type=token`
  - `client_id=...`
  - `redirect_uri=...`
  - `scope=...`
  - `state` aléatoire stocké dans `localStorage` (protection CSRF).

- Le callback est géré par la page `AuthCallbackPage` qui :

  - Lit le fragment d’URL `#access_token=...`.
  - Valide le `state`.
  - Stocke le token dans `localStorage`.
  - Redirige vers `/`.

### 4. Structure Atomik React

Organisation simplifiée (**Atomik/Atomic Design**) :

```text
src/
  config.ts                -> Lecture des variables d'env (client_id, scopes, redirect_uri)
  twitchAuth.ts            -> Logique OAuth Twitch (build URL, parse hash, stockage token)
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
      AuthCallbackPage/
        AuthCallbackPage.tsx       -> Traitement du retour OAuth Twitch
```

L'application tourne dans une fenêtre **Electron** (`electron/main.cjs`) qui charge le build Vite et expose une icône de tray pour tourner en arrière-plan.

### 5. Accès aux Channel Points (rewards / redemptions)

- L’app récupère :
  - ton **profil utilisateur** (`/helix/users`),
  - la liste des **Custom Rewards** (`/helix/channel_points/custom_rewards`),
  - les **redemptions UNFULFILLED** pour chaque reward (`/helix/channel_points/custom_rewards/redemptions`).

- Tout cela se fait côté client avec le token OAuth2 obtenu via le flow implicit (voir [Authentication | Twitch Developers](https://dev.twitch.tv/docs/authentication/)).

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



Idées de systèmes d’auto‑update possibles (pour plus tard)
Sans rentrer dans le code, voici les options classiques si tu veux un jour ajouter une mise à jour automatique :

electron-updater + GitHub Releases

Le plus courant : tu publies chaque nouvelle version en .exe / .zip sur GitHub Releases.
L’app vérifie périodiquement (autoUpdater.checkForUpdates) et télécharge la nouvelle version si disponible, puis propose de redémarrer.
Avantage : peu d’infra, tout passe par GitHub.