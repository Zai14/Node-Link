// screens/Settings/SettingsScreen.tsx

import React, { useCallback, useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Switch,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Image,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { copyToClipboard } from "../../utils/GlobalUtils/CopyToClipboard";
import { useThemeToggle } from "../../utils/GlobalUtils/ThemeProvider";
import { UserData } from "../../backend/Supabase/RegisterUser";
import {
  getUserDataFromSession,
  loadUserDataFromStorage,
} from "../../backend/Local database/AsyncStorage/UserDataStorage/UtilityIndex";
import { refreshUserDataFromSupabase } from "../../backend/Supabase/RefreshUserData";
import {
  hasActiveWalletSession,
  signInWithWallet,
} from "../../utils/AuthenticationUtils/SupabaseAuth";

import { useLogout } from "../../utils/AuthenticationUtils/Logout";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaView } from "react-native-safe-area-context";
import { deleteUserByWallet } from "../../backend/Supabase/DeleteUserData";

// Navigation type
export type SettingsStackParamList = {
  Settings: undefined;
  Appearance: undefined;
  MyProfile: undefined;
  Notifications: undefined;
  HapticFeedback: undefined;
  PrivacyPolicy: undefined;
  Security: undefined;
};

type SettingsNavigationProp = StackNavigationProp<
  SettingsStackParamList,
  "Settings"
>;

export default function SettingsScreen() {
  const { currentTheme, toggleTheme } = useThemeToggle();
  const isDarkMode = currentTheme === "dark";
  const [copied, setCopied] = useState(false);
  const navigation = useNavigation<SettingsNavigationProp>();
  const logout = useLogout();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(true);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [supabaseAuthStatus, setSupabaseAuthStatus] = useState<
    "checking" | "active" | "inactive" | "error"
  >("checking");

  // Load wallet address and check Supabase Auth status
  useEffect(() => {
    const loadWalletAddress = async () => {
      try {
        const address = await AsyncStorage.getItem("walletAddress");
        if (address) {
          setWalletAddress(address);
          const active = await hasActiveWalletSession(address);
          setSupabaseAuthStatus(active ? "active" : "inactive");
        } else {
          setSupabaseAuthStatus("inactive");
        }
      } catch (error) {
        console.error("❌ Error loading wallet address:", error);
        setSupabaseAuthStatus("error");
      }
    };
    loadWalletAddress();
  }, []);

  // Load user data function
  const loadUserData = useCallback(async () => {
    if (!walletAddress) {
      console.warn("No wallet address available");
      return;
    }

    const sessionData = getUserDataFromSession(walletAddress);
    if (sessionData) {
      setUserData(sessionData);
      return;
    }

    const storageData = await loadUserDataFromStorage(walletAddress);
    if (storageData) {
      setUserData(storageData);
      return;
    }

    console.log("No local data found, refreshing from Supabase...");
    try {
      const refreshedData = await refreshUserDataFromSupabase();
      if (refreshedData) {
        setUserData(refreshedData as UserData);
      }
    } catch (error) {
      console.error("❌ Error refreshing from Supabase:", error);
    }
  }, [walletAddress]);

  // Load data when wallet address is available
  useEffect(() => {
    if (walletAddress) {
      loadUserData();
    }
  }, [walletAddress, loadUserData]);

  // Reload data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (walletAddress) {
        loadUserData();
      }
    }, [walletAddress, loadUserData])
  );

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const refreshedData = await refreshUserDataFromSupabase();
      if (refreshedData) {
        setUserData(refreshedData as UserData);
      }
    } catch (error) {
      console.error("❌ Error during pull-to-refresh:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const toggleDarkMode = async () => {
    await toggleTheme();
  };

  const handleCopyAddress = async () => {
    if (!userData?.walletAddress) return;
    const success = await copyToClipboard(userData.walletAddress);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "⚠️ Delete Account",
      `This action will permanently delete your account and all associated data including:\n\n• Your profile information\n• All chat messages\n• Encryption keys\n• User preferences\n• Profile images\n\nThis action cannot be undone and you will be logged out immediately.\n\nAre you sure you want to continue?`,
      [
        {
          text: "Cancel",
          style: "cancel",
          onPress: () => console.log("Account deletion cancelled"),
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            Alert.alert(
              "🚨 Final Confirmation",
              `This is your last chance to cancel.\n\nYour account "${
                userData?.username || "Unknown"
              }" will be permanently deleted and you will be logged out immediately.\n\nThis action is irreversible.\n\nAre you absolutely sure?`,
              [
                {
                  text: "Cancel",
                  style: "cancel",
                  onPress: () => console.log("Final confirmation cancelled"),
                },
                {
                  text: "YES, DELETE FOREVER",
                  style: "destructive",
                  onPress: performAccountDeletion,
                },
              ]
            );
          },
        },
      ]
    );
  };

  // Create a logout function without the confirmation dialog for account deletion
  const logoutWithoutConfirmation = () => {
    return new Promise<void>((resolve) => {
      const performLogout = async () => {
        try {
          console.log("🚪 Starting logout process after account deletion...");
          await AsyncStorage.clear();
          console.log("All local storage cleared");
          resolve();
        } catch (error) {
          console.error("❌ Error during logout:", error);
          resolve();
        }
      };
      performLogout();
    });
  };

  // Account deletion function using your logout
  const performAccountDeletion = async () => {
    if (!userData?.walletAddress) {
      Alert.alert("Error", "No wallet address found. Cannot delete account.");
      return;
    }

    setIsDeletingAccount(true);

    try {
      console.log("🗑️ Starting account deletion process...");

      const result = await deleteUserByWallet(userData.walletAddress);

      if (result.success) {
        console.log("Account deleted successfully from Supabase");

        setUserData(null);
        setWalletAddress(null);

        Alert.alert(
          "✅ Account Deleted",
          "Your account has been permanently deleted from our servers. You will now be logged out and all local data will be cleared.",
          [
            {
              text: "OK",
              onPress: () => {
                console.log("🚪 Proceeding with logout after account deletion");
                logout();
              },
            },
          ],
          { cancelable: false }
        );
      } else {
        console.error("❌ Account deletion failed:", result.error);

        Alert.alert(
          "❌ Deletion Failed",
          `Unable to delete your account: ${result.error}\n\nPlease try again or contact support if the problem persists.`,
          [{ text: "OK" }]
        );
      }
    } catch (error) {
      console.error("❌ Unexpected error during account deletion:", error);

      Alert.alert(
        "❌ Deletion Error",
        "An unexpected error occurred while deleting your account. Please check your internet connection and try again.",
        [{ text: "OK" }]
      );
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const styles = getStyles(isDarkMode);

  const profileImageSource =
    userData && userData.avatar !== "default"
      ? { uri: userData.avatar }
      : require("../../assets/images/default-user-avatar.jpg");

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* ═══════════════ Header ═══════════════ */}
      <View style={styles.headerContainer}>
        <Text style={styles.headerTitleText}>Settings</Text>
        <TouchableOpacity onPress={handleCopyAddress} style={styles.headerRight}>
          {copied ? (
            <View style={styles.copyContainer}>
              <Text style={styles.copyAddressButton}>Copied</Text>
              <Ionicons
                name="checkmark"
                size={18}
                color="#34C759"
                style={{ marginLeft: 4 }}
              />
            </View>
          ) : (
            <Text style={styles.copyAddressButton}>Copy Address</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
      >
        {/* ═══════════════ PROFILE ═══════════════ */}
        <Text style={styles.sectionHeader}>PROFILE</Text>
        <TouchableOpacity
          style={styles.profileCard}
          onPress={() => navigation.navigate("MyProfile")}
          activeOpacity={0.7}
        >
          <View style={styles.profileImageContainer}>
            <Image
              source={profileImageSource}
              style={styles.profileImage}
              onLoadStart={() => setImageLoading(true)}
              onLoadEnd={() => setImageLoading(false)}
              onError={() => setImageLoading(false)}
            />
            {imageLoading && (
              <View style={styles.imageLoadingOverlay}>
                <ActivityIndicator
                  size="small"
                  color={isDarkMode ? "#fff" : "#007AFF"}
                />
              </View>
            )}
          </View>
          <View style={styles.profileTextContainer}>
            <Text style={styles.profileName} numberOfLines={1}>
              {userData
                ? userData.name && userData.name.length > 25
                  ? userData.name.slice(0, 25) + "..."
                  : userData.name ?? "NodeLink User"
                : "NodeLink User"}
            </Text>
            <Text style={styles.profileAddress} numberOfLines={1}>
              {userData?.walletAddress ?? "Loading..."}
            </Text>
            <View style={styles.authStatusRow}>
              <View
                style={[
                  styles.authStatusDot,
                  {
                    backgroundColor:
                      supabaseAuthStatus === "active"
                        ? "#34C759"
                        : supabaseAuthStatus === "checking"
                        ? "#FF9500"
                        : isDarkMode
                        ? "#555"
                        : "#bbb",
                  },
                ]}
              />
              <Text
                style={[
                  styles.authStatusText,
                  {
                    color:
                      supabaseAuthStatus === "active"
                        ? "#34C759"
                        : supabaseAuthStatus === "checking"
                        ? "#FF9500"
                        : isDarkMode
                        ? "#888"
                        : "#999",
                  },
                ]}
              >
                {supabaseAuthStatus === "active"
                  ? "Synced"
                  : supabaseAuthStatus === "checking"
                  ? "Checking..."
                  : supabaseAuthStatus === "error"
                  ? "Error"
                  : "Offline"}
              </Text>
            </View>
          </View>
          <Ionicons
            name="chevron-forward"
            size={20}
            color={isDarkMode ? "#8E8E93" : "#C7C7CC"}
          />
        </TouchableOpacity>

        {/* ═══════════════ SETTINGS ═══════════════ */}
        <Text style={styles.sectionHeader}>SETTINGS</Text>
        <View style={styles.cardSection}>
          {/* Security */}
          <TouchableOpacity
            style={styles.settingsRow}
            onPress={() => navigation.navigate("Security")}
            activeOpacity={0.5}
          >
            <View style={styles.itemLeft}>
              <Ionicons
                name="shield-checkmark-outline"
                size={22}
                color={isDarkMode ? "#FFF" : "#333"}
                style={{ marginRight: 12 }}
              />
              <Text style={styles.itemTitle}>Security</Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={isDarkMode ? "#8E8E93" : "#C7C7CC"}
            />
          </TouchableOpacity>

          <View style={styles.cardDivider} />

          {/* Theme */}
          <View style={styles.settingsRow}>
            <View style={styles.itemLeft}>
              <Ionicons
                name={isDarkMode ? "moon" : "sunny"}
                size={22}
                color={isDarkMode ? "#FFF" : "#333"}
                style={{ marginRight: 12 }}
              />
              <Text style={styles.itemTitle}>
                {isDarkMode ? "Light Mode" : "Dark Mode"}
              </Text>
            </View>
            <Switch
              value={isDarkMode}
              onValueChange={toggleDarkMode}
              trackColor={{ false: isDarkMode ? "#38383A" : "#E9E9EA", true: "#34C759" }}
              thumbColor="#FFFFFF"
              ios_backgroundColor={isDarkMode ? "#38383A" : "#E9E9EA"}
            />
          </View>

          <View style={styles.cardDivider} />

          {/* Notifications */}
          <TouchableOpacity
            style={styles.settingsRow}
            onPress={() => navigation.navigate("Notifications")}
            activeOpacity={0.5}
          >
            <View style={styles.itemLeft}>
              <Ionicons
                name="notifications-outline"
                size={22}
                color={isDarkMode ? "#FFF" : "#333"}
                style={{ marginRight: 12 }}
              />
              <Text style={styles.itemTitle}>Notifications</Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={isDarkMode ? "#8E8E93" : "#C7C7CC"}
            />
          </TouchableOpacity>

          <View style={styles.cardDivider} />

          {/* Appearance */}
          <TouchableOpacity
            style={styles.settingsRow}
            onPress={() => navigation.navigate("Appearance")}
            activeOpacity={0.5}
          >
            <View style={styles.itemLeft}>
              <Ionicons
                name="color-palette-outline"
                size={22}
                color={isDarkMode ? "#FFF" : "#333"}
                style={{ marginRight: 12 }}
              />
              <Text style={styles.itemTitle}>Appearance</Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={isDarkMode ? "#8E8E93" : "#C7C7CC"}
            />
          </TouchableOpacity>

          <View style={styles.cardDivider} />

          {/* Haptic Feedback */}
          <TouchableOpacity
            style={styles.settingsRow}
            onPress={() => navigation.navigate("HapticFeedback")}
            activeOpacity={0.5}
          >
            <View style={styles.itemLeft}>
              <Ionicons
                name="hardware-chip-outline"
                size={22}
                color={isDarkMode ? "#FFF" : "#333"}
                style={{ marginRight: 12 }}
              />
              <Text style={styles.itemTitle}>Haptic Feedback</Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={isDarkMode ? "#8E8E93" : "#C7C7CC"}
            />
          </TouchableOpacity>

          <View style={styles.cardDivider} />

          {/* Privacy */}
          <TouchableOpacity
            style={[styles.settingsRow, { borderBottomWidth: 0 }]}
            onPress={() => navigation.navigate("PrivacyPolicy")}
            activeOpacity={0.5}
          >
            <View style={styles.itemLeft}>
              <Ionicons
                name="lock-closed-outline"
                size={22}
                color={isDarkMode ? "#FFF" : "#333"}
                style={{ marginRight: 12 }}
              />
              <Text style={styles.itemTitle}>Privacy & Security</Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={isDarkMode ? "#8E8E93" : "#C7C7CC"}
            />
          </TouchableOpacity>
        </View>

        {/* ═══════════════ AUTHENTICATION ═══════════════ */}
        <Text style={styles.sectionHeader}>AUTHENTICATION</Text>
        <View style={styles.cardSection}>
          <View style={[styles.settingsRow, { borderBottomWidth: 0 }]}>
            <View style={styles.itemLeft}>
              <Ionicons
                name={
                  supabaseAuthStatus === "active"
                    ? "checkmark-circle"
                    : supabaseAuthStatus === "checking"
                    ? "sync-circle-outline"
                    : "close-circle"
                }
                size={22}
                color={
                  supabaseAuthStatus === "active"
                    ? "#34C759"
                    : supabaseAuthStatus === "checking"
                    ? "#FF9500"
                    : "#FF3B30"
                }
                style={{ marginRight: 12 }}
              />
              <View>
                <Text style={styles.itemTitle}>Cloud Sync</Text>
                <Text
                  style={[
                    styles.itemSubtitle,
                    {
                      color:
                        supabaseAuthStatus === "active"
                          ? "#34C759"
                          : supabaseAuthStatus === "checking"
                          ? "#FF9500"
                          : isDarkMode
                          ? "#888"
                          : "#999",
                    },
                  ]}
                >
                  {supabaseAuthStatus === "active"
                    ? "Active"
                    : supabaseAuthStatus === "checking"
                    ? "Checking..."
                    : supabaseAuthStatus === "error"
                    ? "Error"
                    : "Not connected"}
                </Text>
              </View>
            </View>
            {supabaseAuthStatus === "inactive" && walletAddress && (
              <TouchableOpacity
                onPress={async () => {
                  setSupabaseAuthStatus("checking");
                  const { error } = await signInWithWallet(walletAddress);
                  setSupabaseAuthStatus(error ? "inactive" : "active");
                }}
                style={styles.reconnectButton}
              >
                <Text style={styles.reconnectButtonText}>Reconnect</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ═══════════════ ACCOUNT ═══════════════ */}
        <Text style={styles.sectionHeader}>ACCOUNT</Text>
        <View style={styles.cardSection}>
          <TouchableOpacity
            style={styles.settingsRow}
            onPress={logout}
            activeOpacity={0.5}
          >
            <View style={styles.itemLeft}>
              <Ionicons
                name="log-out-outline"
                size={22}
                color="#FF3B30"
                style={{ marginRight: 12 }}
              />
              <Text style={[styles.itemTitle, { color: "#FF3B30" }]}>
                Logout
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={isDarkMode ? "#8E8E93" : "#C7C7CC"}
            />
          </TouchableOpacity>

          <View style={styles.cardDivider} />

          <TouchableOpacity
            style={[styles.settingsRow, { borderBottomWidth: 0 }]}
            onPress={handleDeleteAccount}
            disabled={isDeletingAccount}
            activeOpacity={0.5}
          >
            <View style={styles.itemLeft}>
              {isDeletingAccount ? (
                <ActivityIndicator
                  size="small"
                  color="#FF3B30"
                  style={{ marginRight: 12 }}
                />
              ) : (
                <Ionicons
                  name="trash-outline"
                  size={22}
                  color="#FF3B30"
                  style={{ marginRight: 12 }}
                />
              )}
              <Text
                style={[
                  styles.itemTitle,
                  { color: "#FF3B30" },
                  isDeletingAccount && { opacity: 0.6 },
                ]}
              >
                {isDeletingAccount ? "Deleting Account..." : "Delete Account"}
              </Text>
            </View>
            {!isDeletingAccount && (
              <Ionicons
                name="warning-outline"
                size={18}
                color="#FF3B30"
              />
            )}
          </TouchableOpacity>
        </View>

        {/* Bottom spacer for scroll */}
        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

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
      justifyContent: "space-between",
      height: 44,
      paddingHorizontal: 16,
      backgroundColor: isDarkMode ? "#1C1C1D" : "#F2F2F2",
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: isDarkMode ? "#333" : "#E0E0E0",
    },
    headerTitleText: {
      fontSize: 17,
      fontFamily: "SF-Pro-Text-Medium",
      fontWeight: "600",
      color: isDarkMode ? "#fff" : "#333333",
    },
    headerRight: {
      zIndex: 1,
    },
    copyAddressButton: {
      fontSize: 13,
      fontWeight: "500",
      color: "#007AFF",
    },
    copyContainer: {
      flexDirection: "row",
      alignItems: "center",
    },

    // ── Scroll ──────────────────────────────────────────────────────────────
    scrollContainer: {
      flex: 1,
    },
    scrollContent: {
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

    // ── Profile Card ───────────────────────────────────────────────────────
    profileCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: isDarkMode ? "#1C1C1E" : "#FFFFFF",
      borderRadius: 12,
      marginHorizontal: 16,
      padding: 16,
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
    profileImageContainer: {
      position: "relative",
      marginRight: 14,
    },
    profileImage: {
      width: 70,
      height: 70,
      borderRadius: 35,
      backgroundColor: "#ccc",
    },
    imageLoadingOverlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      width: 70,
      height: 70,
      borderRadius: 35,
      backgroundColor: "rgba(0, 0, 0, 0.3)",
      justifyContent: "center",
      alignItems: "center",
    },
    profileTextContainer: {
      flex: 1,
      marginRight: 8,
    },
    profileName: {
      fontSize: 17,
      fontFamily: "SF-Pro-Text-Medium",
      fontWeight: "600",
      color: isDarkMode ? "#fff" : "#333333",
      marginBottom: 2,
    },
    profileAddress: {
      fontSize: 12,
      color: "#1E90FF",
      marginTop: 2,
    },
    authStatusRow: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 6,
    },
    authStatusDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginRight: 6,
    },
    authStatusText: {
      fontSize: 12,
    },

    // ── Card Sections ──────────────────────────────────────────────────────
    cardSection: {
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
    settingsRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 13,
    },
    cardDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: isDarkMode ? "#38383A" : "#E0E0E0",
    },
    itemLeft: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
    },
    itemTitle: {
      fontSize: 17,
      color: isDarkMode ? "#fff" : "#333333",
    },
    itemSubtitle: {
      fontSize: 12,
      marginTop: 2,
    },

    // ── Reconnect Button ───────────────────────────────────────────────────
    reconnectButton: {
      backgroundColor: "#007AFF",
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 8,
    },
    reconnectButtonText: {
      color: "#fff",
      fontSize: 13,
      fontWeight: "600",
    },

    // ── Misc ──────────────────────────────────────────────────────────────
    bottomSpacer: {
      height: 40,
    },
  });
