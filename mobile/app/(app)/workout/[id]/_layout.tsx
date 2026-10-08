import { Stack } from "expo-router";
import { useStackBackGestureEnabled } from "@/components/navigation/ScreenEnterFrame";

/** Вложенный стек: экран тренировки (детали упражнения — `/exercise/[id]` в (app)). */
export default function WorkoutIdLayout() {
  const gestureEnabled = useStackBackGestureEnabled();

  return (
    <Stack
      initialRouteName="index"
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
        gestureEnabled,
        fullScreenGestureEnabled: gestureEnabled,
      }}
    />
  );
}
