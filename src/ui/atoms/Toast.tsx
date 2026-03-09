export type ToastVariant = "success" | "default" | "danger";

type Props = {
  children: React.ReactNode;
  variant?: ToastVariant;
  className?: string;
};

export const Toast = ({ children, variant = "default", className = "" }: Props) => {
  const base = "toast";
  const variantClass =
    variant === "success"
      ? `${base} toast--success`
      : variant === "danger"
        ? `${base} toast--danger`
        : base;
  const fullClass = className ? `${variantClass} ${className}` : variantClass;
  return <div className={fullClass} role="status" aria-live="polite">{children}</div>;
};
