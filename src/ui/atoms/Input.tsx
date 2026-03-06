import type { CSSProperties } from "react";

type Props = {
  id?: string;
  type?: "text" | "password" | "email";
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: boolean;
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
  min?: number;
  max?: number;
  step?: number;
  "aria-label"?: string;
  "aria-describedby"?: string;
};

export const Input = ({
  id,
  type = "text",
  value,
  onChange,
  placeholder,
  error,
  disabled,
  className = "",
  style,
  min,
  max,
  step,
  "aria-label": ariaLabel,
  "aria-describedby": ariaDescribedBy
}: Props) => {
  const baseClass = error ? "field field-error" : "field";
  const fullClass = className ? `${baseClass} ${className}` : baseClass;
  return (
    <input
      id={id}
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className={fullClass}
      style={style}
      min={min}
      max={max}
      step={step}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
    />
  );
};
