// screens/Authentication.tsx
import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StackNavigationProp } from "@react-navigation/stack";
import { useNavigation } from "@react-navigation/native";
import SignClient from "@walletconnect/sign-client";
import CountryPicker, {
  Country,
  CountryCode,
} from "react-native-country-picker-modal";
import { triggerTapHapticFeedback } from "../../utils/GlobalUtils/TapHapticFeedback";
import { handleConnectPress } from "../../utils/AuthenticationUtils/WalletConnect";
import { handleSupport } from "../../utils/AuthenticationUtils/HandleAuthScreenSupport";
import { handleExit } from "../../utils/AuthenticationUtils/HandleAuthScreenExit";
import { useAuth } from "../../utils/AuthenticationUtils/AuthContext";
import { useThemeToggle } from "../../utils/GlobalUtils/ThemeProvider";
import { RootStackParamList } from "../App";
import { Ionicons } from "@expo/vector-icons";
// Import Firebase phone auth functions
import { sendOTP, verifyOTP } from "../../utils/AuthenticationUtils/PhoneAuth";

type AuthScreenNavigationProp = StackNavigationProp<RootStackParamList, "Auth">;

// Login methods enum
enum LoginMethod {
  METAMASK = "metamask",
  PHONE = "phone",
  EMAIL = "email",
}

function AuthScreen() {
  const { currentTheme } = useThemeToggle();
  const isDarkMode = currentTheme === "dark";
  const navigation = useNavigation<AuthScreenNavigationProp>();
  const { setIsLoggedIn } = useAuth();

  // Wallet connection states
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [connector, setConnector] = useState<InstanceType<
    typeof SignClient
  > | null>(null);

  // Login method and form states
  const [loginMethod, setLoginMethod] = useState<LoginMethod>(
    LoginMethod.METAMASK
  );
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [isVerificationStep, setIsVerificationStep] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);

  // Country code picker states
  const [countryCode, setCountryCode] = useState<CountryCode>("US");
  const [country, setCountry] = useState<Country | null>(null);
  const [callingCode, setCallingCode] = useState("1");
  const [withCountryNameButton, setWithCountryNameButton] = useState(false);

  // Firebase phone auth state
  const [confirm, setConfirm] = useState<any>(null);

  const onConnect = async () => {
    triggerTapHapticFeedback();
    try {
      await handleConnectPress(
        setLoading,
        setWalletAddress,
        setConnector,
        navigation,
        setIsLoggedIn
      );
    } catch (err) {
      console.error("Connect failed", err);
    }
  };

  // Validation functions
  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Handle phone number login with Firebase
  const handlePhoneLogin = async () => {
    triggerTapHapticFeedback();

    const fullPhoneNumber = `+${callingCode}${phoneNumber.replace(/\s/g, "")}`;

    const success = await sendOTP(fullPhoneNumber, setAuthLoading, setConfirm);
    if (success) {
      setIsVerificationStep(true);
    }
  };

  // Handle email login
  const handleEmailLogin = async () => {
    triggerTapHapticFeedback();

    if (!validateEmail(email)) {
      Alert.alert("Invalid Email", "Please enter a valid email address.");
      return;
    }

    if (password.length < 6) {
      Alert.alert(
        "Invalid Password",
        "Password must be at least 6 characters long."
      );
      return;
    }

    setAuthLoading(true);

    try {
      console.log("📧 Logging in with email:", email);
      await new Promise((resolve) => setTimeout(resolve, 2000));

      Alert.alert("Success", "Login successful!");
      setIsLoggedIn(true);
    } catch (error) {
      console.error("❌ Email login error:", error);
      Alert.alert("Error", "Failed to login. Please check your credentials.");
    } finally {
      setAuthLoading(false);
    }
  };

  // Handle verification code submission with Firebase
  const handleVerificationCode = async () => {
    triggerTapHapticFeedback();

    const fullPhoneNumber = `+${callingCode}${phoneNumber.replace(/\s/g, "")}`;

    await verifyOTP(
      verificationCode,
      confirm,
      fullPhoneNumber,
      setWalletAddress,
      setIsLoggedIn,
      setAuthLoading,
      navigation
    );
  };

  // Reset form data when switching login methods
  const handleMethodChange = (method: LoginMethod) => {
    setLoginMethod(method);
    setIsVerificationStep(false);
    setPhoneNumber("");
    setEmail("");
    setPassword("");
    setVerificationCode("");
    setConfirm(null);
    triggerTapHapticFeedback();
  };

  const styles = getStyles(isDarkMode);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardAvoidingView}
      >
        <View style={styles.mainContainer}>
          <ScrollView
            contentContainerStyle={styles.scrollContainer}
            showsVerticalScrollIndicator={false}
          >
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity
                onPress={() => {
                  handleExit();
                  triggerTapHapticFeedback();
                }}
              >
                <Text style={styles.exitButton}>Exit</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  handleSupport();
                  triggerTapHapticFeedback();
                }}
              >
                <Image
                  source={
                    isDarkMode
                      ? require("../../assets/images/support-logo-white.png")
                      : require("../../assets/images/support-logo-black.png")
                  }
                  style={styles.supportIcon}
                />
              </TouchableOpacity>
            </View>

            {/* Logo Section */}
            <View style={styles.logoSection}>
              <View style={styles.logoContainer}>
                <Image
                  source={
                    isDarkMode
                      ? require("../../assets/images/logo-white.png")
                      : require("../../assets/images/logo-black.png")
                  }
                  style={styles.logo}
                />
              </View>
              <Text style={styles.title}>Node Link</Text>
              <Text style={styles.subtitle}>
                Secure Decentralized P2P Messaging
              </Text>
            </View>

            {/* Login Method Selector */}
            <View style={styles.selectorContainer}>
              <Text style={styles.chooseMethodText}>
                Choose your login method
              </Text>

              <View style={styles.methodSelector}>
                {/* Metamask Tab */}
                <TouchableOpacity
                  style={[
                    styles.methodTab,
                    loginMethod === LoginMethod.METAMASK &&
                      styles.activeMethodTab,
                  ]}
                  onPress={() => handleMethodChange(LoginMethod.METAMASK)}
                >
                  <Image
                    source={require("../../assets/images/metamask.png")}
                    style={[
                      styles.tabIcon,
                      loginMethod === LoginMethod.METAMASK &&
                        styles.activeTabIcon,
                    ]}
                  />
                  <Text
                    style={[
                      styles.methodTabText,
                      loginMethod === LoginMethod.METAMASK &&
                        styles.activeMethodTabText,
                    ]}
                  >
                    Metamask
                  </Text>
                </TouchableOpacity>

                {/* Phone Tab */}
                <TouchableOpacity
                  style={[
                    styles.methodTab,
                    loginMethod === LoginMethod.PHONE && styles.activeMethodTab,
                  ]}
                  onPress={() => handleMethodChange(LoginMethod.PHONE)}
                >
                  <View style={[styles.tabIconContainer, styles.phoneTabIcon]}>
                    <Ionicons name="call" size={18} color="#fff" />
                  </View>
                  <Text
                    style={[
                      styles.methodTabText,
                      loginMethod === LoginMethod.PHONE &&
                        styles.activeMethodTabText,
                    ]}
                  >
                    Phone
                  </Text>
                </TouchableOpacity>

                {/* Email Tab */}
                <TouchableOpacity
                  style={[
                    styles.methodTab,
                    loginMethod === LoginMethod.EMAIL && styles.activeMethodTab,
                  ]}
                  onPress={() => handleMethodChange(LoginMethod.EMAIL)}
                >
                  <View style={[styles.tabIconContainer, styles.emailTabIcon]}>
                    <Ionicons name="mail" size={18} color="#fff" />
                  </View>
                  <Text
                    style={[
                      styles.methodTabText,
                      loginMethod === LoginMethod.EMAIL &&
                        styles.activeMethodTabText,
                    ]}
                  >
                    Email
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Login Forms */}
            <View style={styles.loginFormContainer}>
              {/* Metamask Login */}
              {loginMethod === LoginMethod.METAMASK && (
                <View style={styles.formCard}>
                  <TouchableOpacity
                    style={styles.connectButton}
                    onPress={onConnect}
                    disabled={loading}
                    activeOpacity={0.85}
                  >
                    <Image
                      source={require("../../assets/images/metamask.png")}
                      style={styles.buttonIcon}
                    />
                    <Text style={styles.connectButtonText}>
                      {loading ? "Connecting..." : "Connect Metamask Wallet"}
                    </Text>
                  </TouchableOpacity>

                  {walletAddress && (
                    <View style={styles.connectedContainer}>
                      <Ionicons name="checkmark-circle" size={18} color="#34C759" />
                      <Text style={styles.connectedText}>
                        Connected: {walletAddress.slice(0, 10)}...
                        {walletAddress.slice(-6)}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {/* Phone Login */}
              {loginMethod === LoginMethod.PHONE && (
                <View style={styles.formCard}>
                  {!isVerificationStep ? (
                    <>
                      <Text style={styles.formTitle}>
                        Enter your phone number
                      </Text>

                      <View style={styles.phoneInputContainer}>
                        <View style={[styles.countryPickerButton, styles.inputBorder]}>
                          <CountryPicker
                            countryCode={countryCode}
                            withFilter
                            withFlag
                            withCountryNameButton={withCountryNameButton}
                            withCallingCodeButton
                            withEmoji
                            onSelect={(selectedCountry: Country) => {
                              setCountryCode(selectedCountry.cca2);
                              setCountry(selectedCountry);
                              setCallingCode(selectedCountry.callingCode[0]);
                            }}
                            containerButtonStyle={styles.countryPickerContainer}
                          />
                        </View>

                        <View style={styles.phoneInputWrapper}>
                          <TextInput
                            style={styles.phoneInput}
                            placeholder="Phone number"
                            placeholderTextColor={isDarkMode ? "#8E8E93" : "#999"}
                            value={phoneNumber}
                            onChangeText={setPhoneNumber}
                            keyboardType="phone-pad"
                            textContentType="telephoneNumber"
                            autoComplete="tel"
                          />
                        </View>
                      </View>

                      {phoneNumber.trim() && (
                        <View style={styles.phonePreviewRow}>
                          <Ionicons name="information-circle-outline" size={14} color={isDarkMode ? "#8E8E93" : "#999"} />
                          <Text style={styles.phonePreview}>
                            Full number: +{callingCode} {phoneNumber}
                          </Text>
                        </View>
                      )}

                      <TouchableOpacity
                        style={[
                          styles.primaryButton,
                          (!phoneNumber.trim() || authLoading) && styles.buttonDisabled,
                        ]}
                        onPress={handlePhoneLogin}
                        disabled={authLoading || !phoneNumber.trim()}
                        activeOpacity={0.85}
                      >
                        <Ionicons name="paper-plane" size={18} color="#fff" style={{ marginRight: 8 }} />
                        <Text style={styles.primaryButtonText}>
                          {authLoading ? "Sending Code..." : "Send Verification Code"}
                        </Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <>
                      <Text style={styles.formTitle}>
                        Enter verification code
                      </Text>
                      <Text style={styles.formSubtitle}>
                        Code sent to +{callingCode} {phoneNumber}
                      </Text>

                      <TextInput
                        style={styles.codeInput}
                        placeholder="123456"
                        placeholderTextColor={isDarkMode ? "#8E8E93" : "#999"}
                        value={verificationCode}
                        onChangeText={setVerificationCode}
                        keyboardType="number-pad"
                        maxLength={6}
                        textAlign="center"
                      />

                      <TouchableOpacity
                        style={[
                          styles.primaryButton,
                          (authLoading || verificationCode.length !== 6) && styles.buttonDisabled,
                        ]}
                        onPress={handleVerificationCode}
                        disabled={authLoading || verificationCode.length !== 6}
                        activeOpacity={0.85}
                      >
                        <Ionicons name="shield-checkmark" size={18} color="#fff" style={{ marginRight: 8 }} />
                        <Text style={styles.primaryButtonText}>
                          {authLoading ? "Verifying..." : "Verify Code"}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => {
                          setIsVerificationStep(false);
                          setVerificationCode("");
                          setConfirm(null);
                          triggerTapHapticFeedback();
                        }}
                      >
                        <Ionicons name="arrow-back" size={16} color="#007AFF" style={{ marginRight: 4 }} />
                        <Text style={styles.backButtonText}>
                          Back to phone number
                        </Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              )}

              {/* Email Login */}
              {loginMethod === LoginMethod.EMAIL && (
                <View style={styles.formCard}>
                  <Text style={styles.formTitle}>
                    Sign in with email
                  </Text>

                  <View style={styles.inputRow}>
                    <Ionicons
                      name="mail-outline"
                      size={20}
                      color={isDarkMode ? "#8E8E93" : "#999"}
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="Email address"
                      placeholderTextColor={isDarkMode ? "#8E8E93" : "#999"}
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                      textContentType="emailAddress"
                      autoComplete="email"
                      autoCapitalize="none"
                    />
                  </View>

                  <View style={styles.inputRow}>
                    <Ionicons
                      name="lock-closed-outline"
                      size={20}
                      color={isDarkMode ? "#8E8E93" : "#999"}
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="Password"
                      placeholderTextColor={isDarkMode ? "#8E8E93" : "#999"}
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry
                      textContentType="password"
                      autoComplete="password"
                    />
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.primaryButton,
                      (authLoading || !email.trim() || !password.trim()) && styles.buttonDisabled,
                    ]}
                    onPress={handleEmailLogin}
                    disabled={authLoading || !email.trim() || !password.trim()}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="log-in-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
                    <Text style={styles.primaryButtonText}>
                      {authLoading ? "Signing In..." : "Sign In"}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </ScrollView>

          {/* Fixed Bottom Terms & Privacy */}
          <View style={styles.fixedBottomContainer}>
            <Text style={styles.termsText}>
              By logging in, you agree to our{" "}
              <Text
                style={styles.link}
                onPress={() => navigation.navigate("TOS")}
              >
                Terms of Service
              </Text>{" "}
              and{" "}
              <Text
                style={styles.link}
                onPress={() => navigation.navigate("PrivacyPolicy")}
              >
                Privacy Policy
              </Text>
              .
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const getStyles = (isDarkMode: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDarkMode ? "#1C1C1D" : "#F2F2F2",
    },
    keyboardAvoidingView: {
      flex: 1,
    },
    mainContainer: {
      flex: 1,
      justifyContent: "space-between",
    },
    scrollContainer: {
      flexGrow: 1,
      paddingHorizontal: 20,
      paddingVertical: 20,
    },

    // ── Header ────────────────────────────────────────────────────────────
    header: {
      width: "100%",
      flexDirection: "row",
      justifyContent: "space-between",
      paddingHorizontal: 3,
      marginBottom: 20,
    },
    exitButton: {
      color: "#007AFF",
      fontSize: 17,
      fontWeight: "500",
    },
    supportIcon: {
      width: 25,
      height: 25,
    },

    // ── Logo ──────────────────────────────────────────────────────────────
    logoSection: {
      alignItems: "center",
      marginBottom: 32,
    },
    logoContainer: {
      width: 100,
      height: 100,
      borderRadius: 24,
      backgroundColor: isDarkMode ? "#2C2C2E" : "#FFFFFF",
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 20,
      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: isDarkMode ? 0.3 : 0.08,
          shadowRadius: 6,
        },
        android: { elevation: 3 },
      }),
    },
    logo: {
      width: 70,
      height: 70,
    },
    title: {
      fontSize: 32,
      fontWeight: "bold",
      marginBottom: 8,
      fontFamily: "MontserratAlternates-Regular",
      textAlign: "center",
      color: isDarkMode ? "#fff" : "#333",
    },
    subtitle: {
      fontSize: 15,
      fontWeight: "600",
      marginTop: 6,
      fontFamily: "Inter_28pt-Medium",
      textAlign: "center",
      color: isDarkMode ? "#8E8E93" : "#8E8E93",
    },

    // ── Method Selector ──────────────────────────────────────────────────
    selectorContainer: {
      width: "100%",
      alignItems: "center",
      marginBottom: 24,
    },
    chooseMethodText: {
      fontSize: 15,
      fontWeight: "600",
      marginBottom: 14,
      textAlign: "center",
      color: isDarkMode ? "#ddd" : "#555",
    },
    methodSelector: {
      flexDirection: "row",
      backgroundColor: isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)",
      borderRadius: 14,
      padding: 4,
      width: "100%",
    },
    methodTab: {
      flex: 1,
      flexDirection: "column",
      alignItems: "center",
      paddingVertical: 12,
      paddingHorizontal: 8,
      borderRadius: 11,
      marginHorizontal: 2,
    },
    activeMethodTab: {
      backgroundColor: isDarkMode ? "#2C2C2E" : "#fff",
      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: isDarkMode ? 0.3 : 0.1,
          shadowRadius: 3,
        },
        android: { elevation: 3 },
      }),
    },
    tabIcon: {
      width: 24,
      height: 20,
      marginBottom: 6,
      opacity: 0.5,
    },
    activeTabIcon: {
      opacity: 1,
    },
    tabIconContainer: {
      width: 28,
      height: 28,
      borderRadius: 14,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 6,
    },
    phoneTabIcon: {
      backgroundColor: "#34C759",
    },
    emailTabIcon: {
      backgroundColor: "#007AFF",
    },
    methodTabText: {
      fontSize: 12,
      fontWeight: "600",
      textAlign: "center",
      color: isDarkMode ? "#8E8E93" : "#999",
    },
    activeMethodTabText: {
      color: "#007AFF",
    },

    // ── Forms ────────────────────────────────────────────────────────────
    loginFormContainer: {
      width: "100%",
      alignItems: "center",
    },
    formCard: {
      width: "100%",
      backgroundColor: isDarkMode ? "#1C1C1E" : "#FFFFFF",
      borderRadius: 14,
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
    formTitle: {
      fontSize: 18,
      fontWeight: "600",
      marginBottom: 16,
      textAlign: "center",
      color: isDarkMode ? "#fff" : "#333",
    },
    formSubtitle: {
      fontSize: 14,
      color: isDarkMode ? "#8E8E93" : "#999",
      marginBottom: 20,
      textAlign: "center",
    },

    // ── Connect Button (Metamask) ──────────────────────────────────────
    connectButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#007AFF",
      paddingVertical: 16,
      paddingHorizontal: 24,
      borderRadius: 14,
      width: "100%",
      ...Platform.select({
        ios: {
          shadowColor: "#007AFF",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.3,
          shadowRadius: 4,
        },
        android: { elevation: 4 },
      }),
    },
    buttonIcon: {
      width: 22,
      height: 22,
      marginRight: 10,
    },
    connectButtonText: {
      color: "#fff",
      fontSize: 17,
      fontWeight: "600",
    },
    connectedContainer: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 16,
      padding: 12,
      backgroundColor: isDarkMode ? "#1A2E1A" : "#F0FFF0",
      borderRadius: 10,
    },
    connectedText: {
      fontSize: 14,
      color: "#34C759",
      fontWeight: "500",
      marginLeft: 8,
      flex: 1,
    },

    // ── Input Fields ─────────────────────────────────────────────────────
    inputRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: isDarkMode ? "#2C2C2E" : "#F8F9FA",
      borderRadius: 12,
      borderWidth: 1,
      borderColor: isDarkMode ? "#38383A" : "#E0E0E0",
      marginBottom: 14,
      paddingHorizontal: 14,
    },
    inputIcon: {
      marginRight: 10,
    },
    input: {
      flex: 1,
      paddingVertical: 14,
      fontSize: 16,
      color: isDarkMode ? "#fff" : "#333",
    },

    // ── Phone Input ──────────────────────────────────────────────────────
    phoneInputContainer: {
      flexDirection: "row",
      width: "100%",
      marginBottom: 12,
      gap: 10,
    },
    inputBorder: {
      borderWidth: 1,
      borderColor: isDarkMode ? "#38383A" : "#E0E0E0",
    },
    countryPickerButton: {
      paddingVertical: 14,
      paddingHorizontal: 12,
      borderRadius: 12,
      justifyContent: "center",
      alignItems: "center",
      minWidth: 80,
      backgroundColor: isDarkMode ? "#2C2C2E" : "#F8F9FA",
    },
    countryPickerContainer: {
      flexDirection: "row",
      alignItems: "center",
    },
    phoneInputWrapper: {
      flex: 1,
      backgroundColor: isDarkMode ? "#2C2C2E" : "#F8F9FA",
      borderRadius: 12,
      borderWidth: 1,
      borderColor: isDarkMode ? "#38383A" : "#E0E0E0",
      paddingHorizontal: 14,
      justifyContent: "center",
    },
    phoneInput: {
      fontSize: 16,
      color: isDarkMode ? "#fff" : "#333",
      paddingVertical: 14,
    },
    phonePreviewRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 16,
    },
    phonePreview: {
      fontSize: 13,
      color: isDarkMode ? "#8E8E93" : "#999",
      marginLeft: 4,
      fontWeight: "500",
    },

    // ── Code Input ───────────────────────────────────────────────────────
    codeInput: {
      width: "100%",
      paddingVertical: 16,
      paddingHorizontal: 20,
      backgroundColor: isDarkMode ? "#2C2C2E" : "#F8F9FA",
      borderRadius: 12,
      borderWidth: 1,
      borderColor: isDarkMode ? "#38383A" : "#E0E0E0",
      fontSize: 28,
      fontWeight: "700",
      letterSpacing: 10,
      textAlign: "center",
      color: isDarkMode ? "#fff" : "#333",
      marginBottom: 16,
    },

    // ── Primary Button ───────────────────────────────────────────────────
    primaryButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#007AFF",
      paddingVertical: 15,
      paddingHorizontal: 24,
      borderRadius: 12,
      width: "100%",
      ...Platform.select({
        ios: {
          shadowColor: "#007AFF",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 4,
        },
        android: { elevation: 4 },
      }),
    },
    primaryButtonText: {
      color: "#fff",
      fontSize: 16,
      fontWeight: "600",
    },
    buttonDisabled: {
      opacity: 0.5,
    },

    // ── Back Button (Phone verification) ────────────────────────────────
    backButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      marginTop: 16,
      paddingVertical: 8,
    },
    backButtonText: {
      fontSize: 15,
      color: "#007AFF",
      fontWeight: "500",
    },

    // ── Bottom Bar ──────────────────────────────────────────────────────
    fixedBottomContainer: {
      paddingVertical: 14,
      paddingHorizontal: 20,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: isDarkMode ? "#38383A" : "#E0E0E0",
      backgroundColor: isDarkMode ? "#1C1C1D" : "#F2F2F2",
    },
    termsText: {
      fontSize: 11,
      textAlign: "center",
      color: isDarkMode ? "#8E8E93" : "#999",
      lineHeight: 16,
    },
    link: {
      color: "#007AFF",
      textDecorationLine: "underline",
    },
  });

export default AuthScreen;
