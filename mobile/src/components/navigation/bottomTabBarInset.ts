import { useMemo } from "react";

/** Высота ряда иконок таббара (см. `BottomNavBar` styles.bottomNavRow). */
/** paddingVertical 10×2 + icon 24 + gap 4 + label 14 */
export const BOTTOM_TAB_BAR_ROW_HEIGHT = 62;

/** Размер и отступ FAB «+» (см. `FloatingAddButton`). */
export const FAB_SIZE = 52;
export const FAB_BOTTOM_OFFSET = 14;

/** Статический нижний отступ списка под FAB (без safe-area таббара — он снаружи stackHost). */
export const FAB_LIST_PADDING_BOTTOM = FAB_SIZE + FAB_BOTTOM_OFFSET + 24;

/**
 * Нижний padding для ScrollView/FlatList на вкладках с BottomNavBar.
 * Контент рисуется в `stackHost` *над* таббаром — высоту таббара не добавляем.
 */
export function useBottomTabBarScrollPadding(extra = 24): number {
  return extra;
}

/** Отступ снизу списка, чтобы последние строки не перекрывались FAB. */
export function useFabScrollPadding(extra = 20): number {
  return useMemo(() => FAB_SIZE + FAB_BOTTOM_OFFSET + extra, [extra]);
}
