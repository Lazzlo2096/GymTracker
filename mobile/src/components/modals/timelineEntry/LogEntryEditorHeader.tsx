import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import ScreenTitleRowIconButton from "@/components/ui/ScreenTitleRowIconButton";
import { useAppTheme } from "@/theme/appTheme";
import { useCatalogUi } from "@/theme/catalogUi";
import { fonts } from "@/theme/typography";

type Props = {
  title: string;
  onClose: () => void;
  onDelete?: () => void;
  deleteDisabled?: boolean;
  extraActions?: React.ReactNode;
};

/** Заголовок редактора записи журнала: название, удаление (корзина в круге), закрытие. */
export default function LogEntryEditorHeader({
  title,
  onClose,
  onDelete,
  deleteDisabled = false,
  extraActions,
}: Props) {
  const theme = useAppTheme();
  const catalogUi = useCatalogUi();
  const deleteBg = catalogUi.dark ? "#3A2424" : "#fee2e2";
  const deleteColor = catalogUi.dark ? "#FCA5A5" : "#b91c1c";

  return (
    <View style={styles.head}>
      <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
      <View style={styles.actions}>
        {extraActions}
        {onDelete ? (
          <ScreenTitleRowIconButton
            onPress={() => void onDelete()}
            disabled={deleteDisabled}
            backgroundColor={deleteBg}
            accessibilityLabel="Удалить запись"
          >
            <Ionicons name="trash-outline" size={20} color={deleteColor} />
          </ScreenTitleRowIconButton>
        ) : null}
        <ScreenTitleRowIconButton
          onPress={onClose}
          disabled={deleteDisabled}
          accessibilityLabel="Закрыть"
        >
          <Ionicons name="close" size={22} color={theme.text} />
        </ScreenTitleRowIconButton>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  title: {
    fontFamily: fonts.extraBold,
    fontSize: 18,
    flex: 1,
    marginRight: 8,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
});
