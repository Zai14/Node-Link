import "react-native-webview-crypto";
import "react-native-get-random-values";
import "react-native-gesture-handler";
import React, { useEffect, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { useFonts } from "expo-font";
import AsyncStorage from "@react-native-async-storage/async-storage";
import AuthScreen from "./screens/Authentication";
import TermsOfServiceScreen from "./screens/TermsOfService";
import PrivacyPolicyScreen from "./screens/PrivacyPolicy";
import ChatDetailScreen from "./screens/ChatDetailScreen";
import BottomTabs from "./screens/BottomTabs";
import "@ethersproject/shims";
import "react-native-polyfill-globals/auto";
import { ThemeProvider } from "../utils/GlobalUtils/ThemeProvider";
import * as Notifications from "expo-notifications";
import { handleUserData } from "../backend/Supabase/HandleUserData";
import UserProfile from "./screens/UserProfile";
import { ChatProvider } from "../utils/ChatUtils/ChatContext";
import { ConversationIdProvider } from "../utils/ChatUtils/ConversationIdContext";
import { ensureDatabaseInitialized } from "../backend/Local database/SQLite/InitialiseDatabase";
import LoadingScreen from "./screens/LoadingScreen";
import {
  initialize as initializeGun,
  destroy as destroyGun,
  onStatusChange,
} from "../backend/Gun Service/GunIndex";
import {
  AuthProvider,
  useAuth,
} from "../utils/AuthenticationUtils/AuthContext";
import {
  signInWithWallet,
  hasActiveWalletSession,
  startTokenRefresh,
  stopTokenRefresh,
} from "../utils/AuthenticationUtils/SupabaseAuth";
import GlobalMessageListener from "../backend/Gun Service/Messaging/GlobalMessageListener";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export type RootStackParamList = {
  LoadingScreen: undefined;
  Auth: undefined;
  TOS: undefined;
  PrivacyPolicy: undefined;
  Main: undefined;
  ChatDetail: { conversationId: string; name: string; avatar: any };
  MyProfile: { walletAddress?: string };
  UserProfile: { walletAddress?: string };
};

const Stack = createStackNavigator<RootStackParamList>();

function AppContent() {
  const [fontsLoaded] = useFonts({
    "MontserratAlternates-Regular": require("../assets/fonts/MontserratAlternates-Regular.ttf"),
    "Inter_18pt-Medium": require("../assets/fonts/Inter_18pt-Medium.ttf"),
    "Inter_28pt-Medium": require("../assets/fonts/Inter_28pt-Medium.ttf"),
    "SF-Pro-Text-Regular": require("../assets/fonts/SF-Pro-Text-Regular.otf"),
    "SF-Pro-Text-Medium": require("../assets/fonts/SF-Pro-Text-Medium.otf"),
  });

  const [isAppReady, setIsAppReady] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const { isLoggedIn, setIsLoggedIn } = useAuth();

  useEffect(() => {
    let networkUnsubscribe: (() => void) | undefined;

    const initializeApp = async () => {
      try {
        console.log("Starting app initialization...");
        setIsInitializing(true);

        // Step 1: Initialize database
        console.log("Initializing local database...");
        await ensureDatabaseInitialized();
        console.log("Database initialized");

        // Step 2: Check authentication state
        console.log("Checking authentication state...");
        const walletAddress = await AsyncStorage.getItem("walletAddress");
        console.log("Wallet address found:", walletAddress ? "Yes" : "No");

        if (walletAddress) {
          // Step 3: Restore Supabase Auth session (blocking, required for RLS)
          // On cold start, the JWT may have expired — re-authenticate before
          // making any Supabase API calls (like handleUserData below).
          const hasSession = await hasActiveWalletSession(walletAddress);
          if (!hasSession) {
            console.log("No active Supabase Auth session — restoring...");
            const { error } = await signInWithWallet(walletAddress);
            if (error) {
              console.warn("Supabase Auth restore skipped:", error);
            } else {
              console.log("Supabase Auth session restored on cold start");
            }
          } else {
            console.log("Supabase Auth session is active");
          }

          // Step 4: Initialize Gun network for authenticated users
          console.log("Initializing P2P network...");

          // Set up network status monitoring
          networkUnsubscribe = onStatusChange((isConnected) => {
            console.log(
              `P2P Network Status: ${
                isConnected ? "Connected" : "Connecting..."
              }`
            );
          });

          initializeGun();
          console.log("P2P network initialized");

          // Step 5: Load user data
          console.log("Loading user data...");
          await handleUserData();
          console.log("User data loaded");

          // Step 6: Start proactive token refresh timer
          startTokenRefresh();

          setIsLoggedIn(true);
        } else {
          console.log("No wallet address found - user not logged in");
          setIsLoggedIn(false);
        }

        // Step 7: Add minimum loading time for better UX
        const minLoadingTime = 2000; // 2 seconds minimum
        const startTime = Date.now();
        const elapsedTime = Date.now() - startTime;

        if (elapsedTime < minLoadingTime) {
          const remainingTime = minLoadingTime - elapsedTime;
          console.log(`Adding ${remainingTime}ms for better UX...`);
          await new Promise((resolve) => setTimeout(resolve, remainingTime));
        }

        console.log("App initialization completed");
        setIsAppReady(true);
        setIsInitializing(false);
      } catch (error) {
        console.error("App initialization failed:", error);

        // Show error and continue with app
        setIsLoggedIn(false);
        setIsAppReady(true);
        setIsInitializing(false);
      }
    };

    initializeApp();

    // Cleanup function
    return () => {
      if (networkUnsubscribe) {
        networkUnsubscribe();
      }
      stopTokenRefresh();
      destroyGun();
    };
  }, [fontsLoaded, setIsLoggedIn]);

  // Show loading screen during initialization OR when fonts aren't loaded
  if (!fontsLoaded || isInitializing || !isAppReady) {
    return <LoadingScreen />;
  }

  return (
    <>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {!isLoggedIn ? (
            <>
              <Stack.Screen name="Auth" component={AuthScreen} />
              <Stack.Screen name="TOS" component={TermsOfServiceScreen} />
              <Stack.Screen
                name="PrivacyPolicy"
                component={PrivacyPolicyScreen}
              />
            </>
          ) : (
            <>
              <Stack.Screen name="Main" component={BottomTabs} />
              <Stack.Screen name="ChatDetail" component={ChatDetailScreen} />
              <Stack.Screen name="UserProfile" component={UserProfile} />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>

      {isLoggedIn && <GlobalMessageListener />}
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <ConversationIdProvider>
          <ChatProvider>
            <AppContent />
          </ChatProvider>
        </ConversationIdProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}
