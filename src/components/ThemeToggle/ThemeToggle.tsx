import type { ThemeMode } from "../../hooks/useTheme";

interface ThemeToggleProps {
  theme: ThemeMode;
  onToggle: () => void;
}

export function ThemeToggle({ theme, onToggle }: ThemeToggleProps) {
  const nextTheme = theme === "light" ? "dark" : "light";

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={onToggle}
      aria-label={`Switch to ${nextTheme} mode`}
    >
      <span className="theme-toggle__icon" aria-hidden="true">
        {theme === "light" ? "MOON" : "SUN"}
      </span>
      <span className="theme-toggle__label">{theme === "light" ? "Dark" : "Light"} mode</span>
    </button>
  );
}
