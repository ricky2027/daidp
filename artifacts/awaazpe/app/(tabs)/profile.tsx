import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import QRCode from "react-native-qrcode-svg";
import React, { useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS } from "@/constants/colors";
import { useTheme } from "@/context/ThemeContext";
import { useApp } from "@/context/AppContext";

const LANGUAGES = [
  { code: "en-IN", label: "English" },
  { code: "hi-IN", label: "हिन्दी" },
  { code: "bn-IN", label: "বাংলা" },
  { code: "ta-IN", label: "தமிழ்" },
  { code: "te-IN", label: "తెలుగు" },
  { code: "kn-IN", label: "ಕನ್ನಡ" },
  { code: "mr-IN", label: "मराठी" },
  { code: "gu-IN", label: "ગુજરાતી" },
];

function SettingRow({
  icon, label, value, onPress, isSwitch, switchVal, children,
}: {
  icon: string; label: string; value?: string; onPress?: () => void;
  isSwitch?: boolean; switchVal?: boolean; children?: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.settingRow, { backgroundColor: colors.card, opacity: pressed && onPress ? 0.8 : 1 }]}
    >
      <View style={[styles.settingIcon, { backgroundColor: colors.surface }]}>
        <Ionicons name={icon as any} size={18} color={COLORS.primary} />
      </View>
      <Text style={[styles.settingLabel, { color: colors.text, fontFamily: "Inter_500Medium" }]}>{label}</Text>
      <View style={{ flex: 1 }} />
      {children}
      {value && <Text style={[styles.settingValue, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>{value}</Text>}
      {isSwitch && <Switch value={switchVal} onValueChange={onPress} trackColor={{ false: colors.border, true: COLORS.primary }} />}
      {!isSwitch && !children && onPress && <Feather name="chevron-right" size={16} color={colors.textMuted} />}
    </Pressable>
  );
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { colors, isDark, setTheme, colorblindMode, setColorblindMode } = useTheme();
  const { language, setLanguage } = useApp();
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const upiId = "aditya.kumar@upi";

  const currentLang = LANGUAGES.find((l) => l.code === language)?.label || "English";

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + (Platform.OS === "web" ? 67 : 10), paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text, fontFamily: "Inter_700Bold" }]}>Profile</Text>
        </View>

        {/* Profile Card */}
        <View style={[styles.profileCard, { backgroundColor: colors.card }]}>
          <View style={[styles.profileAvatar, { backgroundColor: COLORS.primary }]}>
            <Text style={[styles.profileInitials, { fontFamily: "Inter_700Bold" }]}>AK</Text>
          </View>
          <View>
            <Text style={[styles.profileName, { color: colors.text, fontFamily: "Inter_700Bold" }]}>Aditya Kumar</Text>
            <Text style={[styles.profileUpi, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>{upiId}</Text>
          </View>
          <Pressable
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowQR(!showQR); }}
            style={[styles.qrToggle, { backgroundColor: colors.surface }]}
          >
            <MaterialCommunityIcons name="qrcode" size={20} color={COLORS.primary} />
          </Pressable>
        </View>

        {/* QR Code */}
        {showQR && (
          <View style={[styles.qrCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.qrLabel, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>Your UPI QR Code</Text>
            <View style={styles.qrWrapper}>
              <QRCode
                value={`upi://pay?pa=${upiId}&pn=Aditya Kumar`}
                size={200}
                color={colors.text}
                backgroundColor={colors.card}
              />
            </View>
            <Text style={[styles.qrUpi, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>{upiId}</Text>
            <Pressable onPress={() => router.push("/qr")} style={[styles.scanBtn, { backgroundColor: COLORS.primary + "20" }]}>
              <Ionicons name="scan-outline" size={16} color={COLORS.primary} />
              <Text style={{ color: COLORS.primary, fontFamily: "Inter_500Medium", fontSize: 14 }}>Scan to Pay Me</Text>
            </Pressable>
          </View>
        )}

        {/* Appearance */}
        <Text style={[styles.sectionLabel, { color: colors.textMuted, fontFamily: "Inter_500Medium" }]}>APPEARANCE</Text>
        <View style={styles.section}>
          <SettingRow
            icon="moon-outline"
            label="Dark Mode"
            isSwitch
            switchVal={isDark}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setTheme(isDark ? "light" : "dark"); }}
          />
          <SettingRow
            icon="eye-outline"
            label="Colorblind Mode"
            isSwitch
            switchVal={colorblindMode}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setColorblindMode(!colorblindMode); }}
          />
        </View>

        {/* Language */}
        <Text style={[styles.sectionLabel, { color: colors.textMuted, fontFamily: "Inter_500Medium" }]}>LANGUAGE</Text>
        <View style={styles.section}>
          <SettingRow
            icon="language-outline"
            label="App Language"
            value={currentLang}
            onPress={() => setShowLangPicker(!showLangPicker)}
          />
          {showLangPicker && (
            <View style={[styles.langPicker, { backgroundColor: colors.surface }]}>
              {LANGUAGES.map((lang) => (
                <Pressable
                  key={lang.code}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setLanguage(lang.code); setShowLangPicker(false); }}
                  style={[styles.langOption, { borderBottomColor: colors.border }]}
                >
                  <Text style={[styles.langOptionText, { color: language === lang.code ? COLORS.primary : colors.text, fontFamily: language === lang.code ? "Inter_600SemiBold" : "Inter_400Regular" }]}>
                    {lang.label}
                  </Text>
                  {language === lang.code && <Feather name="check" size={16} color={COLORS.primary} />}
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* Notifications */}
        <Text style={[styles.sectionLabel, { color: colors.textMuted, fontFamily: "Inter_500Medium" }]}>NOTIFICATIONS</Text>
        <View style={styles.section}>
          <SettingRow icon="notifications-outline" label="Payment Alerts" isSwitch switchVal onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)} />
          <SettingRow icon="calendar-outline" label="Scheduled Reminders" isSwitch switchVal onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)} />
        </View>

        {/* About */}
        <Text style={[styles.sectionLabel, { color: colors.textMuted, fontFamily: "Inter_500Medium" }]}>ABOUT</Text>
        <View style={styles.section}>
          <SettingRow icon="information-circle-outline" label="Version" value="1.0.0" />
          <SettingRow icon="shield-outline" label="Privacy Policy" onPress={() => {}} />
          <SettingRow icon="document-text-outline" label="Terms of Service" onPress={() => {}} />
        </View>

        <Text style={[styles.footer, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>
          AwaazPe · आवाज़ से पेमेंट{"\n"}Made with voice in India 🇮🇳
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, marginBottom: 16 },
  title: { fontSize: 28, letterSpacing: -0.5 },
  profileCard: { flexDirection: "row", alignItems: "center", marginHorizontal: 20, padding: 16, borderRadius: 16, marginBottom: 20, gap: 14 },
  profileAvatar: { width: 52, height: 52, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  profileInitials: { color: "#fff", fontSize: 20 },
  profileName: { fontSize: 17, marginBottom: 2 },
  profileUpi: { fontSize: 12 },
  qrToggle: { marginLeft: "auto", width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  qrCard: { marginHorizontal: 20, padding: 20, borderRadius: 16, alignItems: "center", marginBottom: 16, gap: 12 },
  qrLabel: { fontSize: 13 },
  qrWrapper: { padding: 12, backgroundColor: "#fff", borderRadius: 12 },
  qrUpi: { fontSize: 15 },
  scanBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  sectionLabel: { fontSize: 11, letterSpacing: 1, paddingHorizontal: 20, marginBottom: 8, marginTop: 8 },
  section: { marginHorizontal: 20, borderRadius: 16, overflow: "hidden", marginBottom: 8, gap: 1 },
  settingRow: { flexDirection: "row", alignItems: "center", padding: 14, gap: 12 },
  settingIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  settingLabel: { fontSize: 14 },
  settingValue: { fontSize: 14 },
  langPicker: { borderRadius: 12, overflow: "hidden", margin: 4 },
  langOption: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5 },
  langOptionText: { fontSize: 15 },
  footer: { textAlign: "center", fontSize: 12, paddingVertical: 24, lineHeight: 18 },
});
