import { AppShellLogin } from "../../templates/AppShellLogin";
import { HiTtsLogoLink } from "../../atoms/HiTtsLogoLink";

export const SplashPage = () => {
  return (
    <AppShellLogin mainVariant="splash">
      <HiTtsLogoLink imgStyle={{ width: "112px", height: "112px", opacity: 0.95 }} />
    </AppShellLogin>
  );
};
