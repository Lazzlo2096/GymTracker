import { Redirect } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useAuth } from "@/context/AuthContext";
import { useTraceScreen } from "@/debug/useTraceScreen";
import { colors } from "@/theme/colors";

/** Стартовый маршрут: ждём инициализацию токенов, затем редирект в приложение или на логин. */
export default function Index() {
  useTraceScreen("index");
  const { ready, isAuthenticated } = useAuth();

  if (!ready) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (isAuthenticated) {
    /* Как веб: после входа открывается экран «Тренировки», не каталог. */
    return <Redirect href="/workouts" />;
  }
  return <Redirect href="/login" />;
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
});
