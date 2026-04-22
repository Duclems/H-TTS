import React from "react";
import ReactDOM from "react-dom/client";
import { I18nProvider } from "./ui/context/I18nContext";
import { GlobalErrorBoundary } from "./ui/atoms/ErrorBoundary";
import { App } from "./ui/App";
import "./styles/index.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <I18nProvider>
      <GlobalErrorBoundary>
        <App />
      </GlobalErrorBoundary>
    </I18nProvider>
  </React.StrictMode>
);
