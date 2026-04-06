import { router } from "expo-router";
import React, { useEffect } from "react";
import { View } from "react-native";
import { useApp } from "@/context/AppContext";
import { useTheme } from "@/context/ThemeContext";

export default function IndexScreen() {
  const { onboardingDone } = useApp();
  const { colors } = useTheme();

  useEffect(() => {
    if (onboardingDone) {
      router.replace("/(tabs)");
    } else {
      router.replace("/onboarding");
    }
  }, [onboardingDone]);

  return <View style={{ flex: 1, backgroundColor: colors.background }} />;
}
