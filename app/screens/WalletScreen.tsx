import React from "react";
import { SafeAreaView, View, Text, StyleSheet } from "react-native";

export default function Wallet() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.centered}>
        <View style={styles.box}>
          <Text style={styles.notice}>
            Wallet access And The Whole Node-Link Project is currently paused due to Indian regulatory requirements.
            {"\n\n"}
            As per documents signed with the concerned Government office, this app
            cannot be publicly released on the App Store or Play Store at this time.
            {"\n\n"}
            Development will resume after official clearance.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0a0aff",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24, // ensures equal left-right padding
  },
  box: {
    width: "100%",
    alignItems: "center",
  },
  notice: {
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
    color: "#f8f4f4ff",
    lineHeight: 26,
  },
});
