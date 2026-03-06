import type { CSSProperties } from "react";

type Props = {
  htmlFor?: string;
  children: React.ReactNode;
  style?: CSSProperties;
  className?: string;
};

export const Label = ({ htmlFor, children, style, className = "" }: Props) => {
  return (
    <label htmlFor={htmlFor} style={style} className={className}>
      {children}
    </label>
  );
};
