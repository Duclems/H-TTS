import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { App } from "./ui/App";
import { AuthCallbackPage } from "./ui/pages/AuthCallbackPage/AuthCallbackPage";
import { ElevenLabsSettingsPage } from "./ui/pages/SettingsPage/ElevenLabsSettingsPage";
import { TwitchSettingsPage } from "./ui/pages/SettingsPage/TwitchSettingsPage";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/twitch" element={<TwitchSettingsPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/settings/elevenlabs" element={<ElevenLabsSettingsPage />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
