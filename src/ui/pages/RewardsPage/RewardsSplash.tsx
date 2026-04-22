import { HiTtsLogoLink } from "../../atoms/HiTtsLogoLink";
import { useI18n } from "../../context/I18nContext";

export const RewardsSplash = () => {
  const { t } = useI18n();
  return (
    <section className="card">
      <div
        className="rewards-splash"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <HiTtsLogoLink imgClassName="rewards-splash-logo" />
        <span className="visually-hidden">{t("a11y.loadingRewards")}</span>
      </div>
    </section>
  );
};
