import type { CSSProperties } from "react";
import { Label } from "../atoms/Label";
import { Input } from "../atoms/Input";

type Props = {
  id: string;
  label: string;
  type?: "text" | "password";
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: boolean;
  inputClassName?: string;
  labelStyle?: CSSProperties;
};

export const FormField = ({
  id,
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  error,
  inputClassName,
  labelStyle
}: Props) => {
  return (
    <div>
      <Label htmlFor={id} style={{ display: "block", fontSize: "0.75rem", marginBottom: "0.2rem", ...labelStyle }}>
        {label}
      </Label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        error={error}
        className={inputClassName}
      />
    </div>
  );
};
