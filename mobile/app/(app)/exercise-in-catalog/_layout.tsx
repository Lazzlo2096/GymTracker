import { Stack } from "expo-router";
import { useStackBackGestureEnabled } from "@/components/navigation/ScreenEnterFrame";

/** Карточка упражнения в каталоге — кастомная шапка как на экране тренировки. */
export default function ExerciseInCatalogLayout() {
  const gestureEnabled = useStackBackGestureEnabled();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
        gestureEnabled,
        fullScreenGestureEnabled: gestureEnabled,
      }}
    />
  );
}
