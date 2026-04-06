import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { type ColorSchemeName } from "react-native";
import { COLORS, type ThemeMode } from "@/constants/colors";

type ThemeContextType = {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  colors: typeof COLORS.dark;
  isDark: boolean;
  colorblindMode: boolean;
  setColorblindMode: (val: boolean) => void;
};

const ThemeContext = createContext<ThemeContextType | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>("dark");
  const [colorblindMode, setColorblindModeState] = useState(false);

  useEffect(() => {
    AsyncStorage.multiGet(["@theme", "@colorblind"]).then((vals) => {
      const t = vals[0][1] as ThemeMode | null;
      const cb = vals[1][1];
      if (t === "light" || t === "dark") setThemeState(t);
      if (cb === "true") setColorblindModeState(true);
    });
  }, []);

  const setTheme = useCallback((t: ThemeMode) => {
    setThemeState(t);
    AsyncStorage.setItem("@theme", t);
  }, []);

  const setColorblindMode = useCallback((val: boolean) => {
    setColorblindModeState(val);
    AsyncStorage.setItem("@colorblind", String(val));
  }, []);

  const isDark = theme === "dark";
  const colors = isDark ? COLORS.dark : COLORS.light;

  return (
    <ThemeContext.Provider value={{ theme, setTheme, colors, isDark, colorblindMode, setColorblindMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
