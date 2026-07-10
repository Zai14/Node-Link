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
  TOS: undefined;
  Auth: undefined;
};

const TosScreen = () => {
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
          <Text style={styles.headerTitleText}>Terms of Service</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
        indicatorStyle={isDarkMode ? "white" : "black"}
      >
        <View style={styles.card}>
          <Text style={styles.lastUpdated}>Last Updated: [23-02-2025]</Text>

          <Text style={styles.introText}>
            Welcome to <Text style={styles.bold}>NodeLink</Text>. By accessing
            or using this decentralized application, you agree to be bound by
            these Terms of Service. If you do not agree with these Terms, please
            do not use the App.
          </Text>

          <Section title="1. Nature of the Service" isDark={isDarkMode}>
            <Bullet text="This App is a decentralized, open-source platform designed to enable blockchain interactions." isDark={isDarkMode} />
            <Bullet text="The App operates on a blockchain network, meaning no central authority has control." isDark={isDarkMode} />
          </Section>

          <Section title="2. No Custodial Control" isDark={isDarkMode}>
            <Bullet text="We do not store or control user data, private keys, or assets." isDark={isDarkMode} />
            <Bullet text="Losing your private key may result in permanent loss of access." isDark={isDarkMode} />
          </Section>

          <Section title="3. Open-Source Software" isDark={isDarkMode}>
            <Bullet text="This App is developed as an open-source project." isDark={isDarkMode} />
            <Bullet text="You are free to inspect, modify, and distribute the code." isDark={isDarkMode} />
          </Section>

          <Section title="4. No Warranties & No Liability" isDark={isDarkMode}>
            <Bullet text='The App is provided "as is" without warranties.' isDark={isDarkMode} />
            <Bullet text="We are not liable for financial losses or security breaches." isDark={isDarkMode} />
          </Section>

          <Section title="5. User Responsibilities" isDark={isDarkMode}>
            <Bullet text="You agree to use the App in compliance with all applicable laws and regulations." isDark={isDarkMode} />
            <Bullet text="You must not use the App for illegal activities, including fraud, money laundering, or any other unlawful actions." isDark={isDarkMode} />
            <Bullet text="You are responsible for understanding and managing gas fees, blockchain transactions, and wallet security." isDark={isDarkMode} />
          </Section>

          <Section title="6. Security & Risks" isDark={isDarkMode}>
            <Bullet text="The App does not provide refunds or transaction reversals since blockchain transactions are irreversible." isDark={isDarkMode} />
            <Bullet text="You are responsible for using secure devices, maintaining privacy, and protecting your credentials." isDark={isDarkMode} />
            <Bullet text="Engaging with smart contracts and decentralized systems carries risks, including potential loss of funds due to contract exploits or bugs." isDark={isDarkMode} />
          </Section>

          <Section title="7. No Support or Maintenance" isDark={isDarkMode}>
            <Bullet text="Since this is an open-source and decentralized project, there is no official customer support or guarantees of ongoing maintenance." isDark={isDarkMode} />
            <Bullet text="Any issues should be raised within the open-source community or relevant repositories." isDark={isDarkMode} />
          </Section>

          <Section title="8. Regulatory Compliance" isDark={isDarkMode}>
            <Bullet text="You acknowledge that decentralized applications may be subject to evolving regulations in various jurisdictions." isDark={isDarkMode} />
            <Bullet text="It is your responsibility to comply with local laws governing digital assets and blockchain usage." isDark={isDarkMode} />
          </Section>

          <Section title="9. Changes to These Terms" isDark={isDarkMode}>
            <Bullet text="We may update these Terms from time to time. Changes will be posted within the open-source repository or app interface." isDark={isDarkMode} />
            <Bullet text="Your continued use of the App after changes indicates your acceptance of the revised Terms." isDark={isDarkMode} />
          </Section>

          <Section title="10. Governing Law & Dispute Resolution" isDark={isDarkMode}>
            <Bullet text="These Terms are governed by [applicable jurisdiction, if any, or a disclaimer stating that there is no specific jurisdiction due to decentralization]." isDark={isDarkMode} />
            <Bullet text="Any disputes should be resolved through community governance mechanisms or decentralized dispute resolution protocols, where applicable." isDark={isDarkMode} />
          </Section>

          <Section title="11. Contact & Feedback" isDark={isDarkMode}>
            <Bullet text='Since this is an open-source project, feedback and contributions are welcome via [GitHub] or contact email: [Zaidshabir67@icloud.com].' isDark={isDarkMode} />
            <Bullet text="If you have concerns, please raise them within the open-source community." isDark={isDarkMode} />
          </Section>

          <Text style={[styles.closingText, { color: isDarkMode ? "#fff" : "#333" }]}>
            By using NodeLink, you acknowledge and accept these Terms of
            Service.
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

const styles = getStyles(true); // Keep for backward compat

export default TosScreen;
