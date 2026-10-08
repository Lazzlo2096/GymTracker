import { Alert, Platform } from "react-native";
import * as Linking from "expo-linking";

type DeniedAlertOptions = {
  title: string;
  message: string;
};

/** Показать объяснение и предложить открыть настройки приложения. */
export function showPermissionDeniedAlert({
  title,
  message,
}: DeniedAlertOptions): void {
  const buttons: { text: string; style?: "cancel"; onPress?: () => void }[] = [
    { text: "Отмена", style: "cancel" },
  ];

  if (Platform.OS === "ios" || Platform.OS === "android") {
    buttons.push({
      text: "Настройки",
      onPress: () => {
        void Linking.openSettings();
      },
    });
  }

  Alert.alert(title, message, buttons);
}
