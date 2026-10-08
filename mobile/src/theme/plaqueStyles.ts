import { Platform, type ViewStyle } from "react-native";

/**
 * Тень списковой плашки как у `listCard` на экране «Профиль»
 * (shadowColor #190A3D, лёгкая диффузная тень + elevation на Android).
 */
export function plaqueListShadow(): ViewStyle {
  const base: ViewStyle = {
    shadowColor: "#190A3D",
    shadowOpacity: 0.045,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  };

  // RN Web корректнее отображает тени через `boxShadow`, а не через набор shadow*.
  if (Platform.OS === "web") {
    return {
      ...base,
      // rgba(25, 10, 61, 0.045) — тень как в базовом `shadowOpacity`.
      boxShadow: "0px 8px 18px rgba(25, 10, 61, 0.045)",
    } as ViewStyle;
  }

  return base;
}

/** Радиус основной прямоугольной плашки-списка — как `listCard` на «Профиле». */
export const PLAQUE_RADIUS = 20;

/** Толщина обводки плашки — как у `listCard` на «Профиле». */
export const PLAQUE_BORDER_WIDTH = 1;
