import { Feather, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS } from "@/constants/colors";
import { useTheme } from "@/context/ThemeContext";
import { useApp, MOCK_CONTACTS } from "@/context/AppContext";

export default function SplitScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { contacts, addTransaction } = useApp();
  const [selected, setSelected] = useState<string[]>([]);
  const [total, setTotal] = useState("");
  const [note, setNote] = useState("");
  const [sent, setSent] = useState<string[]>([]);

  const perPerson = selected.length > 0 && total ? Math.ceil(Number(total) / selected.length) : 0;

  const toggleContact = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelected((prev) => prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]);
  };

  const handleSendAll = () => {
    if (!perPerson || selected.length === 0) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    selected.forEach((id) => {
      const c = contacts.find((c) => c.id === id)!;
      addTransaction({
        id: `txn_split_${Date.now()}_${id}`,
        type: "sent",
        amount: perPerson,
        contactId: c.id,
        contactName: c.name,
        date: new Date().toISOString(),
        note: note || "Split payment",
        category: "Others",
        status: "completed",
        transactionId: `TXN${Date.now()}${id}`,
      });
    });
    setSent(selected);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: colors.card }]}>
          <Feather name="x" size={20} color={colors.text} />
        </Pressable>
        <Text style={[styles.title, { color: colors.text, fontFamily: "Inter_700Bold" }]}>Split Payment</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        {/* Total Amount */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.textSecondary, fontFamily: "Inter_500Medium" }]}>Total Amount</Text>
          <View style={[styles.inputRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.rupee, { color: colors.textSecondary, fontFamily: "Inter_600SemiBold" }]}>₹</Text>
            <TextInput
              value={total}
              onChangeText={setTotal}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={colors.textMuted}
              style={[styles.amtInput, { color: colors.text, fontFamily: "Inter_700Bold" }]}
            />
          </View>
          <View style={[styles.inputRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Add note (optional)"
              placeholderTextColor={colors.textMuted}
              style={[styles.noteInput, { color: colors.text, fontFamily: "Inter_400Regular" }]}
            />
          </View>
        </View>

        {/* Select People */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.textSecondary, fontFamily: "Inter_500Medium" }]}>
            Select People ({selected.length} selected)
          </Text>
          {contacts.map((c) => {
            const isSel = selected.includes(c.id);
            const wasSent = sent.includes(c.id);
            return (
              <Pressable
                key={c.id}
                onPress={() => toggleContact(c.id)}
                style={[styles.contactRow, { backgroundColor: colors.card, borderColor: isSel ? COLORS.primary : colors.border }]}
              >
                <View style={[styles.avatar, { backgroundColor: c.color }]}>
                  <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 14 }}>{c.initials}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.contactName, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>{c.name}</Text>
                  <Text style={[styles.contactUpi, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>{c.upiId}</Text>
                </View>
                {isSel && perPerson > 0 && (
                  <Text style={[styles.share, { color: COLORS.primary, fontFamily: "Inter_700Bold" }]}>₹{perPerson}</Text>
                )}
                {wasSent && <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />}
                {!wasSent && (
                  <View style={[styles.checkbox, { backgroundColor: isSel ? COLORS.primary : colors.surface, borderColor: isSel ? COLORS.primary : colors.border }]}>
                    {isSel && <Feather name="check" size={14} color="#fff" />}
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {/* Bottom Bar */}
      {sent.length > 0 ? (
        <View style={[styles.bottomBar, { backgroundColor: colors.background, paddingBottom: insets.bottom || 20 }]}>
          <View style={[styles.successRow, { backgroundColor: COLORS.success + "20" }]}>
            <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
            <Text style={{ color: COLORS.success, fontFamily: "Inter_600SemiBold", fontSize: 15 }}>
              Split sent to {sent.length} people!
            </Text>
          </View>
          <Pressable onPress={() => router.back()} style={[styles.doneBtn, { backgroundColor: colors.card }]}>
            <Text style={{ color: colors.text, fontFamily: "Inter_600SemiBold", fontSize: 15 }}>Done</Text>
          </Pressable>
        </View>
      ) : (
        <View style={[styles.bottomBar, { backgroundColor: colors.background, paddingBottom: insets.bottom || 20 }]}>
          {selected.length > 0 && perPerson > 0 && (
            <View style={[styles.splitSummary, { backgroundColor: colors.card }]}>
              <Text style={{ color: colors.textSecondary, fontFamily: "Inter_400Regular", fontSize: 13 }}>
                ₹{total} ÷ {selected.length} people
              </Text>
              <Text style={{ color: COLORS.primary, fontFamily: "Inter_700Bold", fontSize: 18 }}>₹{perPerson} each</Text>
            </View>
          )}
          <Pressable
            onPress={handleSendAll}
            disabled={selected.length === 0 || !total}
            style={({ pressed }) => [
              styles.sendBtn,
              { backgroundColor: selected.length === 0 || !total ? colors.surface : COLORS.primary, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Ionicons name="send" size={18} color="#fff" />
            <Text style={{ color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 16 }}>
              {selected.length > 0 ? `Send ₹${perPerson} to ${selected.length} people` : "Select people"}
            </Text>
          </Pressable>
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
  section: { paddingHorizontal: 20, marginBottom: 16 },
  label: { fontSize: 11, letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 },
  inputRow: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, marginBottom: 10, flexDirection: "row", alignItems: "center" },
  rupee: { fontSize: 22, marginRight: 4 },
  amtInput: { flex: 1, fontSize: 28, paddingVertical: 14 },
  noteInput: { flex: 1, fontSize: 15, paddingVertical: 14 },
  contactRow: { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 14, marginBottom: 8, gap: 12, borderWidth: 1.5 },
  avatar: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  contactName: { fontSize: 14, marginBottom: 2 },
  contactUpi: { fontSize: 12 },
  share: { fontSize: 16, marginRight: 6 },
  checkbox: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  bottomBar: { position: "absolute", bottom: 0, left: 0, right: 0, paddingHorizontal: 20, paddingTop: 12, gap: 10 },
  splitSummary: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 14, borderRadius: 14 },
  sendBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 16, borderRadius: 16, gap: 8 },
  successRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 14, borderRadius: 14 },
  doneBtn: { paddingVertical: 16, borderRadius: 16, alignItems: "center" },
});
