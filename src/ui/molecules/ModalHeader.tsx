type Props = {
  title: string;
  titleId: string;
  onClose: () => void;
  closeVariant?: "default" | "twitch";
  closeAriaLabel?: string;
};

export const ModalHeader = ({
  title,
  titleId,
  onClose,
  closeVariant = "twitch",
  closeAriaLabel = "Fermer"
}: Props) => {
  const closeClass =
    closeVariant === "twitch"
      ? "settings-modal-close settings-modal-close-twitch"
      : "settings-modal-close";
  return (
    <div className="settings-modal-header">
      <h2 id={titleId} className="card-title">
        {title}
      </h2>
      <button
        type="button"
        className={closeClass}
        onClick={onClose}
        aria-label={closeAriaLabel}
      >
        {closeVariant === "twitch" ? (
          <img src="/cross.svg" alt="Fermer" />
        ) : (
          "✕"
        )}
      </button>
    </div>
  );
};
