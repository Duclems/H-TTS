import { HiTtsLogoLink } from "../atoms/HiTtsLogoLink";

type Props = {
  text: string;
  variant?: "default" | "history";
  logoFaded?: boolean;
};

export const EmptyState = ({ text, variant = "default", logoFaded = false }: Props) => {
  const containerClass =
    variant === "history"
      ? "rewards-empty-state rewards-empty-state-history"
      : "rewards-empty-state";
  const logoClass = logoFaded
    ? "rewards-empty-state-logo rewards-empty-state-logo-faded"
    : "rewards-empty-state-logo";

  return (
    <div className={containerClass}>
      <HiTtsLogoLink imgClassName={logoClass} />
      <p className="card-text rewards-empty-state-text">{text}</p>
    </div>
  );
};
