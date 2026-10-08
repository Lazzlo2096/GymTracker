/**
 * Семейства Montserrat (подключаются в `app/_layout.tsx` через `useFonts`).
 * Везде используем `fontFamily`, а не `fontWeight` с системным шрифтом.
 */
export const fonts = {
  regular: "Montserrat_400Regular",
  medium: "Montserrat_500Medium",
  semiBold: "Montserrat_600SemiBold",
  bold: "Montserrat_700Bold",
  extraBold: "Montserrat_800ExtraBold",
} as const;

/**
 * Единая шкала размеров и межстрочных интервалов для экранов и модалок.
 * Цвет подставляйте отдельно (`catalogUi` / `colors`).
 */
export const type = {
  /** Заголовок экрана (Профиль, Залы, Тренировки…) */
  screenTitle: { fontFamily: fonts.extraBold, fontSize: 20, lineHeight: 26 },
  /** Крупный заголовок на auth */
  heroTitle: { fontFamily: fonts.extraBold, fontSize: 20, lineHeight: 26 },
  /** Подзаголовок под hero */
  heroSub: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20 },
  /** Заголовок секции / карточки списка */
  section: { fontFamily: fonts.bold, fontSize: 20, lineHeight: 26 },
  /** Заголовок месяца / блока на тренировках */
  sectionAccent: { fontFamily: fonts.extraBold, fontSize: 20, lineHeight: 26 },
  /** Основной текст */
  body: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20 },
  bodyMedium: { fontFamily: fonts.semiBold, fontSize: 14, lineHeight: 20 },

  /**
   * Имя / название в карточке списка (как блок героя «displayName» на Профиле).
   */
  cardEntityTitle: {
    fontFamily: fonts.extraBold,
    fontSize: 14,
    lineHeight: 18,
    letterSpacing: -0.3,
  },
  /** Подпись под числом в плитке статистики (как в блоке цифр Профиля). */
  statTileLabel: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16 },
  /** Число в плитке статистики (Профиль). */
  statTileValue: { fontFamily: fonts.semiBold, fontSize: 14, lineHeight: 16 },
  /** Лейбл строки списка настроек (Профиль). */
  settingsRowLabel: { fontFamily: fonts.semiBold, fontSize: 13, lineHeight: 18 },
  /** Значение строки списка настроек (Профиль). */
  settingsRowValue: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16 },
  /** Вторичный текст */
  muted: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 18 },
  /** Подписи к полям, мелкие пояснения */
  label: { fontFamily: fonts.semiBold, fontSize: 12, lineHeight: 16 },
  caption: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16 },
  /** Чипы, фильтры */
  chip: { fontFamily: fonts.semiBold, fontSize: 14, lineHeight: 18 },
  /** Основная кнопка */
  button: { fontFamily: fonts.bold, fontSize: 14, lineHeight: 18 },
  buttonGhost: { fontFamily: fonts.semiBold, fontSize: 14, lineHeight: 18 },
  /** Нижняя навигация */
  nav: { fontFamily: fonts.semiBold, fontSize: 11, lineHeight: 14 },
  /** Крупные цифры (таймер, метрика) */
  display: { fontFamily: fonts.extraBold, fontSize: 44, lineHeight: 50 },
  /** Значение в плитке */
  stat: { fontFamily: fonts.bold, fontSize: 14, lineHeight: 18 },
  /** Заголовок модалки */
  modalTitle: { fontFamily: fonts.extraBold, fontSize: 20, lineHeight: 26 },
} as const;
