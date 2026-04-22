import { Component, type ErrorInfo, type ReactNode } from "react";
import { useI18n } from "../context/I18nContext";
import { logDebug } from "../../debugLog";

const IS_DEV = import.meta.env.DEV;

type FallbackRender = (ctx: { error: Error; reset: () => void }) => ReactNode;

type BoundaryProps = {
  children: ReactNode;
  fallback: FallbackRender;
  /**
   * Identifiant logique remonté dans les logs debug (ex. `"boundary-root"`,
   * `"boundary-history"`). Permet de savoir d'où vient un crash sans avoir
   * à décoder la stack trace.
   */
  source: string;
};

type BoundaryState = { error: Error | null };

/**
 * ErrorBoundary brut — class component car React n'expose pas
 * `componentDidCatch` via les hooks. À ne pas utiliser directement : préférer
 * `GlobalErrorBoundary` ou `PageErrorBoundary` qui fournissent un fallback
 * localisé et stylé.
 */
class ErrorBoundaryClass extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    logDebug({
      timestamp: Date.now(),
      type: "system",
      source: this.props.source,
      message: `React render error: ${error.message}`,
      details: {
        name: error.name,
        stack: error.stack,
        componentStack: info.componentStack
      }
    });
    if (IS_DEV) {
      // eslint-disable-next-line no-console
      console.error(`[Hi-TTS][${this.props.source}]`, error, info.componentStack);
    }
  }

  private reset = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    const { error } = this.state;
    if (error) {
      return this.props.fallback({ error, reset: this.reset });
    }
    return this.props.children;
  }
}

type WrapperProps = {
  children: ReactNode;
};

/**
 * Fallback "plein écran" pour le boundary racine. Un crash de l'arbre entier
 * laisse la fenêtre affichable au lieu d'une page blanche, et l'utilisateur
 * peut relancer sans avoir à tuer le process Electron.
 */
export const GlobalErrorBoundary = ({ children }: WrapperProps) => {
  const { t } = useI18n();
  return (
    <ErrorBoundaryClass
      source="boundary-root"
      fallback={({ error }) => (
        <div
          className="app-shell app-shell--login"
          role="alert"
          aria-live="assertive"
        >
          <main className="app-main app-main--splash">
            <div className="error-boundary error-boundary--global">
              <h1 className="error-boundary-title">{t("errorBoundary.globalTitle")}</h1>
              <p className="error-boundary-description">
                {t("errorBoundary.globalDescription")}
              </p>
              <button
                type="button"
                className="twitch-button error-boundary-action"
                onClick={() => window.location.reload()}
              >
                {t("errorBoundary.reload")}
              </button>
              {IS_DEV && (
                <details className="error-boundary-details">
                  <summary>{t("errorBoundary.details")}</summary>
                  <pre>{error.stack ?? `${error.name}: ${error.message}`}</pre>
                </details>
              )}
            </div>
          </main>
        </div>
      )}
    >
      {children}
    </ErrorBoundaryClass>
  );
};

type PageBoundaryProps = WrapperProps & {
  /** Identifiant log distinct (ex. `"history"`, `"rewards"`). */
  source: string;
};

/**
 * Fallback local : contient le crash à une page et laisse l'utilisateur
 * changer d'onglet ou réessayer. Permet d'éviter qu'un bug de parsing
 * d'emote ou un state dégradé tue toute la fenêtre.
 */
export const PageErrorBoundary = ({ children, source }: PageBoundaryProps) => {
  const { t } = useI18n();
  return (
    <ErrorBoundaryClass
      source={`boundary-${source}`}
      fallback={({ error, reset }) => (
        <section className="card" role="alert" aria-live="assertive">
          <div className="error-boundary error-boundary--page">
            <h2 className="error-boundary-title">{t("errorBoundary.pageTitle")}</h2>
            <p className="error-boundary-description">
              {t("errorBoundary.pageDescription")}
            </p>
            <button
              type="button"
              className="twitch-button error-boundary-action"
              onClick={reset}
            >
              {t("errorBoundary.retry")}
            </button>
            {IS_DEV && (
              <details className="error-boundary-details">
                <summary>{t("errorBoundary.details")}</summary>
                <pre>{error.stack ?? `${error.name}: ${error.message}`}</pre>
              </details>
            )}
          </div>
        </section>
      )}
    >
      {children}
    </ErrorBoundaryClass>
  );
};
