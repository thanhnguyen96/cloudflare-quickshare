import { ThemeToggle } from "./components/ThemeToggle/ThemeToggle";
import { Uploader } from "./components/Uploader/Uploader";
import { useTheme } from "./hooks/useTheme";

export default function App() {
  const { theme, toggleTheme } = useTheme();

  return (
    <main className="app">
      <section className="home-card">
        <header className="home-card__header">
          <h1 className="home-card__title">QuickShare 24h</h1>

          <ThemeToggle theme={theme} onToggle={toggleTheme} />
        </header>

        <Uploader />
      </section>
    </main>
  );
}
