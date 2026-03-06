type Props = {
  children: React.ReactNode;
  danger?: boolean;
  className?: string;
};

export const Chip = ({ children, danger, className = "" }: Props) => {
  const baseClass = danger ? "token-chip token-chip-danger" : "token-chip";
  const fullClass = className ? `${baseClass} ${className}` : baseClass;
  return <span className={fullClass}>{children}</span>;
};
