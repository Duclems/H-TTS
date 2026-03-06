import type { CSSProperties } from "react";

type Props = {
  variant: "avatar" | "line";
  lineSize?: "main" | "small";
  style?: CSSProperties;
};

export const Skeleton = ({ variant, lineSize, style }: Props) => {
  if (variant === "avatar") {
    return <div className="skeleton skeleton-avatar" style={style} />;
  }
  const lineClass = lineSize === "main" ? "skeleton-line-main" : "skeleton-line-small";
  return (
    <div
      className={`skeleton skeleton-line ${lineClass}`}
      style={style}
    />
  );
};
