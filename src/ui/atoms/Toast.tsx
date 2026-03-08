export type ToastVariant = "success" | "default";

type Props = {
  children: React.ReactNode;
  variant?: ToastVariant;
  className?: string;
};

export const Toast = ({ children, variant = "default", className = "" }: Props) => {
  const variantClass = variant === "success" ? "toast toast--success" : "toast";
  const fullClass = className ? `${variantClass} ${className}` : variantClass;
  return <div className={fullClass} role="status" aria-live="polite">{children}</div>;
};
