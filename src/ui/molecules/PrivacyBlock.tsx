import { useI18n } from "../context/I18nContext";

type Props = {
  i18nKey: string;
};

export const PrivacyBlock = ({ i18nKey }: Props) => {
  const { t } = useI18n();
  const raw = t(i18nKey);
  const [title, ...rest] = raw.split("\n");
  const body = rest.join("\n").trim();

  return (
    <div className="about-privacy-block">
      <div className="about-privacy-heading">{title}</div>
      {body && <p className="card-text about-privacy-body">{body}</p>}
    </div>
  );
};
