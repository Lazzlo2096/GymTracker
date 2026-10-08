import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import * as WebBrowser from "expo-web-browser";
import { useEffect } from "react";
import { Platform, Text } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "@/context/AuthContext";
import { TraceProvider } from "@/debug/TraceProvider";
import { appFontSources } from "@/theme/appFonts";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(appFontSources);

  useEffect(() => {
    WebBrowser.maybeCompleteAuthSession();
  }, []);

  useEffect(() => {
    const nextDefaults = {
      ...(Text.defaultProps ?? {}),
      ...(Platform.OS === "android"
        ? ({
            textBreakStrategy: "simple",
            android_hyphenationFrequency: "none",
          } as const)
        : {}),
      ...(Platform.OS === "ios"
        ? ({
            lineBreakStrategyIOS: "none",
          } as const)
        : {}),
    };
    Text.defaultProps = nextDefaults;
  }, []);

  useEffect(() => {
    if (fontError) {
      console.error("[fonts] failed to load app fonts", fontError);
    }
  }, [fontError]);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <TraceProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="login" />
            <Stack.Screen name="register" />
            <Stack.Screen name="(app)" options={{ headerShown: false }} />
          </Stack>
        </TraceProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
