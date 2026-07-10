import React from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useThemeToggle } from "../../utils/GlobalUtils/ThemeProvider";

export default function Wallet() {
  const { currentTheme } = useThemeToggle();
  const isDarkMode = currentTheme === "dark";
  const styles = getStyles(isDarkMode);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.centered}>
        <View style={styles.card}>
          <View style={styles.iconContainer}>
            <Ionicons
              name="pause-circle-outline"
              size={48}
              color={isDarkMode ? "#FF9500" : "#FF9500"}
            />
          </View>
          <Text style={styles.title}>Access Paused</Text>
          <Text style={styles.message}>
            Wallet access and the whole NodeLink project is currently paused due
            to Indian regulatory requirements.
          </Text>
          <View style={styles.divider} />
          <Text style={styles.detail}>
            As per documents signed with the concerned Government office, this
            app cannot be publicly released on the App Store or Play Store at
            this time.
          </Text>
          <View style={styles.divider} />
          <Text style={styles.closing}>
            Development will resume after official clearance.
          </Text>
        </View>
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
    centered: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 24,
    },
    card: {
      width: "100%",
      alignItems: "center",
      backgroundColor: isDarkMode ? "#1C1C1E" : "#FFFFFF",
      borderRadius: 16,
      padding: 28,
      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: isDarkMode ? 0.3 : 0.1,
          shadowRadius: 8,
        },
        android: { elevation: 4 },
      }),
    },
    iconContainer: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: isDarkMode ? "#2C2C2E" : "#FFF3E0",
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 20,
    },
    title: {
      fontSize: 22,
      fontWeight: "700",
      color: isDarkMode ? "#fff" : "#333",
      marginBottom: 16,
      textAlign: "center",
    },
    message: {
      fontSize: 15,
      lineHeight: 22,
      color: isDarkMode ? "#ddd" : "#555",
      textAlign: "center",
      marginBottom: 0,
    },
    divider: {
      width: "100%",
      height: StyleSheet.hairlineWidth,
      backgroundColor: isDarkMode ? "#38383A" : "#E0E0E0",
      marginVertical: 16,
    },
    detail: {
      fontSize: 14,
      lineHeight: 20,
      color: isDarkMode ? "#bbb" : "#777",
      textAlign: "center",
    },
    closing: {
      fontSize: 15,
      lineHeight: 21,
      fontWeight: "600",
      color: isDarkMode ? "#fff" : "#333",
      textAlign: "center",
    },
  });
