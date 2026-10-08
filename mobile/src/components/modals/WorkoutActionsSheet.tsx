/**
 * @see ./modalDismissContract.ts — не сбрасывайте title/subtitle/actions у родителя синхронно с закрытием.
 */
import React, { useEffect, useState } from "react";
import {
  Animated,
  Modal,
  Pressable,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fonts } from "@/theme/typography";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import {
  bottomSheetFrameStyle,
  bottomSheetMaxHeight,
  bottomSheetPadding,
  BottomSheetDismissButton,
  BottomSheetDragHeader,
  useBottomSheet,
} from "@/components/ui/bottomSheet";
import { useAppTheme } from "@/theme/appTheme";
import { pressableStyle } from "@/utils/pressableStyles";

const textBreakProps =
  Platform.OS === "android"
    ? ({ hyphenationFrequency: "none" } as const)
    : Platform.OS === "ios"
      ? ({ lineBreakStrategyIOS: "push-out" } as const)
      : {};

export type WorkoutActionId =
  | "open"
  | "repeat"
  | "select"
  | "duplicate_template"
  | "duplicate_session"
  | "compare"
  | "exercise_progress"
  | "share"
  | "hide_from_stats"
  | "delete"
  | "add_set"; // для меню упражнения в том же компоненте

export type ActionRow = {
  id: string; // can be WorkoutActionId or custom like "edit_event"
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  destructive?: boolean;
  /** Подписка Premium: бейдж и лёгкий акцент иконки. */
  premium?: boolean;
  /** Отладочное действие: бейдж Debug (как premium, другой цвет). */
  debug?: boolean;
};

const WORKOUT_ACTIONS_COMMON: ActionRow[] = [
  {
    id: "duplicate_template",
    label: "Дублировать как шаблон",
    icon: "albums-outline",
    premium: true,
  },
  {
    id: "duplicate_session",
    label: "Дублировать тренировку",
    icon: "today-outline",
    premium: true,
  },
  {
    id: "compare",
    label: "Сравнить с прошлым разом",
    icon: "analytics-outline",
    premium: true,
  },
  {
    id: "exercise_progress",
    label: "График по упражнению",
    icon: "trending-up-outline",
    premium: true,
  },
  { id: "share", label: "Поделиться", icon: "share-outline", premium: true },
  { id: "delete", label: "Удалить", icon: "trash-outline", destructive: true },
];

const WORKOUT_REPEAT_ACTION: ActionRow = {
  id: "repeat",
  label: "Повторить",
  icon: "repeat-outline",
  premium: true,
};

/** Меню «⋯» на экране открытой тренировки — без «Открыть» / «Выбрать» / «Скрыть из сводок». */
export const WORKOUT_DETAIL_ACTIONS: ActionRow[] = [
  WORKOUT_REPEAT_ACTION,
  ...WORKOUT_ACTIONS_COMMON,
];

/** Меню «⋯» на экране /exercise/[id] — без «Открыть». */
export const EXERCISE_PASTE_SETS_JSON_ACTION: ActionRow = {
  id: "paste_sets_json",
  label: "Вставить подходы из JSON",
  icon: "code-outline",
  debug: true,
};

export const EXERCISE_DETAIL_ACTIONS: ActionRow[] = [
  { id: "add_set", label: "Добавить подход", icon: "add-circle-outline" },
  { id: "edit_exercise", label: "Редактировать упражнение", icon: "create-outline" },
  EXERCISE_PASTE_SETS_JSON_ACTION,
  {
    id: "delete_exercise",
    label: "Удалить упражнение",
    icon: "trash-outline",
    destructive: true,
  },
];

export const EXERCISE_STOP_ACTION: ActionRow = {
  id: "stop_exercise",
  label: "Остановить упражнение",
  icon: "stop-circle-outline",
  destructive: true,
};

/** Меню «⋯» в списке «История тренировок». */
export const WORKOUT_HISTORY_ACTIONS: ActionRow[] = [
  { id: "open", label: "Открыть", icon: "open-outline" },
  { id: "select", label: "Выбрать", icon: "checkbox-outline" },
  WORKOUT_REPEAT_ACTION,
  ...WORKOUT_ACTIONS_COMMON.filter((a) => a.id !== "delete"),
  {
    id: "hide_from_stats",
    label: "Скрыть из сводок",
    icon: "eye-off-outline",
    premium: true,
  },
  { id: "delete", label: "Удалить", icon: "trash-outline", destructive: true },
];

type Props = {
  visible: boolean;
  title?: string;
  subtitle?: string | null;
  actions?: ActionRow[];
  onClose: () => void;
  onSelect: (action: string) => void; // string to support custom ids
  /** Сброс данных меню у родителя — только после анимации закрытия. */
  onDismiss?: () => void;
};

export default function WorkoutActionsSheet({
  visible,
  title: propsTitle = "Действия",
  subtitle: propsSubtitle,
  actions: propsActions = WORKOUT_DETAIL_ACTIONS,
  onClose,
  onSelect,
  onDismiss,
}: Props) {
  const insets = useSafeAreaInsets();
  const theme = useAppTheme();

  const [internalData, setInternalData] = useState({
    title: propsTitle,
    subtitle: propsSubtitle,
    actions: propsActions,
  });

  const { mounted, sheetTranslateY, backdropOpacity, panHandlers, requestClose, windowHeight } =
    useBottomSheet(visible, onClose, { onDismiss });

  /** Подтягиваем пропсы только пока шторка открыта — иначе при `visible→false` родитель обнуляет target и кадры анимации «прыгают». */
  useEffect(() => {
    if (!visible) return;
    setInternalData({
      title: propsTitle,
      subtitle: propsSubtitle,
      actions: propsActions,
    });
  }, [visible, propsTitle, propsSubtitle, propsActions]);

  const { title, subtitle, actions } = internalData;

  function rowIconColor(row: ActionRow) {
    if (row.destructive) return "#D92D20";
    if (row.debug) return theme.dark ? "#FCD34D" : "#B45309";
    if (row.premium) return theme.dark ? "#C4B5FD" : theme.accent;
    return theme.textMuted;
  }

  if (!mounted) return null;

  return (
    <Modal
      visible={mounted}
      animationType="none"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.modalRoot}>
        <Animated.View
          pointerEvents="box-none"
          style={[
            StyleSheet.absoluteFill,
            { opacity: backdropOpacity, backgroundColor: theme.overlay },
          ]}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={requestClose} />
        </Animated.View>

        <Animated.View
          style={[
            bottomSheetFrameStyle.sheet,
            { backgroundColor: theme.card },
            bottomSheetPadding(insets),
            bottomSheetMaxHeight(windowHeight, insets),
            { transform: [{ translateY: sheetTranslateY }] },
          ]}
        >
          <BottomSheetDragHeader panHandlers={panHandlers} style={bottomSheetFrameStyle.dragHeader}>
            <Text style={[styles.sheetTitle, { color: theme.text }]}>{title}</Text>
            {!!subtitle && (
              <Text style={[styles.sheetSubtitle, { color: theme.textMuted }]} {...textBreakProps}>
                {subtitle}
              </Text>
            )}
          </BottomSheetDragHeader>
          <View style={styles.actionsList}>
              {actions.map((row) => (
                <Pressable
                  key={row.id}
                  style={pressableStyle(
                    [styles.row, { borderBottomColor: theme.divider }],
                    {
                      hover: { backgroundColor: theme.bg },
                      pressed: [styles.rowPressed, { backgroundColor: theme.bg }],
                    },
                  )}
                  onPress={() => {
                    onSelect(row.id);
                    requestClose();
                  }}
                >
                  <Ionicons name={row.icon} size={20} color={rowIconColor(row)} />
                  <Text
                    style={[
                      styles.rowLabel,
                      { color: theme.text },
                      row.destructive && styles.rowLabelDestructive,
                    ]}
                    {...textBreakProps}
                  >
                    {row.label}
                  </Text>
                  {row.premium ? (
                    <LinearGradient
                      colors={
                        theme.dark ? ["#5B21B6", "#7C3AED"] : ["#EDE9FE", "#DDD6FE"]
                      }
                      start={{ x: 0, y: 0.5 }}
                      end={{ x: 1, y: 0.5 }}
                      style={styles.premiumBadge}
                    >
                      <Ionicons
                        name="diamond-outline"
                        size={11}
                        color={theme.dark ? "#F5F3FF" : "#5B21B6"}
                      />
                      <Text
                        style={[
                          styles.premiumBadgeText,
                          { color: theme.dark ? "#F5F3FF" : "#5B21B6" },
                        ]}
                      >
                        Премиум
                      </Text>
                    </LinearGradient>
                  ) : row.debug ? (
                    <LinearGradient
                      colors={
                        theme.dark ? ["#92400E", "#B45309"] : ["#FEF3C7", "#FDE68A"]
                      }
                      start={{ x: 0, y: 0.5 }}
                      end={{ x: 1, y: 0.5 }}
                      style={styles.premiumBadge}
                    >
                      <Ionicons
                        name="bug-outline"
                        size={11}
                        color={theme.dark ? "#FEF3C7" : "#92400E"}
                      />
                      <Text
                        style={[
                          styles.premiumBadgeText,
                          { color: theme.dark ? "#FEF3C7" : "#92400E" },
                        ]}
                      >
                        Debug
                      </Text>
                    </LinearGradient>
                  ) : null}
                  <Ionicons name="chevron-forward" size={17} color={theme.textMuted} />
                </Pressable>
              ))}
            </View>
            <BottomSheetDismissButton onPress={onClose} />
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  actionsList: {
    flexGrow: 0,
    flexShrink: 0,
  },
  sheetTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontFamily: fonts.extraBold,
    color: "#11142D",
    letterSpacing: -0.3,
  },
  sheetSubtitle: {
    marginTop: 6,
    marginBottom: 10,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: fonts.semiBold,
    color: "#6F6B84",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#ECEAF2",
  },
  rowPressed: {
    backgroundColor: "#F7F5FB",
  },
  rowLabel: {
    flex: 1,
    minWidth: 0,
    fontSize: 15,
    lineHeight: 22,
    fontFamily: fonts.semiBold,
    color: "#11142D",
  },
  rowLabelDestructive: {
    color: "#D92D20",
  },
  premiumBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  premiumBadgeText: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: fonts.extraBold,
    letterSpacing: 0.2,
  },
});
