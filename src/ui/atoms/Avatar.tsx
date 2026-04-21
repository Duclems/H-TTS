type Props = {
  src?: string | null;
  initial?: string;
  alt?: string;
  className?: string;
};

export const Avatar = ({ src, initial, alt = "", className = "" }: Props) => {
  const wrapClass = className ? `avatar ${className}` : "avatar";
  if (src) {
    return (
      <div className={wrapClass}>
        <img src={src} alt={alt} />
      </div>
    );
  }
  const letter = initial ? initial.charAt(0).toUpperCase() : "?";
  return (
    <div className={wrapClass}>
      <span>{letter}</span>
    </div>
  );
};
