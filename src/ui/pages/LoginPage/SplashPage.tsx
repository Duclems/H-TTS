import { AppShellLogin } from "../../templates/AppShellLogin";
import { HiTtsLogoLink } from "../../atoms/HiTtsLogoLink";
import { useI18n } from "../../context/I18nContext";

export const SplashPage = () => {
  const { t } = useI18n();
  return (
    <AppShellLogin mainVariant="splash">
      <div role="status" aria-live="polite" aria-busy="true">
        <HiTtsLogoLink imgStyle={{ width: "112px", height: "112px", opacity: 0.95 }} />
        <span className="visually-hidden">{t("a11y.loading")}</span>
      </div>
    </AppShellLogin>
  );
};
