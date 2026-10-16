"use client";

import React, { createContext, useContext, useState } from "react";

export type Theme = "dark" | "pink" | "gold";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "dark",
  toggleTheme: () => {},
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window !== "undefined") {
      const savedTheme = localStorage.getItem("app-theme") as Theme | null;
      if (savedTheme === "pink" || savedTheme === "dark" || savedTheme === "gold") {
        return savedTheme;
      }
    }
    return "dark";
  });

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    if (typeof window !== "undefined") {
      localStorage.setItem("app-theme", newTheme);
    }
  };

  const toggleTheme = () => {
    const order: Theme[] = ["dark", "pink", "gold"];
    const nextTheme = order[(order.indexOf(theme) + 1) % order.length];
    setTheme(nextTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
