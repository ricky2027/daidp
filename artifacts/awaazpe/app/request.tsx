import { Feather, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
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
import { useApp } from "@/context/AppContext";

export default function RequestScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { contacts } = useApp();
  const [selectedContact, setSelectedContact] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [sent, setSent] = useState(false);

  const handleSend = () => {
    if (!selectedContact || !amount) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSent(true);
  };

  const contact = contacts.find((c) => c.id === selectedContact);

  if (sent) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <Pressable onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: colors.card }]}>
            <Feather name="x" size={20} color={colors.text} />
          </Pressable>
          <Text style={[styles.title, { color: colors.text, fontFamily: "Inter_700Bold" }]}>Request Sent</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.successContainer}>
          <View style={[styles.successCircle, { backgroundColor: COLORS.success + "20" }]}>
            <View style={[styles.successInner, { backgroundColor: COLORS.success }]}>
              <Ionicons name="checkmark" size={36} color="#fff" />
            </View>
          </View>
          <Text style={[styles.successTitle, { color: colors.text, fontFamily: "Inter_700Bold" }]}>Request Sent!</Text>
          <Text style={[styles.successSub, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>
            You requested ₹{amount} from {contact?.name}
          </Text>
          <Text style={[styles.successNote, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>
            They'll receive a notification and can pay with one tap.
          </Text>
          <Pressable onPress={() => router.push("/(tabs)")} style={[styles.doneBtn, { backgroundColor: COLORS.primary }]}>
            <Text style={{ color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 15 }}>Back to Home</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: colors.card }]}>
          <Feather name="x" size={20} color={colors.text} />
        </Pressable>
        <Text style={[styles.title, { color: colors.text, fontFamily: "Inter_700Bold" }]}>Request Money</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        <Text style={[styles.label, { color: colors.textSecondary, fontFamily: "Inter_500Medium" }]}>From</Text>
        {contacts.map((c) => (
          <Pressable
            key={c.id}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSelectedContact(c.id); }}
            style={[
              styles.contactRow,
              {
                backgroundColor: colors.card,
                borderColor: selectedContact === c.id ? COLORS.primary : colors.border,
                borderWidth: selectedContact === c.id ? 2 : 1,
              },
            ]}
          >
            <View style={[styles.avatar, { backgroundColor: c.color }]}>
              <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 14 }}>{c.initials}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.contactName, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>{c.name}</Text>
              <Text style={[styles.contactUpi, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>{c.upiId}</Text>
            </View>
            {selectedContact === c.id && (
              <View style={[styles.checkBadge, { backgroundColor: COLORS.primary }]}>
                <Feather name="check" size={14} color="#fff" />
              </View>
            )}
          </Pressable>
        ))}

        <Text style={[styles.label, { color: colors.textSecondary, fontFamily: "Inter_500Medium", marginTop: 16 }]}>Amount</Text>
        <View style={[styles.inputRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.rupee, { color: colors.textSecondary, fontFamily: "Inter_600SemiBold" }]}>₹</Text>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor={colors.textMuted}
            style={[styles.amtInput, { color: colors.text, fontFamily: "Inter_700Bold" }]}
          />
        </View>

        <Text style={[styles.label, { color: colors.textSecondary, fontFamily: "Inter_500Medium" }]}>Note</Text>
        <View style={[styles.inputRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="What is this for?"
            placeholderTextColor={colors.textMuted}
            style={[styles.noteInput, { color: colors.text, fontFamily: "Inter_400Regular" }]}
          />
        </View>
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom || 20 }]}>
        <Pressable
          onPress={handleSend}
          disabled={!selectedContact || !amount}
          style={({ pressed }) => [
            styles.sendBtn,
            {
              backgroundColor: !selectedContact || !amount ? colors.surface : COLORS.primary,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Ionicons name="arrow-down-circle" size={18} color="#fff" />
          <Text style={{ color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 16 }}>
            {selectedContact && amount ? `Request ₹${amount}` : "Request Money"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 16 },
  backBtn: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 18 },
  label: { fontSize: 11, letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 },
  contactRow: { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 14, marginBottom: 8, gap: 12 },
  avatar: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  contactName: { fontSize: 14, marginBottom: 2 },
  contactUpi: { fontSize: 12 },
  checkBadge: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  inputRow: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, marginBottom: 14, flexDirection: "row", alignItems: "center" },
  rupee: { fontSize: 22, marginRight: 4 },
  amtInput: { flex: 1, fontSize: 28, paddingVertical: 14 },
  noteInput: { flex: 1, fontSize: 15, paddingVertical: 14 },
  bottomBar: { position: "absolute", bottom: 0, left: 0, right: 0, paddingHorizontal: 20, paddingTop: 12, backgroundColor: "transparent" },
  sendBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 16, borderRadius: 16, gap: 8 },
  successContainer: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 16 },
  successCircle: { width: 96, height: 96, borderRadius: 48, alignItems: "center", justifyContent: "center" },
  successInner: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center" },
  successTitle: { fontSize: 26 },
  successSub: { fontSize: 15, textAlign: "center" },
  successNote: { fontSize: 13, textAlign: "center", lineHeight: 18 },
  doneBtn: { paddingVertical: 14, paddingHorizontal: 48, borderRadius: 14, marginTop: 8 },
});
