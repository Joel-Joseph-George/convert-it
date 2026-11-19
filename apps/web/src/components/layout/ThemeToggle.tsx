import * as React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useSettingsStore } from '@/features/settings/settingsStore';
import { Button } from '@/components/ui/button';

export const ThemeToggle: React.FC = () => {
  const { theme, setTheme } = useSettingsStore();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const toggleTheme = (): void => {
    const isCurrentlyDark =
      theme === 'dark' ||
      (theme === 'system' &&
        window.matchMedia('(prefers-color-scheme: dark)').matches);

    setTheme(isCurrentlyDark ? 'light' : 'dark');
  };

  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="iconSm"
        aria-label="Toggle theme"
        className="text-muted-foreground hover:text-foreground"
      >
        <span className="h-4 w-4" />
      </Button>
    );
  }

  const isDark =
    theme === 'dark' ||
    (theme === 'system' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);

  return (
    <Button
      variant="ghost"
      size="iconSm"
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      className="text-muted-foreground hover:text-foreground hover:bg-muted"
    >
      {isDark ? (
        <Moon className="h-4 w-4 stroke-[1.75]" />
      ) : (
        <Sun className="h-4 w-4 stroke-[1.75]" />
      )}
    </Button>
  );
};
