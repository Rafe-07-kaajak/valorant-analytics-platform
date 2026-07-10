"use client";

import { Button } from "@repo/ui";
import { useTheme } from "../hooks/useTheme";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={toggleTheme}
      aria-label="Toggle color theme"
    >
      {theme === "dark" ? "Light mode" : "Dark mode"}
    </Button>
  );
}
