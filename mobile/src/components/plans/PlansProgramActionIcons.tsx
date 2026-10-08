import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import ScreenTitleRowIconButton from "@/components/ui/ScreenTitleRowIconButton";
import { useAppTheme } from "@/theme/appTheme";

const HALO_SIZE = 30;
const HALO_RADIUS = 15;
const ICON_SIZE = 17;

type Props = {
  onEdit?: () => void;
  onDelete?: () => void;
};

/** Компактные корзина и карандаш в шапке плашки программы. */
export default function PlansProgramActionIcons({ onEdit, onDelete }: Props) {
  const theme = useAppTheme();
  const haloStyle = useMemo(
    () => ({ width: HALO_SIZE, height: HALO_SIZE, borderRadius: HALO_RADIUS }),
    [],
  );
  const deleteHalo = useMemo(
    () => (theme.dark ? "rgba(248, 113, 113, 0.18)" : "rgba(220, 38, 38, 0.12)"),
    [theme.dark],
  );

  if (!onEdit && !onDelete) return null;

  return (
    <View style={styles.row}>
      {onDelete ? (
        <ScreenTitleRowIconButton
          onPress={onDelete}
          accessibilityLabel="Удалить программу"
          backgroundColor={deleteHalo}
          style={haloStyle}
          hitSlop={4}
        >
          <Ionicons name="trash-outline" size={ICON_SIZE} color={theme.danger} />
        </ScreenTitleRowIconButton>
      ) : null}
      {onEdit ? (
        <ScreenTitleRowIconButton
          onPress={onEdit}
          accessibilityLabel="Редактировать программу"
          backgroundColor={theme.accentSoft}
          style={haloStyle}
          hitSlop={4}
        >
          <Ionicons name="pencil-outline" size={ICON_SIZE} color={theme.accent} />
        </ScreenTitleRowIconButton>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginLeft: 2,
  },
});
