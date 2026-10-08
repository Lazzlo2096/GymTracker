import {
  Montserrat_400Regular,
  Montserrat_500Medium,
  Montserrat_600SemiBold,
  Montserrat_700Bold,
  Montserrat_800ExtraBold,
} from "@expo-google-fonts/montserrat";
import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

/**
 * Все шрифты приложения для `useFonts` в корневом layout.
 *
 * На web `@expo/vector-icons` грузит .ttf асинхронно; без предзагрузки
 * иконки на первом кадре — пустые прямоугольники (TGL-28).
 */
export const appFontSources = {
  Montserrat_400Regular,
  Montserrat_500Medium,
  Montserrat_600SemiBold,
  Montserrat_700Bold,
  Montserrat_800ExtraBold,
  ...Ionicons.font,
  ...MaterialCommunityIcons.font,
  ...Feather.font,
};
