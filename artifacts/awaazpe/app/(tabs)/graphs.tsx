import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  Dimensions,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { BarChart, LineChart } from "react-native-chart-kit";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS } from "@/constants/colors";
import { useTheme } from "@/context/ThemeContext";
import { useApp } from "@/context/AppContext";

const { width } = Dimensions.get("window");
const CHART_WIDTH = width - 40;

const CATEGORY_COLORS = [
  COLORS.primary, COLORS.success, COLORS.warning,
  COLORS.danger, "#8B5CF6", "#EC4899",
];
const CATEGORY_NAMES = ["Food", "Transport", "Shopping", "Entertainment", "Utilities", "Others"];

function DonutChart({ data, lastCategory }: { data: { label: string; value: number; color: string }[]; lastCategory?: string | null }) {
  const total = data.reduce((sum, d) => sum + d.value, 0) || 1;
  return (
    <View style={styles.donutWrap}>
      <View style={styles.donutCenter}>
        <Text style={styles.donutTotal}>₹{(total / 1000).toFixed(1)}k</Text>
        <Text style={styles.donutLabel}>Total</Text>
      </View>
      {data.map((item) => {
        const isHighlighted = item.label === lastCategory;
        return (
          <View
            key={item.label}
            style={[
              styles.donutRow,
              isHighlighted && {
                backgroundColor: item.color + "18",
                borderRadius: 10,
                paddingHorizontal: 6,
                shadowColor: item.color,
                shadowOpacity: 0.7,
                shadowRadius: 10,
                shadowOffset: { width: 0, height: 0 },
                elevation: 5,
              },
            ]}
          >
            <View style={styles.donutLegendLeft}>
              <View style={[styles.donutDot, { backgroundColor: item.color }]} />
              <Text style={styles.donutItemLabel}>{item.label}</Text>
              {isHighlighted && (
                <View style={[styles.recentBadge, { backgroundColor: item.color + "30", borderColor: item.color }]}>
                  <Text style={{ color: item.color, fontSize: 9, fontFamily: "Inter_700Bold" }}>RECENT</Text>
                </View>
              )}
            </View>
            <View style={styles.donutBarWrap}>
              <View style={[styles.donutBar, { width: `${(item.value / total) * 100}%`, backgroundColor: item.color }]} />
            </View>
            <Text style={styles.donutItemVal}>₹{(item.value / 1000).toFixed(1)}k</Text>
          </View>
        );
      })}
    </View>
  );
}

export default function GraphsScreen() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { transactions, lastPaymentCategory } = useApp();
  const [tab, setTab] = useState<"monthly" | "weekly" | "category">("monthly");

  const categoryAmounts = React.useMemo(() => {
    const sentTxns = transactions.filter((t) => t.type === "sent");
    return CATEGORY_NAMES.map((name) =>
      sentTxns.filter((t) => t.category === name).reduce((s, t) => s + t.amount, 0)
    );
  }, [transactions]);

  const chartConfig = {
    backgroundGradientFrom: colors.card,
    backgroundGradientTo: colors.card,
    color: (opacity = 1) => `rgba(99, 102, 241, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(${isDark ? "255,255,255" : "15,17,23"}, ${opacity * 0.6})`,
    strokeWidth: 2,
    barPercentage: 0.6,
    useShadowColorFromDataset: false,
    propsForBackgroundLines: { strokeWidth: 0.5, stroke: colors.border },
  };

  const monthlyData = {
    labels: ["Oct", "Nov", "Dec", "Jan", "Feb", "Mar"],
    datasets: [{ data: [8200, 11400, 9800, 13200, 7600, 10500] }],
  };

  const weeklyData = {
    labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    datasets: [{
      data: [1200, 800, 2100, 600, 3400, 1800, 900],
      color: (opacity = 1) => `rgba(99, 102, 241, ${opacity})`,
      strokeWidth: 2,
    }],
  };

  const totalSent = transactions.filter((t) => t.type === "sent").reduce((sum, t) => sum + t.amount, 0);
  const totalReceived = transactions.filter((t) => t.type === "received").reduce((sum, t) => sum + t.amount, 0);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + (Platform.OS === "web" ? 67 : 10), paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text, fontFamily: "Inter_700Bold" }]}>Spending</Text>
        </View>

        {/* Summary Cards */}
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { backgroundColor: COLORS.success + "15" }]}>
            <Ionicons name="arrow-down-outline" size={18} color={COLORS.success} />
            <Text style={[styles.summaryLabel, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>Received</Text>
            <Text style={[styles.summaryAmt, { color: COLORS.success, fontFamily: "Inter_700Bold" }]}>₹{(totalReceived / 1000).toFixed(1)}k</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: COLORS.danger + "15" }]}>
            <Ionicons name="arrow-up-outline" size={18} color={COLORS.danger} />
            <Text style={[styles.summaryLabel, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>Sent</Text>
            <Text style={[styles.summaryAmt, { color: COLORS.danger, fontFamily: "Inter_700Bold" }]}>₹{(totalSent / 1000).toFixed(1)}k</Text>
          </View>
        </View>

        {/* Tab Switcher */}
        <View style={[styles.tabRow, { backgroundColor: colors.card }]}>
          {(["monthly", "weekly", "category"] as const).map((t) => (
            <Pressable
              key={t}
              onPress={() => setTab(t)}
              style={[styles.tabBtn, { backgroundColor: tab === t ? COLORS.primary : "transparent" }]}
            >
              <Text style={{ color: tab === t ? "#fff" : colors.textSecondary, fontFamily: "Inter_500Medium", fontSize: 13 }}>
                {t === "monthly" ? "Monthly" : t === "weekly" ? "Weekly" : "Category"}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={[styles.chartCard, { backgroundColor: colors.card }]}>
          {tab === "monthly" && (
            <>
              <Text style={[styles.chartTitle, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>Monthly Spending (₹)</Text>
              <Text style={[styles.chartSub, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>Last 6 months</Text>
              <BarChart
                data={monthlyData}
                width={CHART_WIDTH - 32}
                height={180}
                chartConfig={chartConfig}
                style={{ borderRadius: 12, marginTop: 12 }}
                showValuesOnTopOfBars
                fromZero
                withInnerLines
                yAxisLabel="₹"
                yAxisSuffix=""
              />
            </>
          )}
          {tab === "weekly" && (
            <>
              <Text style={[styles.chartTitle, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>This Week</Text>
              <Text style={[styles.chartSub, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>Daily spending pattern</Text>
              <LineChart
                data={weeklyData}
                width={CHART_WIDTH - 32}
                height={180}
                chartConfig={chartConfig}
                style={{ borderRadius: 12, marginTop: 12 }}
                bezier
                withDots
                withInnerLines
                yAxisLabel="₹"
                yAxisSuffix=""
              />
            </>
          )}
          {tab === "category" && (
            <>
              <Text style={[styles.chartTitle, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>By Category</Text>
              <Text style={[styles.chartSub, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>This month's breakdown</Text>
              <DonutChart
                data={CATEGORY_NAMES.map((name, i) => ({
                  label: name,
                  value: categoryAmounts[i],
                  color: CATEGORY_COLORS[i],
                }))}
                lastCategory={lastPaymentCategory}
              />
            </>
          )}
        </View>

        {/* Category Legend */}
        {tab !== "category" && (
          <View style={[styles.legendCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.chartTitle, { color: colors.text, fontFamily: "Inter_600SemiBold", marginBottom: 12 }]}>By Category</Text>
            {CATEGORY_NAMES.map((name, i) => {
              const maxAmt = Math.max(...categoryAmounts, 1);
              const isHighlighted = name === lastPaymentCategory;
              const rowColor = CATEGORY_COLORS[i];
              return (
                <View
                  key={name}
                  style={[
                    styles.legendRow,
                    isHighlighted && {
                      backgroundColor: rowColor + "18",
                      borderRadius: 10,
                      paddingHorizontal: 6,
                      shadowColor: rowColor,
                      shadowOpacity: 0.6,
                      shadowRadius: 8,
                      shadowOffset: { width: 0, height: 0 },
                      elevation: 4,
                    },
                  ]}
                >
                  <View style={[styles.legendDot, { backgroundColor: rowColor }]} />
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, width: 90 }}>
                    <Text style={[styles.legendName, { color: colors.text, fontFamily: "Inter_500Medium", width: undefined }]}>{name}</Text>
                    {isHighlighted && (
                      <View style={[styles.recentBadge, { backgroundColor: rowColor + "30", borderColor: rowColor }]}>
                        <Text style={{ color: rowColor, fontSize: 9, fontFamily: "Inter_700Bold" }}>RECENT</Text>
                      </View>
                    )}
                  </View>
                  <View style={[styles.legendBarWrap, { backgroundColor: colors.surface }]}>
                    <View style={[styles.legendBar, { width: `${(categoryAmounts[i] / maxAmt) * 100}%`, backgroundColor: rowColor + "90" }]} />
                  </View>
                  <Text style={[styles.legendAmt, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>₹{(categoryAmounts[i] / 1000).toFixed(1)}k</Text>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, marginBottom: 16 },
  title: { fontSize: 28, letterSpacing: -0.5 },
  summaryRow: { flexDirection: "row", marginHorizontal: 20, gap: 12, marginBottom: 16 },
  summaryCard: { flex: 1, padding: 16, borderRadius: 16, gap: 4 },
  summaryLabel: { fontSize: 12 },
  summaryAmt: { fontSize: 22, letterSpacing: -0.5 },
  tabRow: { flexDirection: "row", marginHorizontal: 20, borderRadius: 12, padding: 4, marginBottom: 16 },
  tabBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center" },
  chartCard: { marginHorizontal: 20, borderRadius: 20, padding: 16, marginBottom: 16 },
  chartTitle: { fontSize: 16 },
  chartSub: { fontSize: 12, marginTop: 2 },
  donutWrap: { marginTop: 16 },
  donutCenter: { alignItems: "center", marginBottom: 16 },
  donutTotal: { color: COLORS.primary, fontSize: 28, fontFamily: "Inter_700Bold" },
  donutLabel: { color: "#8B8FA8", fontSize: 12, fontFamily: "Inter_400Regular" },
  donutRow: { flexDirection: "row", alignItems: "center", marginBottom: 10, gap: 8 },
  donutLegendLeft: { flexDirection: "row", alignItems: "center", gap: 6, width: 110 },
  donutDot: { width: 10, height: 10, borderRadius: 5 },
  donutItemLabel: { color: "#F0F2FF", fontSize: 13, fontFamily: "Inter_500Medium" },
  donutBarWrap: { flex: 1, height: 8, backgroundColor: "#2E3352", borderRadius: 4, overflow: "hidden" },
  donutBar: { height: "100%", borderRadius: 4 },
  donutItemVal: { color: "#8B8FA8", fontSize: 12, fontFamily: "Inter_400Regular", width: 44, textAlign: "right" },
  legendCard: { marginHorizontal: 20, borderRadius: 20, padding: 16 },
  legendRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendName: { fontSize: 13, width: 90 },
  legendBarWrap: { flex: 1, height: 6, borderRadius: 3, overflow: "hidden" },
  legendBar: { height: "100%", borderRadius: 3 },
  legendAmt: { fontSize: 12, width: 40, textAlign: "right" },
  recentBadge: { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4, borderWidth: 1 },
});
