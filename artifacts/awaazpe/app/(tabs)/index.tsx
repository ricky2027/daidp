import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS } from "@/constants/colors";
import { useTheme } from "@/context/ThemeContext";
import { useApp, MOCK_CONTACTS, PROFILES } from "@/context/AppContext";

const BASE_URL =
  process.env.EXPO_PUBLIC_DOMAIN
    ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
    : process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";

async function playTTSNotification(text: string, language: string) {
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

function ScheduledPaymentToast({
  contactName, amount, onDismiss,
}: {
  contactName: string; amount: number; onDismiss: () => void;
}) {
  const slideY = useRef(new Animated.Value(-100)).current;
  const { colors } = useTheme();

  useEffect(() => {
    Animated.spring(slideY, { toValue: 0, tension: 60, friction: 8, useNativeDriver: true }).start();
    const t = setTimeout(() => {
      Animated.timing(slideY, { toValue: -120, duration: 300, useNativeDriver: true }).start(onDismiss);
    }, 4000);
    return () => clearTimeout(t);
  }, []);

  return (
    <Animated.View style={[toastStyles.container, { backgroundColor: colors.card, transform: [{ translateY: slideY }], top: 60 }]}>
      <View style={[toastStyles.icon, { backgroundColor: COLORS.warning + "20" }]}>
        <Ionicons name="arrow-up" size={18} color={COLORS.warning} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[toastStyles.title, { color: colors.text, fontFamily: "Inter_700Bold" }]}>
          ₹{amount.toLocaleString("en-IN")} sent!
        </Text>
        <Text style={[toastStyles.sub, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>
          Scheduled payment to {contactName.split(" ")[0]}
        </Text>
      </View>
      <Pressable onPress={onDismiss}>
        <Feather name="x" size={16} color={colors.textMuted} />
      </Pressable>
    </Animated.View>
  );
}

function IncomingPaymentToast({
  sender, amount, onDismiss,
}: {
  sender: string; amount: number; onDismiss: () => void;
}) {
  const slideY = useRef(new Animated.Value(-100)).current;
  const { colors } = useTheme();

  useEffect(() => {
    Animated.spring(slideY, { toValue: 0, tension: 60, friction: 8, useNativeDriver: true }).start();
    const t = setTimeout(() => {
      Animated.timing(slideY, { toValue: -120, duration: 300, useNativeDriver: true }).start(onDismiss);
    }, 4000);
    return () => clearTimeout(t);
  }, []);

  return (
    <Animated.View style={[toastStyles.container, { backgroundColor: colors.card, transform: [{ translateY: slideY }] }]}>
      <View style={[toastStyles.icon, { backgroundColor: COLORS.success + "20" }]}>
        <Ionicons name="arrow-down" size={18} color={COLORS.success} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[toastStyles.title, { color: colors.text, fontFamily: "Inter_700Bold" }]}>
          ₹{amount.toLocaleString("en-IN")} received!
        </Text>
        <Text style={[toastStyles.sub, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>
          from {sender} via UPI
        </Text>
      </View>
      <Pressable onPress={onDismiss}>
        <Feather name="x" size={16} color={colors.textMuted} />
      </Pressable>
    </Animated.View>
  );
}

const toastStyles = StyleSheet.create({
  container: {
    position: "absolute", top: 0, left: 16, right: 16, zIndex: 999,
    flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 16,
    gap: 12, shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }, elevation: 10,
  },
  icon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 15 },
  sub: { fontSize: 12, marginTop: 1 },
});

function SonarAnimation() {
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animate = (val: Animated.Value, delay: number) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(val, { toValue: 1, duration: 1800, easing: Easing.out(Easing.ease), useNativeDriver: true }),
          Animated.timing(val, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      ).start();
    };
    animate(ring1, 0);
    animate(ring2, 900);
  }, []);

  const ringStyle = (val: Animated.Value) => ({
    ...StyleSheet.absoluteFillObject,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    opacity: val.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }),
    transform: [{ scale: val.interpolate({ inputRange: [0, 1], outputRange: [1, 2.5] }) }],
  });

  return (
    <View style={styles.sonarContainer}>
      <Animated.View style={ringStyle(ring1)} />
      <Animated.View style={ringStyle(ring2)} />
      <View style={[styles.sonarCenter, { backgroundColor: COLORS.primary + "20" }]}>
        <Ionicons name="radio-outline" size={20} color={COLORS.primary} />
      </View>
    </View>
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { balance, balanceVisible, setBalanceVisible, transactions, paymentRequests, contacts, respondToRequest, addTransaction, language, totalSent, totalReceived, lastExecutedSchedule, clearLastExecutedSchedule, currentProfile, switchProfile, incomingP2PPayment, clearIncomingP2PPayment } = useApp();
  const [greeting, setGreeting] = useState("Good Morning");
  const [incomingPayment, setIncomingPayment] = useState<{ sender: string; amount: number } | null>(null);

  // Play TTS when a scheduled payment executes
  useEffect(() => {
    if (!lastExecutedSchedule) return;
    playTTSNotification(
      `Scheduled payment of rupees ${lastExecutedSchedule.amount} sent to ${lastExecutedSchedule.contactName.split(" ")[0]}`,
      language
    );
  }, [lastExecutedSchedule]);

  // Play TTS when a real P2P payment arrives
  useEffect(() => {
    if (!incomingP2PPayment) return;
    playTTSNotification(
      `You received rupees ${incomingP2PPayment.amount} from ${incomingP2PPayment.sender.split(" ")[0]}`,
      language
    );
  }, [incomingP2PPayment]);

  useEffect(() => {
    const h = new Date().getHours();
    if (h < 12) setGreeting("Good Morning");
    else if (h < 17) setGreeting("Good Afternoon");
    else setGreeting("Good Evening");
  }, []);

  const simulateReceive = () => {
    const senders = ["Rahul Sharma", "Priya Patel", "Ankit Kumar", "Vikram Singh"];
    const sender = senders[Math.floor(Math.random() * senders.length)];
    const amount = [200, 500, 750, 1200, 1500][Math.floor(Math.random() * 5)];
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    addTransaction({
      id: `txn_in_${Date.now()}`,
      type: "received",
      amount,
      contactId: "demo",
      contactName: sender,
      date: new Date().toISOString(),
      note: "UPI payment",
      category: "Others",
      status: "completed",
      transactionId: `TXN${Date.now()}`,
    });
    setIncomingPayment({ sender, amount });
    playTTSNotification(`You received rupees ${amount} from ${sender.split(" ")[0]}`, language);
  };

  const pendingRequests = paymentRequests.filter((r) => r.status === "pending");
  const recentTxns = transactions.slice(0, 8);

  const quickActions = [
    { icon: "mic-outline" as const, label: "Voice Pay", color: COLORS.primary, route: "/(tabs)/pay" },
    { icon: "calendar-outline" as const, label: "Schedule", color: COLORS.success, route: "/(tabs)/pay?scheduleMode=true" },
    { icon: "people-outline" as const, label: "Split", color: COLORS.warning, route: "/split" },
    { icon: "arrow-down-circle-outline" as const, label: "Request", color: COLORS.danger, route: "/request" },
  ];

  const topPad = insets.top + (Platform.OS === "web" ? 20 : 0);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Simulated incoming payment toast */}
      {incomingPayment && (
        <IncomingPaymentToast
          sender={incomingPayment.sender}
          amount={incomingPayment.amount}
          onDismiss={() => setIncomingPayment(null)}
        />
      )}

      {/* Real P2P incoming payment toast (from another tab/profile) */}
      {incomingP2PPayment && !incomingPayment && (
        <IncomingPaymentToast
          sender={incomingP2PPayment.sender}
          amount={incomingP2PPayment.amount}
          onDismiss={clearIncomingP2PPayment}
        />
      )}

      {/* Scheduled payment executed toast */}
      {lastExecutedSchedule && (
        <ScheduledPaymentToast
          contactName={lastExecutedSchedule.contactName}
          amount={lastExecutedSchedule.amount}
          onDismiss={clearLastExecutedSchedule}
        />
      )}

      <ScrollView
        contentContainerStyle={{ paddingTop: topPad + (insets.top > 0 ? 0 : 8), paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.greeting, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>{greeting}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={[styles.userName, { color: colors.text, fontFamily: "Inter_700Bold" }]}>{currentProfile.name}</Text>
              {/* Profile switcher — shows the other profile to switch to */}
              {PROFILES.filter((p) => p.id !== currentProfile.id).map((p) => (
                <Pressable
                  key={p.id}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); switchProfile(p.id); }}
                  style={[styles.profileSwitchBtn, { backgroundColor: p.color + "20", borderColor: p.color + "50" }]}
                >
                  <View style={[styles.profileSwitchAvatar, { backgroundColor: p.color }]}>
                    <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 9 }}>{p.initials}</Text>
                  </View>
                  <Text style={{ color: p.color, fontFamily: "Inter_600SemiBold", fontSize: 11 }}>Switch</Text>
                </Pressable>
              ))}
            </View>
          </View>
          <Pressable
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/qr"); }}
            style={[styles.qrBtn, { backgroundColor: colors.card }]}
          >
            <MaterialCommunityIcons name="qrcode-scan" size={22} color={colors.text} />
          </Pressable>
        </View>

        {/* Balance Card */}
        <View style={[styles.balanceCard, { backgroundColor: COLORS.primary }]}>
          <View style={styles.balanceHeader}>
            <Text style={[styles.balanceLabel, { fontFamily: "Inter_500Medium" }]}>Total Balance</Text>
            <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setBalanceVisible(!balanceVisible); }}>
              <Ionicons name={balanceVisible ? "eye-off-outline" : "eye-outline"} size={20} color="rgba(255,255,255,0.7)" />
            </Pressable>
          </View>
          <Text style={[styles.balanceAmount, { fontFamily: "Inter_700Bold" }]}>
            {balanceVisible ? `₹${balance.toLocaleString("en-IN")}` : "••••••"}
          </Text>
          <View style={styles.balanceMeta}>
            <View style={styles.balanceStatItem}>
              <Ionicons name="arrow-up-outline" size={14} color="rgba(255,255,255,0.7)" />
              <Text style={[styles.balanceStatText, { fontFamily: "Inter_400Regular" }]}>₹{totalSent.toLocaleString("en-IN")} Sent</Text>
            </View>
            <View style={styles.balanceDivider} />
            <View style={styles.balanceStatItem}>
              <Ionicons name="arrow-down-outline" size={14} color="rgba(255,255,255,0.7)" />
              <Text style={[styles.balanceStatText, { fontFamily: "Inter_400Regular" }]}>₹{totalReceived.toLocaleString("en-IN")} Received</Text>
            </View>
          </View>
          <Text style={[styles.upiId, { fontFamily: "Inter_400Regular" }]}>{currentProfile.upiId}</Text>
        </View>

        {/* Payment Requests */}
        {pendingRequests.length > 0 && (
          <View style={{ marginHorizontal: 20, marginBottom: 16 }}>
            <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: "Inter_600SemiBold", marginBottom: 10 }]}>
              Requests ({pendingRequests.length})
            </Text>
            {pendingRequests.map((req) => (
              <View key={req.id} style={[styles.requestCard, { backgroundColor: colors.card }]}>
                <View style={[styles.reqAvatar, { backgroundColor: COLORS.warning + "20" }]}>
                  <Ionicons name="person" size={16} color={COLORS.warning} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.reqName, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>{req.fromContactName}</Text>
                  <Text style={[styles.reqNote, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>{req.note}</Text>
                </View>
                <Text style={[styles.reqAmount, { color: colors.text, fontFamily: "Inter_700Bold" }]}>₹{req.amount}</Text>
                <View style={styles.reqActions}>
                  <Pressable
                    onPress={() => {
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                      respondToRequest(req.id, true);
                      addTransaction({
                        id: `txn_req_${req.id}`,
                        type: "sent",
                        amount: req.amount,
                        contactId: req.fromContactId,
                        contactName: req.fromContactName,
                        date: new Date().toISOString(),
                        note: req.note,
                        category: "Others",
                        status: "completed",
                        transactionId: `TXN${Date.now()}`,
                      });
                    }}
                    style={[styles.reqBtn, { backgroundColor: COLORS.success }]}
                  >
                    <Feather name="check" size={14} color="#fff" />
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      respondToRequest(req.id, false);
                    }}
                    style={[styles.reqBtn, { backgroundColor: colors.surface }]}
                  >
                    <Feather name="x" size={14} color={colors.textSecondary} />
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Quick Contacts */}
        <View style={{ marginBottom: 16 }}>
          <View style={[styles.sectionHeader, { paddingHorizontal: 20 }]}>
            <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>Quick Pay</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 4 }}>
            {contacts.map((c) => (
              <Pressable
                key={c.id}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push({ pathname: "/(tabs)/pay", params: { prefillContact: c.id } });
                }}
                style={styles.avatarContainer}
              >
                <View style={[styles.avatar, { backgroundColor: c.color }]}>
                  <Text style={styles.avatarInitials}>{c.initials}</Text>
                </View>
                <Text style={[styles.avatarName, { color: colors.textSecondary }]} numberOfLines={1}>
                  {c.name.split(" ")[0]}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* Quick Actions */}
        <View style={{ marginHorizontal: 20, marginBottom: 20 }}>
          <View style={styles.actionsGrid}>
            {quickActions.map((action) => (
              <Pressable
                key={action.label}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push(action.route as any);
                }}
                style={({ pressed }) => [
                  styles.actionCard,
                  { backgroundColor: colors.card, opacity: pressed ? 0.8 : 1, transform: [{ scale: pressed ? 0.96 : 1 }] },
                ]}
              >
                <View style={[styles.actionIcon, { backgroundColor: action.color + "20" }]}>
                  <Ionicons name={action.icon} size={22} color={action.color} />
                </View>
                <Text style={[styles.actionLabel, { color: colors.text, fontFamily: "Inter_500Medium" }]}>{action.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Simulate Receive — demo row */}
        <Pressable
          onPress={simulateReceive}
          style={({ pressed }) => [
            styles.demoBtn,
            { backgroundColor: COLORS.success + "15", marginHorizontal: 20, opacity: pressed ? 0.8 : 1, borderColor: COLORS.success + "30" },
          ]}
        >
          <View style={[styles.demoBtnIcon, { backgroundColor: COLORS.success + "20" }]}>
            <Ionicons name="arrow-down-circle" size={20} color={COLORS.success} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.demoBtnTitle, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>Simulate Incoming Payment</Text>
            <Text style={[styles.demoBtnSub, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>
              See how receiving money looks + hear voice alert
            </Text>
          </View>
          <Ionicons name="play-circle-outline" size={22} color={COLORS.success} />
        </Pressable>

        {/* Nearby Button */}
        <Pressable
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push("/nearby"); }}
          style={({ pressed }) => [styles.nearbyBtn, { backgroundColor: colors.card, marginHorizontal: 20, opacity: pressed ? 0.8 : 1 }]}
        >
          <SonarAnimation />
          <View style={{ flex: 1 }}>
            <Text style={[styles.nearbyTitle, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>Pay Nearby</Text>
            <Text style={[styles.nearbySub, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>Find people around you</Text>
          </View>
          <Feather name="chevron-right" size={18} color={colors.textMuted} />
        </Pressable>

        {/* Recent Transactions */}
        <View style={{ marginTop: 20, marginHorizontal: 20 }}>
          <View style={[styles.sectionHeader, { marginBottom: 12 }]}>
            <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>Recent</Text>
            <Pressable onPress={() => router.push("/(tabs)/history")}>
              <Text style={{ color: COLORS.primary, fontFamily: "Inter_500Medium", fontSize: 13 }}>See all</Text>
            </Pressable>
          </View>
          {recentTxns.map((txn) => (
            <View key={txn.id} style={[styles.txnRow, { backgroundColor: colors.card }]}>
              <View style={[styles.txnAvatar, { backgroundColor: txn.type === "sent" ? COLORS.danger + "20" : COLORS.success + "20" }]}>
                <Ionicons name={txn.type === "sent" ? "arrow-up" : "arrow-down"} size={14} color={txn.type === "sent" ? COLORS.danger : COLORS.success} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.txnName, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>{txn.contactName}</Text>
                <Text style={[styles.txnDate, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>
                  {new Date(txn.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} · {txn.category}
                </Text>
              </View>
              <Text style={[styles.txnAmount, { color: txn.type === "sent" ? COLORS.danger : COLORS.success, fontFamily: "Inter_600SemiBold" }]}>
                {txn.type === "sent" ? "-" : "+"}₹{txn.amount.toLocaleString("en-IN")}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, marginBottom: 16 },
  greeting: { fontSize: 13 },
  userName: { fontSize: 22, letterSpacing: -0.5 },
  profileSwitchBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  profileSwitchAvatar: { width: 16, height: 16, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  qrBtn: { width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  balanceCard: { marginHorizontal: 20, borderRadius: 20, padding: 20, marginBottom: 20 },
  balanceHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  balanceLabel: { color: "rgba(255,255,255,0.7)", fontSize: 13 },
  balanceAmount: { color: "#fff", fontSize: 36, letterSpacing: -1, marginBottom: 12 },
  balanceMeta: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  balanceStatItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  balanceDivider: { width: 1, height: 12, backgroundColor: "rgba(255,255,255,0.3)", marginHorizontal: 12 },
  balanceStatText: { color: "rgba(255,255,255,0.7)", fontSize: 12 },
  upiId: { color: "rgba(255,255,255,0.5)", fontSize: 11 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionTitle: { fontSize: 16 },
  avatarContainer: { alignItems: "center", width: 60, marginRight: 6 },
  avatar: { width: 52, height: 52, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  avatarInitials: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 16 },
  avatarName: { fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "center", marginTop: 4 },
  actionsGrid: { flexDirection: "row", gap: 10 },
  actionCard: { flex: 1, alignItems: "center", padding: 14, borderRadius: 16, gap: 8 },
  actionIcon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  actionLabel: { fontSize: 12 },
  demoBtn: { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 16, gap: 12, marginBottom: 12, borderWidth: 1 },
  demoBtnIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  demoBtnTitle: { fontSize: 14, marginBottom: 2 },
  demoBtnSub: { fontSize: 12 },
  nearbyBtn: { flexDirection: "row", alignItems: "center", padding: 16, borderRadius: 16, gap: 12 },
  sonarContainer: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  sonarCenter: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  nearbyTitle: { fontSize: 14 },
  nearbySub: { fontSize: 12 },
  txnRow: { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 14, marginBottom: 8, gap: 12 },
  txnAvatar: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  txnName: { fontSize: 14, marginBottom: 2 },
  txnDate: { fontSize: 12 },
  txnAmount: { fontSize: 14 },
  requestCard: { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 14, marginBottom: 8, gap: 10 },
  reqAvatar: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  reqName: { fontSize: 14, marginBottom: 2 },
  reqNote: { fontSize: 12 },
  reqAmount: { fontSize: 15, marginRight: 8 },
  reqActions: { flexDirection: "row", gap: 8 },
  reqBtn: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
});