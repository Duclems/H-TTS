import type { CSSProperties } from "react";

type ButtonVariant = "primary" | "danger" | "voiceError";

type Props = {
  type?: "button" | "submit";
  variant?: ButtonVariant;
  onClick?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
  style?: CSSProperties;
  title?: string;
  "aria-label"?: string;
};

const variantClass: Record<ButtonVariant, string> = {
  primary: "twitch-button",
  danger: "twitch-button btn-danger",
  voiceError: "twitch-button twitch-button-voice-error"
};

export const Button = ({
  type = "button",
  variant = "primary",
  onClick,
  disabled,
  children,
  className = "",
  style,
  title,
  "aria-label": ariaLabel
}: Props) => {
  const baseClass = variantClass[variant];
  return (
    <button
      type={type}
      className={className ? `${baseClass} ${className}` : baseClass}
      onClick={onClick}
      disabled={disabled}
      style={style}
      title={title}
      aria-label={ariaLabel}
    >
      {children}
    </button>
  );
};
