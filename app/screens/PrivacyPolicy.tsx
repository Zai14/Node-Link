import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { Ionicons } from "@expo/vector-icons";
import { useThemeToggle } from "../../utils/GlobalUtils/ThemeProvider";

type RootStackParamList = {
  PrivacyPolicy: undefined;
  Auth: undefined;
};

const PrivacyPolicyScreen = () => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { currentTheme } = useThemeToggle();
  const isDarkMode = currentTheme === "dark";
  const styles = getStyles(isDarkMode);

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
          <Text style={styles.headerTitleText}>Privacy Policy</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
        indicatorStyle={isDarkMode ? "white" : "black"}
      >
        <View style={styles.card}>
          <Text style={styles.lastUpdated}>Last Updated: [23-09-2025]</Text>

          <Text style={styles.introText}>
            Welcome to <Text style={styles.bold}>NodeLink</Text>. Your privacy
            is important to us. This Privacy Policy explains how we collect,
            use, and protect your information when you use our decentralized
            application.
          </Text>

          <Section title="1. Data We Do Not Collect" isDark={isDarkMode}>
            <Bullet text="As a decentralized application, we do not collect or store personal data on centralized servers." isDark={isDarkMode} />
            <Bullet text="We do not have access to your private keys, wallet balances, or transaction history." isDark={isDarkMode} />
          </Section>

          <Section title="2. Blockchain Data" isDark={isDarkMode}>
            <Bullet text="Transactions and interactions occur on the blockchain and are publicly visible. We do not control or store this data." isDark={isDarkMode} />
            <Bullet text="Users are responsible for managing their own blockchain data and wallet security." isDark={isDarkMode} />
          </Section>

          <Section title="3. Use of Third-Party Services" isDark={isDarkMode}>
            <Bullet text="Our App may integrate with third-party services (e.g., wallet providers, blockchain nodes) that have their own privacy policies." isDark={isDarkMode} />
            <Bullet text="We recommend reviewing the privacy policies of these third-party services." isDark={isDarkMode} />
          </Section>

          <Section title="4. Security Measures" isDark={isDarkMode}>
            <Bullet text="We do not store sensitive user data, reducing the risk of breaches." isDark={isDarkMode} />
            <Bullet text="Users should take precautions such as securing private keys and enabling two-factor authentication where applicable." isDark={isDarkMode} />
          </Section>

          <Section title="5. Cookies and Tracking" isDark={isDarkMode}>
            <Bullet text="We do not use cookies, trackers, or analytics services that collect user data." isDark={isDarkMode} />
            <Bullet text="Any tracking or analytics would be performed by third-party services you choose to interact with." isDark={isDarkMode} />
          </Section>

          <Section title="6. Your Rights and Control" isDark={isDarkMode}>
            <Bullet text="Since we do not collect personal data, we do not store information that can be modified or deleted." isDark={isDarkMode} />
            <Bullet text="You are in full control of your wallet, private keys, and blockchain interactions." isDark={isDarkMode} />
          </Section>

          <Section title="7. Changes to This Policy" isDark={isDarkMode}>
            <Bullet text="We may update this Privacy Policy periodically. Changes will be communicated via open-source repositories or within the app." isDark={isDarkMode} />
            <Bullet text="Your continued use of the App after changes constitutes acceptance of the updated Privacy Policy." isDark={isDarkMode} />
          </Section>

          <Section title="8. Contact & Feedback" isDark={isDarkMode}>
            <Bullet text="For questions or concerns, reach out to us via [Zaidshabir67@icloud.com]." isDark={isDarkMode} />
            <Bullet text="Community feedback and contributions are welcome through our open-source repository." isDark={isDarkMode} />
          </Section>

          <Text style={[styles.closingText, { color: isDarkMode ? "#fff" : "#333" }]}>
            By using NodeLink, you acknowledge and accept this Privacy Policy.
          </Text>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
};

// ─── Sub-components ─────────────────────────────────────────────────────────

const Section: React.FC<{
  title: string;
  isDark: boolean;
  children: React.ReactNode;
}> = ({ title, isDark, children }) => {
  const textColor = isDark ? "#BBBBBB" : "#555555";
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: textColor }]}>{title}</Text>
      {children}
    </View>
  );
};

const Bullet: React.FC<{ text: string; isDark?: boolean }> = ({ text, isDark = true }) => {
  const bulletTextColor = isDark ? "#ddd" : "#444";
  return (
    <View style={styles.bulletRow}>
      <Text style={styles.bulletDot}>{"\u2022"}</Text>
      <Text style={[styles.bulletText, { color: bulletTextColor }]}>{text}</Text>
    </View>
  );
};

// ─── Styles ─────────────────────────────────────────────────────────────────
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

    // ── Content ──────────────────────────────────────────────────────────
    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: 16,
      paddingTop: 20,
    },
    card: {
      backgroundColor: isDarkMode ? "#1C1C1E" : "#FFFFFF",
      borderRadius: 12,
      padding: 20,
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
    lastUpdated: {
      fontSize: 14,
      fontWeight: "600",
      color: isDarkMode ? "#8E8E93" : "#8E8E93",
      marginBottom: 16,
      textAlign: "center",
    },
    introText: {
      fontSize: 15,
      lineHeight: 22,
      color: isDarkMode ? "#fff" : "#333",
      marginBottom: 20,
      paddingBottom: 20,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: isDarkMode ? "#38383A" : "#E0E0E0",
    },
    bold: {
      fontWeight: "700",
    },

    // ── Sections ─────────────────────────────────────────────────────────
    section: {
      marginBottom: 20,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: "700",
      marginBottom: 8,
      color: isDarkMode ? "#BBBBBB" : "#555555",
    },
    bulletRow: {
      flexDirection: "row",
      marginBottom: 6,
      paddingLeft: 4,
    },
    bulletDot: {
      fontSize: 14,
      color: isDarkMode ? "#8E8E93" : "#8E8E93",
      marginRight: 8,
      marginTop: 2,
    },
    bulletText: {
      flex: 1,
      fontSize: 14,
      lineHeight: 20,
    },

    // ── Closing ──────────────────────────────────────────────────────────
    closingText: {
      fontSize: 14,
      fontWeight: "700",
      lineHeight: 20,
      marginTop: 8,
      paddingTop: 16,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: isDarkMode ? "#38383A" : "#E0E0E0",
    },

    bottomSpacer: {
      height: 40,
    },
  });

const styles = getStyles(true); // Keep for backward compat with Section/Bullet

export default PrivacyPolicyScreen;
