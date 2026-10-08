import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { PLAQUE_RADIUS, plaqueListShadow } from "@/theme/plaqueStyles";
import { useCatalogUi } from "@/theme/catalogUi";
import { fonts, type } from "@/theme/typography";
import { pressableStyle } from "@/utils/pressableStyles";

const textBreakProps =
  Platform.OS === "android"
    ? ({ hyphenationFrequency: "none" } as const)
    : Platform.OS === "ios"
      ? ({ lineBreakStrategyIOS: "push-out" } as const)
      : {};

type Props = {
  name: string;
  muscleGroup?: string | null;
  notes?: string | null;
  machineSettings?: string | null;
  onPress?: () => void;
  accessibilityLabel?: string;
};

/** Название упражнения под заголовком экрана `/exercise/[id]`. */
export default function ExerciseHeaderSubtitle({
  name,
  muscleGroup,
  notes,
  machineSettings,
  onPress,
  accessibilityLabel,
}: Props) {
  const catalogUi = useCatalogUi();
  const styles = useMemo(() => createStyles(catalogUi), [catalogUi]);
  const mg = muscleGroup?.trim() ?? "";
  const notesText = notes?.trim() ?? "";
  const machineSettingsText = machineSettings?.trim() ?? "";

  const body = (
    <View style={[styles.plaque, { backgroundColor: catalogUi.cardBg }]}>
      <View style={styles.wrap}>
        <View style={styles.nameRow}>
          <Text style={styles.name} {...textBreakProps}>
            {name}
          </Text>
          {onPress ? (
            <MaterialCommunityIcons
              name="chevron-right"
              size={18}
              color={catalogUi.accentMuted}
              style={styles.chevron}
            />
          ) : null}
        </View>
        {mg ? (
          <View style={[styles.chip, { backgroundColor: catalogUi.accentSoft }]}>
            <Text style={[styles.chipText, { color: catalogUi.accent }]} {...textBreakProps}>
              {mg}
            </Text>
          </View>
        ) : null}
        {notesText ? (
          <View style={styles.metaRow}>
            <Ionicons name="document-text-outline" size={14} color={catalogUi.textMuted} />
            <Text style={styles.metaText} {...textBreakProps}>
              {notesText}
            </Text>
          </View>
        ) : null}
        {machineSettingsText ? (
          <View style={styles.metaRow}>
            <MaterialCommunityIcons name="tune-variant" size={14} color={catalogUi.textMuted} />
            <Text style={styles.metaText} {...textBreakProps}>
              {machineSettingsText}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );

  if (!onPress) return body;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? name}
      hitSlop={4}
      style={pressableStyle(styles.pressable, {
        pressed: { opacity: 0.92 },
      })}
    >
      {body}
    </Pressable>
  );
}

const createStyles = (catalogUi: ReturnType<typeof useCatalogUi>) =>
  StyleSheet.create({
    pressable: {
      alignSelf: "stretch",
    },
    plaque: {
      borderRadius: PLAQUE_RADIUS,
      paddingHorizontal: 14,
      paddingVertical: 12,
      marginBottom: 12,
      ...plaqueListShadow(),
    },
    wrap: {
      gap: 8,
    },
    nameRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 2,
    },
    name: {
      flex: 1,
      minWidth: 0,
      ...type.cardEntityTitle,
      fontSize: 15,
      lineHeight: 20,
      fontFamily: fonts.extraBold,
      letterSpacing: -0.35,
      color: catalogUi.text,
    },
    chevron: {
      marginTop: 1,
      flexShrink: 0,
    },
    chip: {
      alignSelf: "flex-start",
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    chipText: {
      ...type.label,
      fontFamily: fonts.semiBold,
      fontSize: 11,
      lineHeight: 14,
    },
    metaRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 6,
    },
    metaText: {
      flex: 1,
      minWidth: 0,
      ...type.caption,
      fontFamily: fonts.regular,
      fontSize: 13,
      lineHeight: 18,
      color: catalogUi.textMuted,
    },
  });
