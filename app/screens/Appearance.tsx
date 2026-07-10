// AppearanceScreen.tsx
import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { triggerTapHapticFeedback } from "../../utils/GlobalUtils/TapHapticFeedback";
import {
  useThemeToggle,
  ThemeOption as GlobalThemeOption,
} from "../../utils/GlobalUtils/ThemeProvider";
import AsyncStorage from "@react-native-async-storage/async-storage";

type LocalThemeOption = "automatic" | "dark" | "light";

export default function AppearanceScreen() {
  const navigation = useNavigation();
  const { currentTheme, userTheme, setTheme } = useThemeToggle();
  const isDarkMode = currentTheme === "dark";
  const [selectedTheme, setSelectedTheme] =
    useState<LocalThemeOption>("automatic");
  const [timeFormat, setTimeFormat] = useState<"12" | "24">("24");

  // Sync local state with userTheme (mapping 'system' to 'automatic')
  useEffect(() => {
    setSelectedTheme(userTheme === "system" ? "automatic" : userTheme);
  }, [userTheme]);

  useEffect(() => {
    // Load time format from storage
    AsyncStorage.getItem("timeFormat").then((val) => {
      if (val === "12" || val === "24") setTimeFormat(val);
    });
  }, []);

  const handleSelect = (option: LocalThemeOption) => {
    setSelectedTheme(option);
    const themeToSet: GlobalThemeOption =
      option === "automatic" ? "system" : option;
    setTheme(themeToSet);
    triggerTapHapticFeedback();
    console.log(`Theme selected: ${option}`, userTheme);
  };

  const handleTimeFormatChange = async (format: "12" | "24") => {
    setTimeFormat(format);
    await AsyncStorage.setItem("timeFormat", format);
    triggerTapHapticFeedback();
  };

  const styles = getStyles(isDarkMode);

  // ─── Theme icon helper ─────────────────────────────────────────────────
  const themeIcon = (option: LocalThemeOption): string => {
    switch (option) {
      case "automatic":
        return "settings-outline";
      case "dark":
        return "moon-outline";
      case "light":
        return "sunny-outline";
    }
  };

  // ─── Theme description helper ──────────────────────────────────────────
  const themeDescription = (option: LocalThemeOption): string => {
    switch (option) {
      case "automatic":
        return "Use system settings";
      case "dark":
        return "Always dark";
      case "light":
        return "Always light";
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.headerContainer}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons
            name="chevron-back"
            size={24}
            color="#007AFF"
            style={{ marginRight: 4 }}
          />
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        <View style={styles.headerTitleContainer} pointerEvents="none">
          <Text style={styles.headerTitleText}>Appearance</Text>
        </View>
      </View>

      {/* ═══════════════ Theme Section ═══════════════ */}
      <Text style={styles.sectionHeader}>THEME</Text>
      <View style={styles.card}>
        {/* Automatic */}
        <TouchableOpacity
          style={styles.row}
          onPress={() => handleSelect("automatic")}
          activeOpacity={0.65}
        >
          <View style={styles.rowLeft}>
            <View style={[styles.iconCircle, styles.iconCircleDefault]}>
              <Ionicons
                name={themeIcon("automatic") as any}
                size={18}
                color={isDarkMode ? "#8E8E93" : "#666"}
              />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>Automatic</Text>
              <Text style={styles.rowSubtitle}>
                {themeDescription("automatic")}
              </Text>
            </View>
          </View>
          <View
            style={[
              styles.checkmark,
              selectedTheme === "automatic" && styles.checkmarkActive,
            ]}
          >
            {selectedTheme === "automatic" && (
              <Ionicons name="checkmark" size={16} color="#fff" />
            )}
          </View>
        </TouchableOpacity>

        <View style={styles.divider} />

        {/* Dark */}
        <TouchableOpacity
          style={styles.row}
          onPress={() => handleSelect("dark")}
          activeOpacity={0.65}
        >
          <View style={styles.rowLeft}>
            <View style={[styles.iconCircle, { backgroundColor: isDarkMode ? "#2C2C2E" : "#F0F0F5" }]}>
              <Ionicons
                name={themeIcon("dark") as any}
                size={18}
                color={isDarkMode ? "#8E8E93" : "#666"}
              />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>Dark</Text>
              <Text style={styles.rowSubtitle}>
                {themeDescription("dark")}
              </Text>
            </View>
          </View>
          <View
            style={[
              styles.checkmark,
              selectedTheme === "dark" && styles.checkmarkActive,
            ]}
          >
            {selectedTheme === "dark" && (
              <Ionicons name="checkmark" size={16} color="#fff" />
            )}
          </View>
        </TouchableOpacity>

        <View style={styles.divider} />

        {/* Light */}
        <TouchableOpacity
          style={[styles.row, { borderBottomWidth: 0 }]}
          onPress={() => handleSelect("light")}
          activeOpacity={0.65}
        >
          <View style={styles.rowLeft}>
            <View style={[styles.iconCircle, { backgroundColor: isDarkMode ? "#2C2C2E" : "#F0F0F5" }]}>
              <Ionicons
                name={themeIcon("light") as any}
                size={18}
                color={isDarkMode ? "#8E8E93" : "#666"}
              />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>Light</Text>
              <Text style={styles.rowSubtitle}>
                {themeDescription("light")}
              </Text>
            </View>
          </View>
          <View
            style={[
              styles.checkmark,
              selectedTheme === "light" && styles.checkmarkActive,
            ]}
          >
            {selectedTheme === "light" && (
              <Ionicons name="checkmark" size={16} color="#fff" />
            )}
          </View>
        </TouchableOpacity>
      </View>

      {/* ═══════════════ Time Format Section ═══════════════ */}
      <Text style={styles.sectionHeader}>TIME FORMAT</Text>
      <View style={styles.card}>
        {/* 24-hour */}
        <TouchableOpacity
          style={styles.row}
          onPress={() => handleTimeFormatChange("24")}
          activeOpacity={0.65}
        >
          <View style={styles.rowLeft}>
            <View style={[styles.iconCircle, { backgroundColor: isDarkMode ? "#2C2C2E" : "#F0F0F5" }]}>
              <Ionicons
                name="time-outline"
                size={18}
                color={isDarkMode ? "#8E8E93" : "#666"}
              />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>24-hour</Text>
              <Text style={styles.rowSubtitle}>00:00 – 23:59</Text>
            </View>
          </View>
          <View
            style={[
              styles.checkmark,
              timeFormat === "24" && styles.checkmarkActive,
            ]}
          >
            {timeFormat === "24" && (
              <Ionicons name="checkmark" size={16} color="#fff" />
            )}
          </View>
        </TouchableOpacity>

        <View style={styles.divider} />

        {/* 12-hour */}
        <TouchableOpacity
          style={[styles.row, { borderBottomWidth: 0 }]}
          onPress={() => handleTimeFormatChange("12")}
          activeOpacity={0.65}
        >
          <View style={styles.rowLeft}>
            <View style={[styles.iconCircle, { backgroundColor: isDarkMode ? "#2C2C2E" : "#F0F0F5" }]}>
              <Ionicons
                name="timer-outline"
                size={18}
                color={isDarkMode ? "#8E8E93" : "#666"}
              />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>12-hour</Text>
              <Text style={styles.rowSubtitle}>12:00 AM – 11:59 PM</Text>
            </View>
          </View>
          <View
            style={[
              styles.checkmark,
              timeFormat === "12" && styles.checkmarkActive,
            ]}
          >
            {timeFormat === "12" && (
              <Ionicons name="checkmark" size={16} color="#fff" />
            )}
          </View>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const getStyles = (isDarkMode: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDarkMode ? "#1C1C1D" : "#F2F2F2",
    },

    // ── Header ────────────────────────────────────────────────────────────
    headerContainer: {
      position: "relative",
      flexDirection: "row",
      alignItems: "center",
      height: 44,
      paddingHorizontal: 16,
      backgroundColor: isDarkMode ? "#1C1C1D" : "#F2F2F2",
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: isDarkMode ? "#333" : "#E0E0E0",
    },
    backButton: {
      width: 100,
      flexDirection: "row",
      alignItems: "center",
      zIndex: 1,
    },
    backButtonText: {
      fontSize: 17,
      color: "#007AFF",
      marginLeft: 4,
    },
    headerTitleContainer: {
      position: "absolute",
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
      justifyContent: "center",
      alignItems: "center",
      zIndex: 0,
    },
    headerTitleText: {
      fontSize: 17,
      fontWeight: "600",
      fontFamily: "SF-Pro-Text-Medium",
      color: isDarkMode ? "#fff" : "#333333",
    },

    // ── Section Headers ──────────────────────────────────────────────────
    sectionHeader: {
      fontSize: 13,
      fontWeight: "600",
      color: isDarkMode ? "#8E8E93" : "#6D6D72",
      letterSpacing: 0.5,
      marginTop: 24,
      marginBottom: 8,
      marginHorizontal: 20,
    },

    // ── Card ─────────────────────────────────────────────────────────────
    card: {
      backgroundColor: isDarkMode ? "#1C1C1E" : "#FFFFFF",
      borderRadius: 12,
      marginHorizontal: 16,
      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: isDarkMode ? 0.3 : 0.08,
          shadowRadius: 4,
        },
        android: { elevation: 2 },
      }),
    },

    // ── Rows ─────────────────────────────────────────────────────────────
    row: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: isDarkMode ? "#38383A" : "#E0E0E0",
    },
    rowLeft: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
    },
    iconCircle: {
      width: 32,
      height: 32,
      borderRadius: 16,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 12,
    },
    iconCircleDefault: {
      backgroundColor: isDarkMode ? "#2C2C2E" : "#F0F0F5",
    },
    rowText: {
      flex: 1,
    },
    rowTitle: {
      fontSize: 16,
      fontWeight: "500",
      color: isDarkMode ? "#fff" : "#333",
    },
    rowSubtitle: {
      fontSize: 12,
      color: isDarkMode ? "#8E8E93" : "#8E8E93",
      marginTop: 1,
    },

    // ── Checkmark ────────────────────────────────────────────────────────
    checkmark: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: isDarkMode ? "#38383A" : "#E0E0E0",
      justifyContent: "center",
      alignItems: "center",
      marginLeft: 12,
    },
    checkmarkActive: {
      backgroundColor: "#007AFF",
      borderColor: "#007AFF",
    },

    // ── Divider ──────────────────────────────────────────────────────────
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: isDarkMode ? "#38383A" : "#E0E0E0",
      marginLeft: 60,
    },
  });
