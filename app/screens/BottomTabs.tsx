import React, { useEffect, useRef } from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import {
  View,
  Animated,
  StyleSheet,
  Pressable,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import WalletScreen from "./WalletScreen";
import ChatScreen from "./ChatScreen";
import SettingsStackScreen from "./SettingStackScreen";
import { triggerTapHapticFeedback } from "../../utils/GlobalUtils/TapHapticFeedback";
import { useThemeToggle } from "../../utils/GlobalUtils/ThemeProvider";
import { handleUserData } from "../../backend/Supabase/HandleUserData";
import { handleAndPublishKeys } from "../../backend/E2E-Encryption/HandleKeys";

const Tab = createBottomTabNavigator();

// ─── Icon config ────────────────────────────────────────────────────────────
const TAB_ICONS: Record<string, { focused: string; unfocused: string }> = {
  Wallet: { focused: "wallet", unfocused: "wallet-outline" },
  Chats: { focused: "chatbox", unfocused: "chatbox-outline" },
  Settings: { focused: "options", unfocused: "options-outline" },
};

// ─── Animated Tab Icon with background pill ────────────────────────────────
const TabIcon: React.FC<{
  routeName: string;
  focused: boolean;
  size: number;
  isDarkMode: boolean;
}> = ({ routeName, focused, size, isDarkMode }) => {
  const focusAnim = useRef(new Animated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(focusAnim, {
      toValue: focused ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [focused, focusAnim]);

  const bgOpacity = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const iconScale = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.12],
  });

  const activeColor = isDarkMode ? "#fff" : "#333";
  const inactiveColor = "gray";

  const icons = TAB_ICONS[routeName];
  if (!icons) return null;

  const iconName = focused ? icons.focused : icons.unfocused;
  const iconSize = size + 4;

  return (
    <View style={styles.iconOuter}>
      {/* Focus background pill */}
      <Animated.View
        style={[
          styles.focusPill,
          {
            backgroundColor: isDarkMode
              ? "rgba(255,255,255,0.12)"
              : "rgba(0,0,0,0.08)",
            opacity: bgOpacity,
            width: iconSize + 16,
            height: iconSize + 16,
            borderRadius: (iconSize + 16) / 2,
          },
        ]}
      />
      <Animated.View style={{ transform: [{ scale: iconScale }] }}>
        <Ionicons
          name={iconName as any}
          size={iconSize}
          color={focused ? activeColor : inactiveColor}
        />
      </Animated.View>
    </View>
  );
};

// ─── Animated Tab Bar Button ───────────────────────────────────────────────
const AnimatedTabBarButton = (props: any) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const { onPress, children, style } = props;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.92,
      useNativeDriver: true,
      speed: 20,
      bounciness: 8,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 8,
    }).start();
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={style}
    >
      <Animated.View
        style={[
          { transform: [{ scale: scaleAnim }] },
          { flex: 1, alignItems: "center", justifyContent: "center" },
        ]}
      >
        {children}
      </Animated.View>
    </Pressable>
  );
};

// ─── Tab bar style ─────────────────────────────────────────────────────────
const getTabBarStyle = (isDarkMode: boolean) =>
  Platform.select({
    ios: {
      height: 60,
      backgroundColor: isDarkMode ? "#1C1C1D" : "#EAEAEA",
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: isDarkMode ? "#333" : "#ccc",
      elevation: 0,
      shadowOpacity: 0,
      paddingBottom: 6,
    },
    android: {
      height: 60,
      backgroundColor: isDarkMode ? "#1C1C1D" : "#EAEAEA",
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: isDarkMode ? "#333" : "#ccc",
      elevation: 0,
      shadowOpacity: 0,
      paddingBottom: 6,
    },
    default: {
      height: 60,
      backgroundColor: isDarkMode ? "#1C1C1D" : "#EAEAEA",
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: isDarkMode ? "#333" : "#ccc",
      elevation: 0,
      shadowOpacity: 0,
      paddingBottom: 6,
    },
  });

// ─── Main Component ────────────────────────────────────────────────────────
export default function BottomTabs() {
  const { currentTheme } = useThemeToggle();
  const isDarkMode = currentTheme === "dark";

  // 1️⃣ Fetch & sync user data from Supabase
  useEffect(() => {
    handleUserData().catch(console.error);
  }, []);

  // 2️⃣ Generate & publish keys as soon as we know the walletAddress
  useEffect(() => {
    (async () => {
      try {
        const walletAddress = await AsyncStorage.getItem("walletAddress");
        if (walletAddress) {
          console.log("Handling Keys");
          await handleAndPublishKeys(walletAddress);
        }
      } catch (err) {
        console.error("Key generation error:", err);
      }
    })();
  }, []);

  return (
    <Tab.Navigator
      initialRouteName="Chats"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarButton: (props) => <AnimatedTabBarButton {...props} />,
        tabBarStyle: getTabBarStyle(isDarkMode),
        tabBarLabelStyle: {
          fontSize: 9,
          marginTop: 1,
        },
        tabBarIcon: ({ focused, size }) => (
          <TabIcon
            routeName={route.name}
            focused={focused}
            size={size}
            isDarkMode={isDarkMode}
          />
        ),
      })}
    >
      <Tab.Screen
        name="Wallet"
        component={WalletScreen}
        listeners={{
          tabLongPress: async () => {
            console.log("Wallet tab Hold pressed");
          },
          tabPress: () => {
            triggerTapHapticFeedback();
            console.log("Wallet tab Pressed");
          },
        }}
      />
      <Tab.Screen
        name="Chats"
        component={ChatScreen}
        listeners={{
          tabLongPress: async () => {
            console.log("Chats tab Hold pressed");
          },
          tabPress: () => {
            triggerTapHapticFeedback();
            console.log("Chats tab Pressed");
          },
        }}
      />

      <Tab.Screen
        name="Settings"
        component={SettingsStackScreen}
        listeners={{
          tabLongPress: async () => {
            console.log("Settings tab Hold pressed");
          },
          tabPress: () => {
            triggerTapHapticFeedback();
            console.log("Settings tab Pressed");
          },
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  iconOuter: {
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  focusPill: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },

});
