import { useI18n } from "../context/I18nContext";

type Props = {
  messageKey: string;
  titleKey?: string;
  className?: string;
};

/**
 * Bandeau d'avertissement pour les problèmes de sécurité côté stockage local
 * (fallback en clair de `safeStorage`, trousseau système indisponible, etc.).
 */
export const SecurityWarning = ({
  messageKey,
  titleKey = "security.encryptionUnavailableTitle",
  className
}: Props) => {
  const { t } = useI18n();
  return (
    <div
      className={className ? `security-warning ${className}` : "security-warning"}
      role="alert"
    >
      <span className="security-warning-icon" aria-hidden="true">
        ⚠
      </span>
      <div className="security-warning-body">
        <span className="security-warning-title">{t(titleKey)}</span>
        <span className="security-warning-text">{t(messageKey)}</span>
      </div>
    </div>
  );
};
