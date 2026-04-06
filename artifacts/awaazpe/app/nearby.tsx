import { Feather, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS } from "@/constants/colors";
import { useTheme } from "@/context/ThemeContext";

const NEARBY_USERS = [
  { id: "n1", name: "Raj Mehta", upiId: "raj@gpay", distance: "3m away", color: "#6366F1" },
  { id: "n2", name: "Sanya Kapoor", upiId: "sanya@paytm", distance: "5m away", color: "#2196F3" },
  { id: "n3", name: "Dev Anand", upiId: "dev@upi", distance: "8m away", color: "#FF6D00" },
  { id: "n4", name: "Leena Shah", upiId: "leena@okaxis", distance: "12m away", color: "#F59E0B" },
];

function RadarPulse() {
  const rings = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];

  useEffect(() => {
    rings.forEach((ring, i) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 600),
          Animated.timing(ring, { toValue: 1, duration: 2000, easing: Easing.out(Easing.ease), useNativeDriver: true }),
          Animated.timing(ring, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      ).start();
    });
  }, []);

  return (
    <View style={styles.radarOuter}>
      {rings.map((ring, i) => (
        <Animated.View
          key={i}
          style={[
            styles.radarRing,
            {
              opacity: ring.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0.4, 0] }),
              transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }],
              borderColor: COLORS.primary,
            },
          ]}
        />
      ))}
      <View style={[styles.radarCenter, { backgroundColor: COLORS.primary + "20" }]}>
        <View style={[styles.radarCenterInner, { backgroundColor: COLORS.primary }]}>
          <Ionicons name="radio-outline" size={24} color="#fff" />
        </View>
      </View>
    </View>
  );
}

export default function NearbyScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [scanning, setScanning] = useState(true);
  const [users, setUsers] = useState<typeof NEARBY_USERS>([]);

  useEffect(() => {
    const t = setTimeout(() => {
      setScanning(false);
      setUsers(NEARBY_USERS);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }, 2200);
    return () => clearTimeout(t);
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: colors.card }]}>
          <Feather name="x" size={20} color={colors.text} />
        </Pressable>
        <Text style={[styles.title, { color: colors.text, fontFamily: "Inter_700Bold" }]}>Nearby Transfer</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.radarSection}>
        <RadarPulse />
        <Text style={[styles.scanStatus, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>
          {scanning ? "Scanning for nearby users…" : `Found ${users.length} people nearby`}
        </Text>
      </View>

      {!scanning && (
        <View style={styles.userList}>
          <Text style={[styles.listLabel, { color: colors.textSecondary, fontFamily: "Inter_500Medium" }]}>NEARBY PEOPLE</Text>
          {users.map((user, i) => (
            <Animated.View key={user.id}>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  router.push({ pathname: "/(tabs)/pay", params: {} });
                }}
                style={({ pressed }) => [
                  styles.userCard,
                  { backgroundColor: colors.card, opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
                ]}
              >
                <View style={[styles.userAvatar, { backgroundColor: user.color }]}>
                  <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 16 }}>
                    {user.name.split(" ").map((n) => n[0]).join("")}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.userName, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>{user.name}</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <View style={[styles.distanceDot, { backgroundColor: COLORS.success }]} />
                    <Text style={[styles.userDist, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>{user.distance}</Text>
                  </View>
                </View>
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    router.push("/(tabs)/pay" as any);
                  }}
                  style={[styles.payBtn, { backgroundColor: COLORS.primary }]}
                >
                  <Ionicons name="send" size={14} color="#fff" />
                  <Text style={{ color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 13 }}>Pay</Text>
                </Pressable>
              </Pressable>
            </Animated.View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 16 },
  backBtn: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 18 },
  radarSection: { alignItems: "center", paddingVertical: 30 },
  radarOuter: { width: 200, height: 200, alignItems: "center", justifyContent: "center" },
  radarRing: { position: "absolute", width: 200, height: 200, borderRadius: 100, borderWidth: 1.5 },
  radarCenter: { width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center" },
  radarCenterInner: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  scanStatus: { marginTop: 16, fontSize: 14 },
  userList: { paddingHorizontal: 20 },
  listLabel: { fontSize: 11, letterSpacing: 1, marginBottom: 12 },
  userCard: { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 16, marginBottom: 10, gap: 12 },
  userAvatar: { width: 48, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  userName: { fontSize: 15, marginBottom: 4 },
  userDist: { fontSize: 12 },
  distanceDot: { width: 6, height: 6, borderRadius: 3 },
  payBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10 },
});
