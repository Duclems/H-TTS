# TODO HI-TTS (avant diffusion large)

- [ ] Ajouter un vrai `build/icon.ico` (icône Windows) pour remplacer l’icône Electron.
- [ ] Relire et compléter `PRIVACY.md` si l’application est distribuée à d’autres streamers (site, mentions légales, lien éventuel dans l’UI).
- [ ] (Optionnel) Mettre en place un auto-update via `electron-updater` + GitHub Releases.
- [ ] (Optionnel) Mettre en place une signature de l’exécutable Windows (certificat de signature de code) pour éviter les alertes SmartScreen.
- [ ] (Optionnel) Ajouter un fichier `LICENSE` avec le texte complet de la licence MIT.


Idées de systèmes d’auto‑update possibles (pour plus tard)
Sans rentrer dans le code, voici les options classiques si tu veux un jour ajouter une mise à jour automatique :

electron-updater + GitHub Releases

Le plus courant : tu publies chaque nouvelle version en .exe / .zip sur GitHub Releases.
L’app vérifie périodiquement (autoUpdater.checkForUpdates) et télécharge la nouvelle version si disponible, puis propose de redémarrer.
Avantage : peu d’infra, tout passe par GitHub.