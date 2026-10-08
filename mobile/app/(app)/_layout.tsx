import { Redirect, Stack } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import BottomNavBar from "@/components/navigation/BottomNavBar";
import StatusBarInsetBand from "@/components/navigation/StatusBarInsetBand";
import EmailVerificationModal from "@/components/profile/modals/EmailVerificationModal";
import { useAuth } from "@/context/AuthContext";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { colors } from "@/theme/colors";
import { type } from "@/theme/typography";
import { useAppTheme } from "@/theme/appTheme";

/** Защищённая зона приложения: нижняя навигация + общий фон. */
export default function AppGroupLayout() {
  const {
    ready,
    isAuthenticated,
    user,
    showEmailVerificationAfterRegister,
    dismissEmailVerificationAfterRegister,
  } = useAuth();
  const theme = useAppTheme();
  const registerVerifyVisible =
    showEmailVerificationAfterRegister && !!user && !user.is_email_verified;
  usePushNotifications({
    user: isAuthenticated ? user : null,
  });

  if (!ready) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/login" />;
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      <StatusBarInsetBand />
      <View style={styles.stackHost}>
        <Stack
          screenOptions={{
            headerShown: false,
            headerStyle: { backgroundColor: theme.card },
            headerTintColor: theme.text,
            headerTitleStyle: {
              fontFamily: type.screenTitle.fontFamily,
              fontSize: type.screenTitle.fontSize,
              lineHeight: type.screenTitle.lineHeight,
            },
            headerShadowVisible: false,
          }}
        >
          <Stack.Screen
            name="workout/[id]"
            options={{
              animation: "slide_from_right",
              gestureEnabled: true,
              fullScreenGestureEnabled: true,
            }}
          />
          <Stack.Screen
            name="plan-template/[id]"
            options={{
              animation: "slide_from_right",
              gestureEnabled: true,
              fullScreenGestureEnabled: true,
            }}
          />
          <Stack.Screen
            name="program/create"
            options={{
              animation: "slide_from_right",
              gestureEnabled: true,
              fullScreenGestureEnabled: true,
            }}
          />
          <Stack.Screen
            name="program/[id]/edit"
            options={{
              animation: "slide_from_right",
              gestureEnabled: true,
              fullScreenGestureEnabled: true,
            }}
          />
          <Stack.Screen
            name="weight-diary"
            options={{
              animation: "slide_from_right",
              gestureEnabled: true,
              fullScreenGestureEnabled: true,
            }}
          />
        </Stack>
      </View>
      <BottomNavBar />
      {user && !user.is_email_verified ? (
        <EmailVerificationModal
          visible={registerVerifyVisible}
          email={user.email}
          onClose={dismissEmailVerificationAfterRegister}
          onDismiss={dismissEmailVerificationAfterRegister}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.pageBg },
  /** Stack не должен заходить под нижний таббар (иначе последние строки не нажимаются). */
  stackHost: { flex: 1, minHeight: 0 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
});
