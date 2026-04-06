import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS } from "@/constants/colors";
import { useTheme } from "@/context/ThemeContext";
import { useApp } from "@/context/AppContext";

const FILTERS = ["All", "Sent", "Received", "Scheduled"];
const CATEGORIES = ["All", "Food", "Transport", "Shopping", "Entertainment", "Utilities", "Others"];

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { transactions, scheduledPayments } = useApp();
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("All");

  const filtered = transactions.filter((t) => {
    if (filter === "Sent" && t.type !== "sent") return false;
    if (filter === "Received" && t.type !== "received") return false;
    if (filter === "Scheduled") return false;
    if (catFilter !== "All" && t.category !== catFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      return t.contactName.toLowerCase().includes(s) || String(t.amount).includes(s);
    }
    return true;
  });

  const showScheduled = filter === "All" || filter === "Scheduled";

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.headerWrap, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 10) }]}>
        <Text style={[styles.title, { color: colors.text, fontFamily: "Inter_700Bold" }]}>History</Text>
        <View style={[styles.searchRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="search-outline" size={16} color={colors.textMuted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search transactions…"
            placeholderTextColor={colors.textMuted}
            style={[styles.searchInput, { color: colors.text, fontFamily: "Inter_400Regular" }]}
          />
        </View>
        <FlatList
          data={FILTERS}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item}
          contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setFilter(item); }}
              style={[
                styles.filterChip,
                { backgroundColor: filter === item ? COLORS.primary : colors.card, borderColor: filter === item ? COLORS.primary : colors.border },
              ]}
            >
              <Text style={{ color: filter === item ? "#fff" : colors.textSecondary, fontFamily: "Inter_500Medium", fontSize: 13 }}>{item}</Text>
            </Pressable>
          )}
        />
        <FlatList
          data={CATEGORIES}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item}
          contentContainerStyle={{ gap: 8, paddingBottom: 4 }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setCatFilter(item); }}
              style={[
                styles.catChip,
                { backgroundColor: catFilter === item ? colors.surface : "transparent" },
              ]}
            >
              <Text style={{ color: catFilter === item ? COLORS.primary : colors.textMuted, fontFamily: "Inter_400Regular", fontSize: 12 }}>{item}</Text>
            </Pressable>
          )}
        />
      </View>

      <FlatList
        data={[
          // Regular transactions first (newest at top), then upcoming scheduled payments
          ...filtered.map((t) => ({ ...t, _type: "txn" as const })),
          ...(showScheduled ? scheduledPayments.map((s) => ({ ...s, _type: "scheduled" as const })) : []),
        ]}
        keyExtractor={(item) => `${(item as any)._type ?? "txn"}_${item.id}`}
        extraData={transactions}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="receipt-outline" size={40} color={colors.textMuted} />
            <Text style={{ color: colors.textMuted, fontFamily: "Inter_400Regular", marginTop: 12 }}>No transactions found</Text>
          </View>
        }
        renderItem={({ item }) => {
          if (item._type === "scheduled") {
            const s = item as typeof scheduledPayments[0] & { _type: "scheduled" };
            const daysLeft = Math.ceil((new Date(s.date).getTime() - Date.now()) / 86400000);
            return (
              <View style={[styles.txnCard, { backgroundColor: colors.card }]}>
                <View style={[styles.txnIcon, { backgroundColor: COLORS.warning + "20" }]}>
                  <Ionicons name="calendar-outline" size={16} color={COLORS.warning} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.txnName, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>{s.contactName}</Text>
                  <Text style={[styles.txnMeta, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>
                    {s.date} · {s.recurring ? `${s.recurring}` : "one-time"} · in {daysLeft}d
                  </Text>
                </View>
                <Text style={[styles.txnAmt, { color: COLORS.warning, fontFamily: "Inter_600SemiBold" }]}>₹{s.amount}</Text>
              </View>
            );
          }
          const t = item as (typeof filtered[0]) & { _type: "txn" };
          return (
            <View style={[styles.txnCard, { backgroundColor: colors.card }]}>
              <View style={[styles.txnIcon, { backgroundColor: t.type === "sent" ? COLORS.danger + "20" : COLORS.success + "20" }]}>
                <Ionicons
                  name={t.type === "sent" ? "arrow-up" : "arrow-down"}
                  size={14}
                  color={t.type === "sent" ? COLORS.danger : COLORS.success}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.txnName, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>{t.contactName}</Text>
                <Text style={[styles.txnMeta, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>
                  {new Date(t.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} · {t.category}
                </Text>
              </View>
              <Text style={[styles.txnAmt, { color: t.type === "sent" ? COLORS.danger : COLORS.success, fontFamily: "Inter_600SemiBold" }]}>
                {t.type === "sent" ? "-" : "+"}₹{t.amount.toLocaleString("en-IN")}
              </Text>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerWrap: { paddingHorizontal: 20, paddingBottom: 8 },
  title: { fontSize: 28, letterSpacing: -0.5, marginBottom: 14 },
  searchRow: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, gap: 8, marginBottom: 12 },
  searchInput: { flex: 1, fontSize: 14 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  catChip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 16 },
  txnCard: { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 14, marginBottom: 8, gap: 12 },
  txnIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  txnName: { fontSize: 14, marginBottom: 2 },
  txnMeta: { fontSize: 12 },
  txnAmt: { fontSize: 14 },
  empty: { alignItems: "center", justifyContent: "center", paddingTop: 80 },
});
