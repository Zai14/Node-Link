import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Pressable,
  ScrollView,
  TouchableOpacity,
  Animated,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import type { StackNavigationProp } from "@react-navigation/stack";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { refreshKeyData } from "../../utils/Security/HandleRefreshData";
import { handlePrivatePress } from "../../utils/Security/HandlePrivateKeyPress";
import { handleChangeKey } from "../../utils/Security/HandleChangeKey";
import { handleValidateKeys } from "../../utils/Security/HandleValidateKeys";
import { useThemeToggle } from "../../utils/GlobalUtils/ThemeProvider";
import { copyToClipboard } from "../../utils/GlobalUtils/CopyToClipboard";
import {
  getSessionStatus,
} from "../../utils/AuthenticationUtils/SupabaseAuth";

interface SharedItem {
  name: string;
  sharedPublicKey: string;
  sharedSecret: string;
}

type SecurityScreenNavigationProp = StackNavigationProp<any>;

// ─── Reusable Animated Pressable ────────────────────────────────────────────
const AnimatedPressable: React.FC<{
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  style?: any;
  children: React.ReactNode;
}> = ({ onPress, onLongPress, disabled, style, children }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Animated.View style={[style, { transform: [{ scale: scaleAnim }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
};

// ─── Component ─────────────────────────────────────────────────────────────
const SecurityScreen: React.FC = () => {
  const navigation = useNavigation<SecurityScreenNavigationProp>();
  const { currentTheme } = useThemeToggle();
  const isDarkMode = currentTheme === "dark";
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [userPublicKey, setUserPublicKey] = useState<string | null>(null);
  const [privateKey, setPrivateKey] = useState<string | null>(null);
  const [compressedPublicKey, setCompressedPublicKey] = useState<string | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showPrivate, setShowPrivate] = useState(false);
  const [changeSuccess, setChangeSuccess] = useState(false);
  const [keysValid, setKeysValid] = useState(false);
  const [sharedList, setSharedList] = useState<SharedItem[]>([]);
  const [visibleSecrets, setVisibleSecrets] = useState<Record<string, boolean>>(
    {}
  );
  const [sessionActive, setSessionActive] = useState<boolean | null>(null);
  const [sessionExpiresAt, setSessionExpiresAt] = useState<number | null>(null);
  const [sessionRefreshCount, setSessionRefreshCount] = useState(0);
  const [sessionLoading, setSessionLoading] = useState(true);

  // Copy feedback states
  const [copiedKey, setCopiedKey] = useState<"public" | "compressed" | "private" | null>(null);

  const showCopiedFeedback = (type: "public" | "compressed" | "private") => {
    setCopiedKey(type);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  const loadSharedSecrets = useCallback(async () => {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const sharedKeys = allKeys.filter((k) => k.startsWith("shared_key_"));
      const entries = await AsyncStorage.multiGet(sharedKeys);

      const items: SharedItem[] = [];
      const visibilityMap: Record<string, boolean> = {};

      for (const [storageKey, secret] of entries) {
        const sharedKey = storageKey.replace("shared_key_", "");
        let name = sharedKey;
        visibilityMap[sharedKey] = false;

        try {
          const raw = await AsyncStorage.getItem(`user_profile_${sharedKey}`);
          if (raw) {
            const profile = JSON.parse(raw);
            if (profile.name) {
              name = profile.name;
            }
          }
        } catch (e) {
          console.log(`Error parsing profile for ${sharedKey}`, e);
        }

        items.push({
          name,
          sharedPublicKey: sharedKey,
          sharedSecret: secret || "",
        });
      }

      setSharedList(items);
      setVisibleSecrets(visibilityMap);
    } catch (e) {
      console.log("Failed to load shared secrets", e);
      setSharedList([]);
    }
  }, []);

  useEffect(() => {
    setKeysValid(false);
    setChangeSuccess(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      setLoading(true);

      const fetchData = async () => {
        await refreshKeyData(
          setWalletAddress,
          setUserPublicKey,
          setPrivateKey,
          setCompressedPublicKey,
          setLoading
        );
        await loadSharedSecrets();

        const status = await getSessionStatus();
        if (isActive) {
          setSessionActive(status.active);
          setSessionExpiresAt(status.expiresAt);
          setSessionRefreshCount(status.refreshCount);
          setSessionLoading(false);
        }

        if (isActive) setLoading(false);
      };

      fetchData();

      return () => {
        isActive = false;
        setKeysValid(false);
        setChangeSuccess(false);
        setSessionActive(null);
        setSessionLoading(true);
      };
    }, [loadSharedSecrets])
  );

  const formatExpiry = (expiresAt: number): string => {
    const msRemaining = expiresAt * 1000 - Date.now();
    if (msRemaining <= 0) return "Expired";
    const mins = Math.floor(msRemaining / 60000);
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    if (hours > 0) {
      return `${hours}h ${remainingMins}m remaining`;
    }
    return `${mins}m remaining`;
  };

  const maskString = (str: string | null): string =>
    str ? "\u{2022}".repeat(str.length) : "";

  const toggleSecretVisibility = (key: string) => {
    setVisibleSecrets((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleCopyPublicKey = async () => {
    if (userPublicKey) {
      await copyToClipboard(userPublicKey);
      showCopiedFeedback("public");
    }
  };

  const handleCopyCompressedKey = async () => {
    if (compressedPublicKey) {
      await copyToClipboard(compressedPublicKey);
      showCopiedFeedback("compressed");
    }
  };

  const handleCopyPrivateKey = async () => {
    if (privateKey && showPrivate) {
      await copyToClipboard(privateKey);
      showCopiedFeedback("private");
    }
  };

  const styles = getStyles(isDarkMode);

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
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
          <Text style={styles.headerTitleText}>Security</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={isDarkMode ? "#007AFF" : "#007AFF"} />
          <Text style={styles.loadingText}>Loading security data...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollViewContainer}
          showsVerticalScrollIndicator={true}
          contentContainerStyle={styles.scrollViewContent}
        >
          {/* ═══════════════ Crypto Keys Section ═══════════════ */}
          <Text style={styles.sectionHeader}>CRYPTO KEYS</Text>
          <View style={styles.cardSection}>

            {/* Public Key */}
            <Pressable style={styles.keyRow} onPress={handleCopyPublicKey}>
              <View style={styles.keyLabelRow}>
                <Ionicons
                  name="key-outline"
                  size={16}
                  color={isDarkMode ? "#8E8E93" : "#8E8E93"}
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.keyLabel}>Public Key</Text>
              </View>
              <View style={styles.keyValueRow}>
                <Text style={styles.keyValue} numberOfLines={1} ellipsizeMode="middle">
                  {userPublicKey ?? "No key found."}
                </Text>
                {copiedKey === "public" ? (
                  <Ionicons name="checkmark-circle" size={18} color="#34C759" style={{ marginLeft: 8 }} />
                ) : (
                  <Ionicons name="copy-outline" size={16} color={isDarkMode ? "#8E8E93" : "#8E8E93"} style={{ marginLeft: 8 }} />
                )}
              </View>
              {copiedKey === "public" && (
                <Text style={styles.copiedBadge}>Copied!</Text>
              )}
            </Pressable>

            <View style={styles.keyDivider} />

            {/* Compressed Public Key */}
            <Pressable style={styles.keyRow} onPress={handleCopyCompressedKey}>
              <View style={styles.keyLabelRow}>
                <Ionicons
                  name="code-slash-outline"
                  size={16}
                  color={isDarkMode ? "#8E8E93" : "#8E8E93"}
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.keyLabel}>Compressed Key</Text>
              </View>
              <View style={styles.keyValueRow}>
                <Text style={styles.keyValue} numberOfLines={1} ellipsizeMode="middle">
                  {compressedPublicKey ?? "No compressed key found."}
                </Text>
                {copiedKey === "compressed" ? (
                  <Ionicons name="checkmark-circle" size={18} color="#34C759" style={{ marginLeft: 8 }} />
                ) : (
                  <Ionicons name="copy-outline" size={16} color={isDarkMode ? "#8E8E93" : "#8E8E93"} style={{ marginLeft: 8 }} />
                )}
              </View>
              {copiedKey === "compressed" && (
                <Text style={styles.copiedBadge}>Copied!</Text>
              )}
            </Pressable>

            <View style={styles.keyDivider} />

            {/* Private Key */}
            <Pressable
              style={styles.keyRow}
              onPress={() => handlePrivatePress(showPrivate, setShowPrivate)}
              onLongPress={showPrivate ? handleCopyPrivateKey : undefined}
            >
              <View style={styles.keyLabelRow}>
                <Ionicons
                  name={showPrivate ? "eye-off-outline" : "eye-outline"}
                  size={16}
                  color={isDarkMode ? "#FF9500" : "#FF9500"}
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.keyLabel}>Private Key</Text>
                <View style={styles.tapHintBadge}>
                  <Text style={styles.tapHintText}>
                    {showPrivate ? "Tap to hide" : "Tap to reveal"}
                  </Text>
                </View>
              </View>
              <View style={styles.keyValueRow}>
                <Text style={styles.keyValue} numberOfLines={1} ellipsizeMode="middle">
                  {showPrivate ? privateKey : maskString(privateKey)}
                </Text>
                {showPrivate && (
                  copiedKey === "private" ? (
                    <Ionicons name="checkmark-circle" size={18} color="#34C759" style={{ marginLeft: 8 }} />
                  ) : (
                    <Ionicons name="copy-outline" size={16} color={isDarkMode ? "#8E8E93" : "#8E8E93"} style={{ marginLeft: 8 }} />
                  )
                )}
              </View>
              {copiedKey === "private" && (
                <Text style={styles.copiedBadge}>Copied!</Text>
              )}
            </Pressable>
          </View>

          {/* ═══════════════ Actions Section ═══════════════ */}
          <Text style={styles.sectionHeader}>ACTIONS</Text>
          <View style={styles.actionsCard}>
            <View style={styles.actionsRow}>
              <AnimatedPressable
                onPress={() => {
                  if (!actionLoading && !changeSuccess) {
                    Alert.alert(
                      "Change Key Pair",
                      "Are you sure you want to generate a new key pair? This will replace your current keys.",
                      [
                        { text: "Cancel", style: "cancel" },
                        {
                          text: "Change",
                          style: "destructive",
                          onPress: () =>
                            handleChangeKey(
                              walletAddress,
                              setActionLoading,
                              setChangeSuccess,
                              () =>
                                refreshKeyData(
                                  setWalletAddress,
                                  setUserPublicKey,
                                  setPrivateKey,
                                  setCompressedPublicKey,
                                  setLoading
                                )
                            ),
                        },
                      ]
                    );
                  }
                }}
                disabled={actionLoading}
                style={[
                  styles.actionButton,
                  changeSuccess
                    ? styles.actionButtonSuccess
                    : styles.actionButtonDefault,
                ]}
              >
                <Ionicons
                  name={actionLoading ? "sync-circle" : changeSuccess ? "checkmark-circle" : "refresh-circle"}
                  size={22}
                  color={changeSuccess ? "#007AFF" : isDarkMode ? "#ccc" : "#666"}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[
                    styles.actionButtonText,
                    changeSuccess && styles.actionButtonTextSuccess,
                  ]}
                >
                  {actionLoading
                    ? "Changing..."
                    : changeSuccess
                    ? "Key Changed Successfully"
                    : "Change Key Pair"}
                </Text>
              </AnimatedPressable>

              <AnimatedPressable
                onPress={() => handleValidateKeys(walletAddress, setKeysValid)}
                style={[
                  styles.actionButton,
                  keysValid
                    ? styles.actionButtonValid
                    : styles.actionButtonDefault,
                ]}
              >
                <Ionicons
                  name={keysValid ? "shield-checkmark" : "shield-outline"}
                  size={22}
                  color={keysValid ? "#34C759" : isDarkMode ? "#ccc" : "#666"}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[
                    styles.actionButtonText,
                    keysValid && styles.actionButtonTextValid,
                  ]}
                >
                  {keysValid ? "Keys are Valid" : "Validate Keys"}
                </Text>
              </AnimatedPressable>
            </View>
          </View>

          {/* ═══════════════ Authentication Session ═══════════════ */}
          <Text style={styles.sectionHeader}>AUTHENTICATION SESSION</Text>
          <View style={styles.sessionCard}>
            {sessionLoading ? (
              <ActivityIndicator size="small" color={isDarkMode ? "#aaa" : "#888"} />
            ) : (
              <>
                <View style={styles.sessionRow}>
                  <View style={styles.sessionStatusLeft}>
                    <View
                      style={[
                        styles.statusDot,
                        {
                          backgroundColor:
                            sessionActive === null
                              ? "#888"
                              : sessionActive
                              ? "#34C759"
                              : "#FF3B30",
                        },
                      ]}
                    />
                    <Text style={styles.sessionLabel}>Status</Text>
                  </View>
                  <Text
                    style={[
                      styles.sessionValue,
                      {
                        color:
                          sessionActive === null
                            ? "#888"
                            : sessionActive
                            ? "#34C759"
                            : "#FF3B30",
                      },
                    ]}
                  >
                    {sessionActive === null
                      ? "Unknown"
                      : sessionActive
                      ? "Active"
                      : "Not connected"}
                  </Text>
                </View>
                <View style={styles.sessionDivider} />
                <View style={styles.sessionRow}>
                  <Text style={styles.sessionLabel}>Token Expiry</Text>
                  <Text style={styles.sessionValue}>
                    {sessionActive && sessionExpiresAt
                      ? formatExpiry(sessionExpiresAt)
                      : "\u2014"}
                  </Text>
                </View>
                <View style={styles.sessionDivider} />
                <View style={[styles.sessionRow, { marginBottom: 0 }]}>
                  <Text style={styles.sessionLabel}>Refreshes</Text>
                  <Text style={styles.sessionValue}>
                    {sessionRefreshCount > 0
                      ? `${sessionRefreshCount} time${sessionRefreshCount !== 1 ? "s" : ""}`
                      : "None yet"}
                  </Text>
                </View>
              </>
            )}
          </View>

          {/* ═══════════════ Shared Secrets Section ═══════════════ */}
          <Text style={styles.sectionHeader}>SHARED SECRETS</Text>
          <View style={styles.sharedSecretsCard}>
            {sharedList.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons
                  name="lock-closed-outline"
                  size={40}
                  color={isDarkMode ? "#555" : "#ccc"}
                />
                <Text style={styles.emptyStateText}>No shared secrets found.</Text>
                <Text style={styles.emptyStateSubtext}>
                  Shared secrets are created when you exchange encrypted messages with another user.
                </Text>
              </View>
            ) : (
              sharedList.map((item, index) => (
                <View key={item.sharedPublicKey}>
                  <View style={styles.sharedItem}>
                    <View style={styles.sharedHeaderRow}>
                      <Ionicons
                        name="person-circle-outline"
                        size={20}
                        color={isDarkMode ? "#8E8E93" : "#8E8E93"}
                        style={{ marginRight: 8 }}
                      />
                      <Text style={styles.sharedName}>{item.name}</Text>
                    </View>
                    <View style={styles.sharedDetailRow}>
                      <Text style={styles.sharedDetailLabel}>Public Key</Text>
                      <Text style={styles.sharedDetailValue} numberOfLines={1} ellipsizeMode="middle">
                        {item.sharedPublicKey}
                      </Text>
                    </View>
                    <Pressable
                      style={styles.sharedSecretRow}
                      onPress={() => toggleSecretVisibility(item.sharedPublicKey)}
                    >
                      <Text style={styles.sharedDetailLabel}>Shared Secret</Text>
                      <View style={styles.sharedSecretValueRow}>
                        <Text style={styles.sharedSecretValue} numberOfLines={1} ellipsizeMode="middle">
                          {visibleSecrets[item.sharedPublicKey]
                            ? item.sharedSecret
                            : maskString(item.sharedSecret)}
                        </Text>
                        <Ionicons
                          name={visibleSecrets[item.sharedPublicKey] ? "eye-off-outline" : "eye-outline"}
                          size={16}
                          color={isDarkMode ? "#8E8E93" : "#8E8E93"}
                          style={{ marginLeft: 6 }}
                        />
                      </View>
                    </Pressable>
                  </View>
                  {index < sharedList.length - 1 && <View style={styles.sharedDivider} />}
                </View>
              ))
            )}
          </View>

          <View style={styles.bottomSpacer} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

export default SecurityScreen;

// ─── Styles ─────────────────────────────────────────────────────────────────
const getStyles = (isDarkMode: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDarkMode ? "#1C1C1D" : "#F2F2F2",
    },

    // ── Header ──────────────────────────────────────────────────────────────
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

    // ── Loading ────────────────────────────────────────────────────────────
    loadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    loadingText: {
      marginTop: 12,
      fontSize: 15,
      color: isDarkMode ? "#aaa" : "#888",
    },

    // ── Scroll ──────────────────────────────────────────────────────────────
    scrollViewContainer: {
      flex: 1,
    },
    scrollViewContent: {
      flexGrow: 1,
      paddingBottom: 40,
    },

    // ── Section Headers ────────────────────────────────────────────────────
    sectionHeader: {
      fontSize: 13,
      fontWeight: "600",
      color: isDarkMode ? "#8E8E93" : "#6D6D72",
      letterSpacing: 0.5,
      marginTop: 24,
      marginBottom: 8,
      marginHorizontal: 20,
    },

    // ── Card Sections ──────────────────────────────────────────────────────
    cardSection: {
      backgroundColor: isDarkMode ? "#1C1C1E" : "#FFFFFF",
      borderRadius: 12,
      marginHorizontal: 16,
      paddingVertical: 4,
      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: isDarkMode ? 0.3 : 0.08,
          shadowRadius: 4,
        },
        android: {
          elevation: 2,
        },
      }),
    },

    // ── Key Rows ───────────────────────────────────────────────────────────
    keyRow: {
      paddingVertical: 12,
      paddingHorizontal: 16,
      minHeight: 48,
    },
    keyLabelRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 4,
    },
    keyLabel: {
      fontSize: 13,
      fontWeight: "600",
      color: isDarkMode ? "#8E8E93" : "#8E8E93",
      textTransform: "uppercase",
      letterSpacing: 0.3,
    },
    tapHintBadge: {
      marginLeft: 8,
      backgroundColor: isDarkMode ? "#2C2C2E" : "#F2F2F7",
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    tapHintText: {
      fontSize: 10,
      color: isDarkMode ? "#8E8E93" : "#8E8E93",
      fontWeight: "500",
    },
    keyValueRow: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 2,
    },
    keyValue: {
      flex: 1,
      fontSize: 14,
      fontFamily: Platform.select({ ios: "Courier", android: "monospace" }),
      color: isDarkMode ? "#fff" : "#333",
    },
    copiedBadge: {
      position: "absolute",
      right: 16,
      top: 12,
      fontSize: 12,
      fontWeight: "600",
      color: "#34C759",
    },
    keyDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: isDarkMode ? "#38383A" : "#E0E0E0",
      marginLeft: 16,
    },

    // ── Actions ────────────────────────────────────────────────────────────
    actionsCard: {
      marginHorizontal: 16,
    },
    actionsRow: {
      flexDirection: "column",
      gap: 10,
    },
    actionButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 14,
      paddingHorizontal: 20,
      borderRadius: 12,
      borderWidth: 1,
    },
    actionButtonDefault: {
      backgroundColor: isDarkMode ? "#2C2C2E" : "#FFFFFF",
      borderColor: isDarkMode ? "#38383A" : "#E0E0E0",
      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: isDarkMode ? 0.3 : 0.06,
          shadowRadius: 3,
        },
        android: { elevation: 1 },
      }),
    },
    actionButtonSuccess: {
      backgroundColor: isDarkMode ? "#1C2A1C" : "#F0FFF0",
      borderColor: "#007AFF",
      ...Platform.select({
        ios: {
          shadowColor: "#007AFF",
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.15,
          shadowRadius: 3,
        },
        android: { elevation: 1 },
      }),
    },
    actionButtonValid: {
      backgroundColor: isDarkMode ? "#1A2E1A" : "#F0FFF0",
      borderColor: "#34C759",
      ...Platform.select({
        ios: {
          shadowColor: "#34C759",
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.15,
          shadowRadius: 3,
        },
        android: { elevation: 1 },
      }),
    },
    actionButtonText: {
      fontSize: 15,
      fontWeight: "600",
      color: isDarkMode ? "#ccc" : "#666",
    },
    actionButtonTextSuccess: {
      color: "#007AFF",
    },
    actionButtonTextValid: {
      color: "#34C759",
    },

    // ── Session Card ───────────────────────────────────────────────────────
    sessionCard: {
      backgroundColor: isDarkMode ? "#1C1C1E" : "#FFFFFF",
      borderRadius: 12,
      padding: 16,
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
    sessionRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
    },
    sessionStatusLeft: {
      flexDirection: "row",
      alignItems: "center",
    },
    sessionLabel: {
      fontSize: 14,
      fontWeight: "500",
      color: isDarkMode ? "#ddd" : "#333",
    },
    sessionValue: {
      fontSize: 14,
      color: isDarkMode ? "#aaa" : "#666",
    },
    statusDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      marginRight: 8,
    },
    sessionDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: isDarkMode ? "#38383A" : "#E0E0E0",
      marginBottom: 12,
    },

    // ── Shared Secrets ────────────────────────────────────────────────────
    sharedSecretsCard: {
      backgroundColor: isDarkMode ? "#1C1C1E" : "#FFFFFF",
      borderRadius: 12,
      marginHorizontal: 16,
      padding: 12,
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
    emptyState: {
      alignItems: "center",
      paddingVertical: 32,
    },
    emptyStateText: {
      fontSize: 16,
      fontWeight: "600",
      color: isDarkMode ? "#aaa" : "#888",
      marginTop: 12,
    },
    emptyStateSubtext: {
      fontSize: 13,
      color: isDarkMode ? "#555" : "#aaa",
      textAlign: "center",
      marginTop: 6,
      paddingHorizontal: 20,
      lineHeight: 18,
    },
    sharedItem: {
      backgroundColor: isDarkMode ? "#2C2C2E" : "#F9F9F9",
      borderRadius: 10,
      padding: 14,
    },
    sharedHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 10,
    },
    sharedName: {
      fontSize: 16,
      fontWeight: "600",
      color: isDarkMode ? "#fff" : "#333",
    },
    sharedDetailRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 8,
    },
    sharedDetailLabel: {
      width: 90,
      fontSize: 13,
      fontWeight: "500",
      color: isDarkMode ? "#8E8E93" : "#8E8E93",
    },
    sharedDetailValue: {
      flex: 1,
      fontSize: 13,
      fontFamily: Platform.select({ ios: "Courier", android: "monospace" }),
      color: isDarkMode ? "#fff" : "#555",
    },
    sharedSecretRow: {
      flexDirection: "row",
      alignItems: "center",
    },
    sharedSecretValueRow: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
    },
    sharedSecretValue: {
      flex: 1,
      fontSize: 13,
      fontFamily: Platform.select({ ios: "Courier", android: "monospace" }),
      color: isDarkMode ? "#fff" : "#555",
    },
    sharedDivider: {
      height: 8,
    },

    // ── Misc ──────────────────────────────────────────────────────────────
    bottomSpacer: {
      height: 40,
    },
  });
