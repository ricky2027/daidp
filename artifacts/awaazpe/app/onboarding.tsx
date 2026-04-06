import { Feather, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS } from "@/constants/colors";
import { useTheme } from "@/context/ThemeContext";
import { useApp } from "@/context/AppContext";

const { width } = Dimensions.get("window");

const LANGUAGES = [
  { code: "en-IN", label: "English", native: "English", script: "A" },
  { code: "hi-IN", label: "Hindi", native: "हिन्दी", script: "अ" },
  { code: "bn-IN", label: "Bengali", native: "বাংলা", script: "অ" },
  { code: "ta-IN", label: "Tamil", native: "தமிழ்", script: "அ" },
  { code: "te-IN", label: "Telugu", native: "తెలుగు", script: "అ" },
  { code: "kn-IN", label: "Kannada", native: "ಕನ್ನಡ", script: "ಅ" },
  { code: "mr-IN", label: "Marathi", native: "मराठी", script: "अ" },
  { code: "gu-IN", label: "Gujarati", native: "ગુજરાતી", script: "અ" },
];

const LANG_COLORS = [
  "#6366F1", "#2196F3", "#FF6D00", "#F59E0B",
  "#8B5CF6", "#EC4899", "#14B8A6", "#F97316",
];

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const { theme, setTheme, isDark, colors } = useTheme();
  const { setLanguage, completeOnboarding } = useApp();
  const [step, setStep] = useState(0); // 0: welcome, 1: language, 2: theme
  const [selectedLang, setSelectedLang] = useState("en-IN");
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const goToStep = (next: number) => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 0.95, duration: 200, useNativeDriver: true }),
    ]).start(() => {
      setStep(next);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }),
      ]).start();
    });
  };

  const handleLangSelect = (code: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedLang(code);
  };

  const handleContinue = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (step === 0) goToStep(1);
    else if (step === 1) {
      setLanguage(selectedLang);
      goToStep(2);
    } else {
      completeOnboarding();
      router.replace("/(tabs)");
    }
  };

  const bg = isDark ? COLORS.dark.background : COLORS.light.background;
  const card = isDark ? COLORS.dark.card : COLORS.light.card;
  const text = isDark ? COLORS.dark.text : COLORS.light.text;
  const textSec = isDark ? COLORS.dark.textSecondary : COLORS.light.textSecondary;
  const border = isDark ? COLORS.dark.border : COLORS.light.border;

  return (
    <View style={[styles.container, { backgroundColor: bg, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
        {step === 0 && (
          <View style={styles.welcomeContainer}>
            <View style={[styles.logoContainer, { backgroundColor: COLORS.primary + "20" }]}>
              <View style={[styles.logoInner, { backgroundColor: COLORS.primary }]}>
                <Ionicons name="mic" size={40} color="#fff" />
              </View>
            </View>
            <Text style={[styles.appName, { color: text, fontFamily: "Inter_700Bold" }]}>AwaazPe</Text>
            <Text style={[styles.tagline, { color: COLORS.primary, fontFamily: "Inter_600SemiBold" }]}>
              आवाज़ से पेमेंट
            </Text>
            <Text style={[styles.subtitle, { color: textSec, fontFamily: "Inter_400Regular" }]}>
              India's first voice-powered UPI payment app. Pay anyone with just your voice.
            </Text>
            <View style={styles.features}>
              {[
                { icon: "mic-outline", label: "Voice Payments in 8 languages" },
                { icon: "shield-checkmark-outline", label: "Secure & colorblind-friendly" },
                { icon: "flash-outline", label: "Instant UPI transfers" },
              ].map((f) => (
                <View key={f.icon} style={[styles.featureRow, { backgroundColor: card }]}>
                  <View style={[styles.featureIcon, { backgroundColor: COLORS.primary + "20" }]}>
                    <Ionicons name={f.icon as any} size={18} color={COLORS.primary} />
                  </View>
                  <Text style={[styles.featureText, { color: text, fontFamily: "Inter_500Medium" }]}>{f.label}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {step === 1 && (
          <View style={styles.stepContainer}>
            <Text style={[styles.stepTitle, { color: text, fontFamily: "Inter_700Bold" }]}>Choose Language</Text>
            <Text style={[styles.stepSubtitle, { color: textSec, fontFamily: "Inter_400Regular" }]}>
              Select your preferred language for voice commands
            </Text>
            <View style={styles.langGrid}>
              {LANGUAGES.map((lang, idx) => {
                const selected = selectedLang === lang.code;
                return (
                  <Pressable
                    key={lang.code}
                    onPress={() => handleLangSelect(lang.code)}
                    style={[
                      styles.langCard,
                      {
                        backgroundColor: selected ? LANG_COLORS[idx % LANG_COLORS.length] + "20" : card,
                        borderColor: selected ? LANG_COLORS[idx % LANG_COLORS.length] : border,
                        borderWidth: selected ? 2 : 1,
                      },
                    ]}
                  >
                    <Text style={[styles.langScript, { color: selected ? LANG_COLORS[idx % LANG_COLORS.length] : textSec, fontFamily: "Inter_700Bold" }]}>
                      {lang.native[0]}
                    </Text>
                    <Text style={[styles.langNative, { color: selected ? LANG_COLORS[idx % LANG_COLORS.length] : text, fontFamily: "Inter_600SemiBold" }]}>
                      {lang.native}
                    </Text>
                    <Text style={[styles.langLabel, { color: textSec, fontFamily: "Inter_400Regular" }]}>
                      {lang.label}
                    </Text>
                    {selected && (
                      <View style={[styles.checkBadge, { backgroundColor: LANG_COLORS[idx % LANG_COLORS.length] }]}>
                        <Feather name="check" size={10} color="#fff" />
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {step === 2 && (
          <View style={styles.stepContainer}>
            <Text style={[styles.stepTitle, { color: text, fontFamily: "Inter_700Bold" }]}>Choose Theme</Text>
            <Text style={[styles.stepSubtitle, { color: textSec, fontFamily: "Inter_400Regular" }]}>
              You can change this anytime in Profile
            </Text>
            <View style={styles.themeRow}>
              {(["dark", "light"] as const).map((t) => {
                const selected = theme === t;
                const themeBg = t === "dark" ? COLORS.dark.card : COLORS.light.card;
                const themeText = t === "dark" ? COLORS.dark.text : COLORS.light.text;
                const themeSub = t === "dark" ? COLORS.dark.textSecondary : COLORS.light.textSecondary;
                const themeBgMain = t === "dark" ? COLORS.dark.background : COLORS.light.background;
                return (
                  <Pressable
                    key={t}
                    onPress={() => { setTheme(t); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                    style={[
                      styles.themeCard,
                      {
                        backgroundColor: themeBgMain,
                        borderColor: selected ? COLORS.primary : border,
                        borderWidth: selected ? 2 : 1,
                      },
                    ]}
                  >
                    <View style={[styles.themePreviewCard, { backgroundColor: themeBg }]}>
                      <View style={[styles.themePreviewRow, { backgroundColor: COLORS.primary + "30" }]} />
                      <View style={[styles.themePreviewRowSm, { backgroundColor: themeSub + "40" }]} />
                      <View style={[styles.themePreviewRowSm, { backgroundColor: themeSub + "20" }]} />
                    </View>
                    <Text style={[styles.themeName, { color: themeText, fontFamily: "Inter_600SemiBold" }]}>
                      {t === "dark" ? "Dark" : "Light"}
                    </Text>
                    {selected && (
                      <View style={[styles.selectedBadge, { backgroundColor: COLORS.primary }]}>
                        <Feather name="check" size={14} color="#fff" />
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
            <View style={[styles.colorblindNote, { backgroundColor: card }]}>
              <Ionicons name="eye-outline" size={16} color={COLORS.primary} />
              <Text style={[styles.colorblindText, { color: textSec, fontFamily: "Inter_400Regular" }]}>
                AwaazPe uses colorblind-friendly colors — no red/green for status
              </Text>
            </View>
          </View>
        )}
      </Animated.View>

      <View style={styles.bottomBar}>
        <View style={styles.dots}>
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              style={[
                styles.dot,
                { backgroundColor: step === i ? COLORS.primary : border, width: step === i ? 24 : 8 },
              ]}
            />
          ))}
        </View>
        <Pressable
          onPress={handleContinue}
          style={({ pressed }) => [
            styles.btn,
            { backgroundColor: COLORS.primary, opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] },
          ]}
        >
          <Text style={[styles.btnText, { fontFamily: "Inter_600SemiBold" }]}>
            {step === 2 ? "Get Started" : "Continue"}
          </Text>
          <Ionicons name="arrow-forward" size={18} color="#fff" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 20 },
  welcomeContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  logoContainer: { width: 100, height: 100, borderRadius: 30, alignItems: "center", justifyContent: "center", marginBottom: 24 },
  logoInner: { width: 80, height: 80, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  appName: { fontSize: 36, letterSpacing: -1, marginBottom: 4 },
  tagline: { fontSize: 16, marginBottom: 12 },
  subtitle: { fontSize: 15, textAlign: "center", lineHeight: 22, marginBottom: 32, paddingHorizontal: 20 },
  features: { width: "100%", gap: 10 },
  featureRow: { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 14, gap: 12 },
  featureIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  featureText: { fontSize: 14 },
  stepContainer: { flex: 1, paddingTop: 20 },
  stepTitle: { fontSize: 28, letterSpacing: -0.5, marginBottom: 8 },
  stepSubtitle: { fontSize: 14, marginBottom: 28, lineHeight: 20 },
  langGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  langCard: { width: (width - 58) / 2, padding: 16, borderRadius: 16, position: "relative" },
  langScript: { fontSize: 28, marginBottom: 6 },
  langNative: { fontSize: 16, marginBottom: 2 },
  langLabel: { fontSize: 12 },
  checkBadge: { position: "absolute", top: 10, right: 10, width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  themeRow: { flexDirection: "row", gap: 16, marginBottom: 20 },
  themeCard: { flex: 1, borderRadius: 16, padding: 14, position: "relative", overflow: "hidden" },
  themePreviewCard: { borderRadius: 10, padding: 12, marginBottom: 12, gap: 8, height: 80, justifyContent: "center" },
  themePreviewRow: { height: 12, borderRadius: 6, width: "80%" },
  themePreviewRowSm: { height: 8, borderRadius: 4, width: "60%" },
  themeName: { fontSize: 15, textAlign: "center" },
  selectedBadge: { position: "absolute", top: 12, right: 12, width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  colorblindNote: { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 14, gap: 10 },
  colorblindText: { flex: 1, fontSize: 13, lineHeight: 18 },
  bottomBar: { paddingHorizontal: 24, paddingBottom: 20, paddingTop: 16, gap: 16 },
  dots: { flexDirection: "row", justifyContent: "center", gap: 6 },
  dot: { height: 8, borderRadius: 4 },
  btn: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 16, borderRadius: 16, gap: 8 },
  btnText: { color: "#fff", fontSize: 16 },
});
