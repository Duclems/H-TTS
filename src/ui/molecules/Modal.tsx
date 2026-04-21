import type { ReactNode } from "react";
import { ModalHeader } from "./ModalHeader";
import { useEscapeToClose } from "../hooks/useEscapeToClose";

type Props = {
  titleId: string;
  title: string;
  onClose: () => void;
  headerRight?: ReactNode;
  closeVariant?: "default" | "twitch";
  closeAriaLabel?: string;
  contentClassName?: string;
  mainClassName?: string;
  footer?: ReactNode;
  children: ReactNode;
};

export const Modal = ({
  titleId,
  title,
  onClose,
  headerRight,
  closeVariant,
  closeAriaLabel,
  contentClassName,
  mainClassName,
  footer,
  children
}: Props) => {
  useEscapeToClose(onClose);

  const panelClass = [
    "panel",
    "modal-content",
    "settings-modal-content",
    footer ? "settings-modal-has-footer" : null,
    contentClassName
  ]
    .filter(Boolean)
    .join(" ");

  const mainClass = ["settings-modal-main", mainClassName].filter(Boolean).join(" ");

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className={panelClass} onClick={(e) => e.stopPropagation()}>
        <header>
          <ModalHeader
            titleId={titleId}
            title={title}
            onClose={onClose}
            closeVariant={closeVariant}
            closeAriaLabel={closeAriaLabel}
            rightContent={headerRight}
          />
        </header>
        <main className={mainClass}>{children}</main>
        {footer && <footer className="settings-modal-footer">{footer}</footer>}
      </div>
    </div>
  );
};
