import { useI18n } from "../context/I18nContext";

type Props = {
  title: string;
  titleId: string;
  onClose: () => void;
  closeVariant?: "default" | "twitch";
  closeAriaLabel?: string;
  rightContent?: React.ReactNode;
};

export const ModalHeader = ({
  title,
  titleId,
  onClose,
  closeVariant = "twitch",
  closeAriaLabel: closeAriaLabelProp,
  rightContent
}: Props) => {
  const { t } = useI18n();
  const closeAriaLabel = closeAriaLabelProp ?? t("modal.close");
  const closeClass =
    closeVariant === "twitch"
      ? "settings-modal-close settings-modal-close-twitch"
      : "settings-modal-close";
  return (
    <div className="settings-modal-header">
      <h2 id={titleId} className="card-title">
        {title}
      </h2>
      <div className="settings-modal-header-actions">
        {rightContent}
        <button
        type="button"
        className={closeClass}
        onClick={onClose}
        aria-label={closeAriaLabel}
      >
        {closeVariant === "twitch" ? (
          <img src="/cross.svg" alt={closeAriaLabel} />
        ) : (
          "✕"
        )}
      </button>
      </div>
    </div>
  );
};
