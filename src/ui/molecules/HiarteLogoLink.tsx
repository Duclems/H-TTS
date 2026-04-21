import { useI18n } from "../context/I18nContext";

type Props = {
  className?: string;
  variant?: "section" | "header";
};

export const HiarteLogoLink = ({ className = "", variant = "section" }: Props) => {
  const { t } = useI18n();
  const linkClass =
    variant === "header"
      ? ["modal-header-hiarte-link", className].filter(Boolean).join(" ")
      : ["about-hiarte-logo-link", className].filter(Boolean).join(" ");

  return (
    <a
      href="https://www.hiarte.fr/"
      target="_blank"
      rel="noreferrer"
      className={linkClass}
      aria-label={t("about.hiarteLink")}
    >
      <img
        src="/logos/hiarte.svg"
        alt=""
        className={variant === "header" ? "modal-header-hiarte-logo" : "about-hiarte-logo"}
      />
    </a>
  );
};
