import { Feather, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS } from "@/constants/colors";
import { useTheme } from "@/context/ThemeContext";
import { useApp } from "@/context/AppContext";

const BASE_URL = process.env.EXPO_PUBLIC_DOMAIN ? `https://${process.env.EXPO_PUBLIC_DOMAIN}` : "";

async function playTTS(text: string, language: string) {
  if (Platform.OS !== "web") return;
  try {
    const resp = await fetch(`${BASE_URL}/api/voice/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, languageCode: language }),
    });
    if (!resp.ok) return;
    const data = await resp.json() as { audio: string };
    if (!data.audio) return;
    const audio = new Audio(`data:audio/wav;base64,${data.audio}`);
    audio.play().catch(() => {});
  } catch {}
}

function CoinParticle({ delay, colors }: { delay: number; colors: string[] }) {
  const anim = useRef(new Animated.Value(0)).current;
  const xOffset = (Math.random() - 0.5) * 80;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.timing(anim, { toValue: 1, duration: 800, easing: Easing.out(Easing.ease), useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={{
      position: "absolute",
      top: 0,
      left: "50%",
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors[Math.floor(Math.random() * colors.length)],
      opacity: anim.interpolate({ inputRange: [0, 0.8, 1], outputRange: [1, 1, 0] }),
      transform: [
        { translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [0, xOffset] }) },
        { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [0, -120] }) },
        { scale: anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.5, 0.5] }) },
      ],
    }} />
  );
}

export default function ReceiptScreen() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { language } = useApp();
  const params = useLocalSearchParams();
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(60)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const type = params.type as string || "sent";
  const amount = params.amount as string || "0";
  const contactName = params.contactName as string || "Unknown";
  const upiId = params.upiId as string || "";
  const scheduledDate = params.date as string;
  const txnId = `TXN${Date.now()}`;
  const isScheduled = type === "scheduled";

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Animated.parallel([
      Animated.spring(pulseAnim, { toValue: 1, tension: 50, friction: 5, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
    ]).start();

    const recipientFirst = contactName.split(" ")[0];
    const confirmMsg = isScheduled
      ? `Payment of rupees ${amount} to ${recipientFirst} has been scheduled`
      : `Rupees ${amount} sent to ${recipientFirst} successfully. Transaction complete.`;
    setTimeout(() => playTTS(confirmMsg, language), 600);
  }, []);

  const particleColors = [COLORS.primary, COLORS.success, COLORS.warning, "#fff"];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable onPress={() => router.push("/(tabs)")} style={[styles.closeBtn, { backgroundColor: colors.card }]}>
          <Feather name="x" size={20} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>Receipt</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        {/* Success Animation */}
        <View style={styles.successSection}>
          <View style={{ position: "relative", alignItems: "center" }}>
            {Array.from({ length: 12 }, (_, i) => (
              <CoinParticle key={i} delay={i * 60} colors={particleColors} />
            ))}
            <Animated.View
              style={[
                styles.successCircle,
                {
                  backgroundColor: isScheduled ? COLORS.warning + "20" : COLORS.success + "20",
                  transform: [{ scale: pulseAnim }],
                },
              ]}
            >
              <View style={[styles.successInner, { backgroundColor: isScheduled ? COLORS.warning : COLORS.success }]}>
                <Ionicons name={isScheduled ? "calendar" : "checkmark"} size={36} color="#fff" />
              </View>
            </Animated.View>
          </View>
          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
            <Text style={[styles.successText, { color: colors.text, fontFamily: "Inter_700Bold" }]}>
              {isScheduled ? "Payment Scheduled!" : "Payment Sent!"}
            </Text>
            <Text style={[styles.successAmount, { color: isScheduled ? COLORS.warning : COLORS.success, fontFamily: "Inter_700Bold" }]}>
              ₹{Number(amount).toLocaleString("en-IN")}
            </Text>
          </Animated.View>
        </View>

        {/* Transfer visual */}
        {!isScheduled && (
          <Animated.View style={[styles.transferRow, { opacity: fadeAnim }]}>
            <View style={styles.transferPerson}>
              <View style={[styles.transferAvatar, { backgroundColor: COLORS.primary }]}>
                <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 14 }}>AK</Text>
              </View>
              <Text style={[styles.transferName, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>You</Text>
            </View>
            <View style={styles.transferArrows}>
              <View style={[styles.arrow, { backgroundColor: COLORS.primary }]}>
                <Ionicons name="arrow-forward" size={14} color="#fff" />
              </View>
              <View style={[styles.arrow, { backgroundColor: COLORS.primary + "60" }]}>
                <Ionicons name="arrow-forward" size={14} color="#fff" />
              </View>
              <View style={[styles.arrow, { backgroundColor: COLORS.primary + "30" }]}>
                <Ionicons name="arrow-forward" size={14} color="#fff" />
              </View>
            </View>
            <View style={styles.transferPerson}>
              <View style={[styles.transferAvatar, { backgroundColor: COLORS.success }]}>
                <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 14 }}>
                  {contactName.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                </Text>
              </View>
              <Text style={[styles.transferName, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>{contactName.split(" ")[0]}</Text>
            </View>
          </Animated.View>
        )}

        {/* Receipt Details */}
        <Animated.View style={[styles.receiptCard, { backgroundColor: colors.card, opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.dashedLine}>
            {Array.from({ length: 20 }, (_, i) => (
              <View key={i} style={[styles.dash, { backgroundColor: colors.border }]} />
            ))}
          </View>
          {[
            { label: "To", value: contactName },
            upiId ? { label: "UPI ID", value: upiId } : null,
            isScheduled ? { label: "Scheduled For", value: scheduledDate } : { label: "Date", value: new Date().toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) },
            { label: "Transaction ID", value: txnId },
            { label: "Status", value: isScheduled ? "Scheduled" : "Successful" },
          ].filter(Boolean).map((row) => (
            <View key={row!.label} style={styles.receiptRow}>
              <Text style={[styles.receiptKey, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>{row!.label}</Text>
              <Text style={[styles.receiptVal, { color: colors.text, fontFamily: "Inter_600SemiBold" }]} numberOfLines={1}>{row!.value}</Text>
            </View>
          ))}
          <View style={styles.dashedLine}>
            {Array.from({ length: 20 }, (_, i) => (
              <View key={i} style={[styles.dash, { backgroundColor: colors.border }]} />
            ))}
          </View>
          <View style={[styles.totalRow, { backgroundColor: colors.surface }]}>
            <Text style={[styles.totalLabel, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>Total Paid</Text>
            <Text style={[styles.totalAmt, { color: COLORS.primary, fontFamily: "Inter_700Bold" }]}>₹{Number(amount).toLocaleString("en-IN")}</Text>
          </View>
        </Animated.View>
      </ScrollView>

      {/* Action Buttons */}
      <View style={[styles.actions, { backgroundColor: colors.background, paddingBottom: insets.bottom || 24 }]}>
        <Pressable
          onPress={async () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            await Share.share({ message: `I sent ₹${amount} to ${contactName} via AwaazPe!\nTransaction ID: ${txnId}` });
          }}
          style={[styles.actionBtn, { backgroundColor: colors.card, flex: 1 }]}
        >
          <Feather name="share-2" size={18} color={colors.text} />
          <Text style={{ color: colors.text, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>Share</Text>
        </Pressable>
        <Pressable
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/(tabs)"); }}
          style={[styles.actionBtn, { backgroundColor: COLORS.primary, flex: 2 }]}
        >
          <Text style={{ color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 15 }}>Back to Home</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 10 },
  closeBtn: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 16 },
  successSection: { alignItems: "center", paddingVertical: 32, gap: 16 },
  successCircle: { width: 96, height: 96, borderRadius: 48, alignItems: "center", justifyContent: "center" },
  successInner: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center" },
  successText: { fontSize: 22, textAlign: "center", marginBottom: 6 },
  successAmount: { fontSize: 40, textAlign: "center", letterSpacing: -1 },
  transferRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: 20, gap: 16 },
  transferPerson: { alignItems: "center", gap: 8 },
  transferAvatar: { width: 52, height: 52, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  transferName: { fontSize: 12 },
  transferArrows: { flexDirection: "row", gap: 6 },
  arrow: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  receiptCard: { marginHorizontal: 20, borderRadius: 20, overflow: "hidden" },
  dashedLine: { flexDirection: "row", justifyContent: "center", flexWrap: "wrap", paddingVertical: 8 },
  dash: { width: 6, height: 1.5, marginHorizontal: 2 },
  receiptRow: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 12 },
  receiptKey: { fontSize: 13 },
  receiptVal: { fontSize: 13, maxWidth: "55%", textAlign: "right" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20 },
  totalLabel: { fontSize: 15 },
  totalAmt: { fontSize: 24, letterSpacing: -0.5 },
  actions: { position: "absolute", bottom: 0, left: 0, right: 0, flexDirection: "row", gap: 10, padding: 20, paddingTop: 12 },
  actionBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 14, borderRadius: 14, gap: 8 },
});
