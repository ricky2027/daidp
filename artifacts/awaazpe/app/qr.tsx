import { Feather, Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import QRCode from "react-native-qrcode-svg";
import React, { useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS } from "@/constants/colors";
import { useTheme } from "@/context/ThemeContext";
import { useApp } from "@/context/AppContext";

export default function QRScreen() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { contacts } = useApp();
  const [mode, setMode] = useState<"my" | "scan">("my");
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState<string | null>(null);
  const upiId = "aditya.kumar@upi";

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setScanned(data);
  };

  const handlePayScanned = () => {
    if (!scanned) return;
    const upiMatch = scanned.match(/pa=([^&]+)/);
    const upi = upiMatch ? upiMatch[1] : scanned;
    const contact = contacts.find((c) => c.upiId === upi);
    router.push({
      pathname: "/(tabs)/pay",
      params: contact ? { prefillContact: contact.id } : {},
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: colors.card }]}>
          <Feather name="x" size={20} color={colors.text} />
        </Pressable>
        <Text style={[styles.title, { color: colors.text, fontFamily: "Inter_700Bold" }]}>QR Code</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Mode Toggle */}
      <View style={[styles.modeToggle, { backgroundColor: colors.card }]}>
        <Pressable
          onPress={() => setMode("my")}
          style={[styles.modeBtn, { backgroundColor: mode === "my" ? COLORS.primary : "transparent" }]}
        >
          <Text style={{ color: mode === "my" ? "#fff" : colors.textSecondary, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>My QR</Text>
        </Pressable>
        <Pressable
          onPress={async () => {
            if (!permission?.granted) await requestPermission();
            setMode("scan");
            setScanned(null);
          }}
          style={[styles.modeBtn, { backgroundColor: mode === "scan" ? COLORS.primary : "transparent" }]}
        >
          <Text style={{ color: mode === "scan" ? "#fff" : colors.textSecondary, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>Scan</Text>
        </Pressable>
      </View>

      {mode === "my" ? (
        <View style={styles.myQRSection}>
          <View style={[styles.qrCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.qrName, { color: colors.text, fontFamily: "Inter_700Bold" }]}>Aditya Kumar</Text>
            <Text style={[styles.qrUpi, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>{upiId}</Text>
            <View style={[styles.qrFrame, { backgroundColor: "#fff", borderColor: colors.border }]}>
              <QRCode
                value={`upi://pay?pa=${upiId}&pn=Aditya Kumar`}
                size={220}
                color="#0F1117"
                backgroundColor="#fff"
              />
            </View>
            <View style={[styles.qrBadge, { backgroundColor: COLORS.primary + "20" }]}>
              <Ionicons name="shield-checkmark" size={14} color={COLORS.primary} />
              <Text style={{ color: COLORS.primary, fontFamily: "Inter_500Medium", fontSize: 12 }}>Verified UPI ID</Text>
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.scanSection}>
          {permission?.granted ? (
            scanned ? (
              <View style={[styles.scannedCard, { backgroundColor: colors.card }]}>
                <View style={[styles.scanSuccess, { backgroundColor: COLORS.success + "20" }]}>
                  <Ionicons name="checkmark-circle" size={40} color={COLORS.success} />
                </View>
                <Text style={[styles.scannedTitle, { color: colors.text, fontFamily: "Inter_700Bold" }]}>QR Scanned!</Text>
                <Text style={[styles.scannedUpi, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>{scanned}</Text>
                <Pressable
                  onPress={handlePayScanned}
                  style={[styles.payNowBtn, { backgroundColor: COLORS.primary }]}
                >
                  <Ionicons name="send" size={16} color="#fff" />
                  <Text style={{ color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 15 }}>Pay Now</Text>
                </Pressable>
                <Pressable onPress={() => setScanned(null)} style={styles.rescanBtn}>
                  <Text style={{ color: colors.textSecondary, fontFamily: "Inter_400Regular", fontSize: 13 }}>Scan Again</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.cameraWrap}>
                <CameraView
                  style={styles.camera}
                  facing="back"
                  barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                  onBarcodeScanned={handleBarCodeScanned}
                />
                <View style={styles.scanOverlay}>
                  <View style={styles.scanFrame}>
                    <View style={[styles.corner, styles.cornerTL]} />
                    <View style={[styles.corner, styles.cornerTR]} />
                    <View style={[styles.corner, styles.cornerBL]} />
                    <View style={[styles.corner, styles.cornerBR]} />
                  </View>
                  <Text style={styles.scanHint}>Point at a UPI QR code</Text>
                </View>
              </View>
            )
          ) : (
            <View style={[styles.permCard, { backgroundColor: colors.card }]}>
              <Ionicons name="camera-outline" size={40} color={colors.textMuted} />
              <Text style={[styles.permText, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>Camera Access Needed</Text>
              <Pressable onPress={requestPermission} style={[styles.permBtn, { backgroundColor: COLORS.primary }]}>
                <Text style={{ color: "#fff", fontFamily: "Inter_600SemiBold" }}>Allow Camera</Text>
              </Pressable>
            </View>
          )}
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
  modeToggle: { flexDirection: "row", marginHorizontal: 20, borderRadius: 12, padding: 4, marginBottom: 20 },
  modeBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: "center" },
  myQRSection: { alignItems: "center", paddingHorizontal: 20 },
  qrCard: { padding: 24, borderRadius: 24, alignItems: "center", width: "100%", gap: 12 },
  qrName: { fontSize: 22, letterSpacing: -0.5 },
  qrUpi: { fontSize: 13 },
  qrFrame: { padding: 16, borderRadius: 16, borderWidth: 1 },
  qrBadge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  scanSection: { flex: 1, paddingHorizontal: 20 },
  cameraWrap: { flex: 1, borderRadius: 20, overflow: "hidden" },
  camera: { flex: 1 },
  scanOverlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  scanFrame: { width: 240, height: 240, position: "relative" },
  corner: { position: "absolute", width: 30, height: 30, borderColor: "#fff", borderWidth: 3 },
  cornerTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 8 },
  cornerTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 8 },
  cornerBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 8 },
  cornerBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 8 },
  scanHint: { color: "#fff", fontFamily: "Inter_400Regular", fontSize: 14, marginTop: 24, backgroundColor: "rgba(0,0,0,0.5)", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  scannedCard: { padding: 32, borderRadius: 24, alignItems: "center", gap: 12 },
  scanSuccess: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center" },
  scannedTitle: { fontSize: 22 },
  scannedUpi: { fontSize: 14 },
  payNowBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 14, paddingHorizontal: 32, borderRadius: 14, marginTop: 8 },
  rescanBtn: { paddingVertical: 10 },
  permCard: { padding: 32, borderRadius: 24, alignItems: "center", gap: 16 },
  permText: { fontSize: 17 },
  permBtn: { paddingVertical: 14, paddingHorizontal: 32, borderRadius: 14 },
});
