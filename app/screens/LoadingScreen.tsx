// screens/LoadingScreen.tsx
import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated, Easing, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import SvgLogoDark from "../../assets/images/logo-white.svg";
import SvgLogoLight from "../../assets/images/logo-black.svg";
import { useThemeToggle } from "../../utils/GlobalUtils/ThemeProvider";

export default function LoadingScreen() {
  const { currentTheme } = useThemeToggle();
  const isDarkMode = currentTheme === "dark";
  const styles = getStyles(isDarkMode);

  const LogoComponent = isDarkMode ? SvgLogoDark : SvgLogoLight;

  // ── Breathing animation ────────────────────────────────────────────────
  const breatheAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const breathe = Animated.loop(
      Animated.sequence([
        Animated.timing(breatheAnim, {
          toValue: 1.06,
          duration: 1200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(breatheAnim, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    breathe.start();
    return () => breathe.stop();
  }, [breatheAnim]);

  // ── Fade-in animation for text ─────────────────────────────────────────
  const textFadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(textFadeAnim, {
      toValue: 1,
      duration: 800,
      delay: 400,
      useNativeDriver: true,
    }).start();
  }, [textFadeAnim]);

  // ── Loading dots animation ─────────────────────────────────────────────
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animateDot = (dot: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0.3,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      );
    };

    const anim1 = animateDot(dot1, 0);
    const anim2 = animateDot(dot2, 200);
    const anim3 = animateDot(dot3, 400);

    Animated.parallel([anim1, anim2, anim3]).start();

    return () => {
      anim1.stop();
      anim2.stop();
      anim3.stop();
    };
  }, [dot1, dot2, dot3]);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.content}>
        {/* Logo */}
        <Animated.View style={{ transform: [{ scale: breatheAnim }] }}>
          <LogoComponent width={160} height={160} />
        </Animated.View>

        {/* App Name */}
        <Animated.Text style={[styles.title, { opacity: textFadeAnim }]}>
          NodeLink
        </Animated.Text>

        {/* Tagline */}
        <Animated.Text style={[styles.tagline, { opacity: textFadeAnim }]}>
          Secure P2P Messaging
        </Animated.Text>

        {/* Loading Dots */}
        <View style={styles.dotsContainer}>
          <Animated.View style={[styles.dot, { opacity: dot1 }]} />
          <Animated.View style={[styles.dot, { opacity: dot2 }]} />
          <Animated.View style={[styles.dot, { opacity: dot3 }]} />
        </View>
      </View>

      {/* Version */}
      <Text style={styles.version}>v1.0.0</Text>
    </SafeAreaView>
  );
}

const getStyles = (isDarkMode: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDarkMode ? "#121212" : "#FFFFFF",
    },
    content: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingBottom: 40,
    },
    title: {
      fontSize: 28,
      fontWeight: "bold",
      fontFamily: "MontserratAlternates-Regular",
      color: isDarkMode ? "#FFFFFF" : "#333333",
      marginTop: 24,
    },
    tagline: {
      fontSize: 14,
      fontWeight: "500",
      color: isDarkMode ? "#8E8E93" : "#8E8E93",
      marginTop: 6,
      letterSpacing: 0.3,
    },
    dotsContainer: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 32,
      gap: 6,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: isDarkMode ? "#8E8E93" : "#8E8E93",
    },
    version: {
      fontSize: 12,
      color: isDarkMode ? "#555" : "#ccc",
      textAlign: "center",
      paddingBottom: 30,
    },
  });
