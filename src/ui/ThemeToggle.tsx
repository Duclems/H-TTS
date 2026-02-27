import { useEffect, useState } from "react";

type Theme = "light" | "dark";

const THEME_KEY = "h_tts_theme";

function applyTheme(theme: Theme) {
  document.body.dataset.theme = theme;
}

export const ThemeToggle = () => {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const saved = (localStorage.getItem(THEME_KEY) as Theme | null) ?? "light";
    setTheme(saved);
    applyTheme(saved);
  }, []);

  const handleToggle = () => {
    const next: Theme = theme === "light" ? "dark" : "light";
    setTheme(next);
    applyTheme(next);
    localStorage.setItem(THEME_KEY, next);
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      className="theme-toggle"
      aria-label="Basculer le thème clair/sombre"
    >
      {theme === "light" ? "🌙" : "☀️"}
    </button>
  );
};

