import { StyleSheet } from "react-native";
import type { useCatalogUi } from "@/theme/catalogUi";
import { fonts } from "@/theme/typography";

export function createTimelineEntryFormStyles(catalogUi: ReturnType<typeof useCatalogUi>) {
  return StyleSheet.create({
    labFull: {
      fontFamily: fonts.semiBold,
      fontSize: 13,
      color: catalogUi.textMuted,
      marginTop: 8,
      marginBottom: 6,
    },
    chipRow: {
      flexDirection: "row",
      gap: 8,
      marginBottom: 4,
    },
    typeChip: {
      flex: 1,
      alignItems: "center",
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: catalogUi.border,
      backgroundColor: catalogUi.cardBg,
    },
    typeChipOn: {
      borderColor: catalogUi.accent,
      backgroundColor: catalogUi.iconCircleBg,
    },
    typeChipTxt: {
      fontFamily: fonts.semiBold,
      fontSize: 14,
      color: catalogUi.text,
    },
    typeChipTxtOn: {
      color: catalogUi.accent,
    },
    input: {
      borderWidth: 1,
      borderColor: catalogUi.border,
      borderRadius: 12,
      paddingVertical: 10,
      paddingHorizontal: 12,
      fontFamily: fonts.semiBold,
      fontSize: 15,
      color: catalogUi.text,
      marginBottom: 4,
    },
    nowBtn: {
      alignSelf: "flex-start",
      marginTop: 6,
      marginBottom: 4,
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 10,
      backgroundColor: catalogUi.iconCircleBg,
    },
    nowBtnText: {
      fontFamily: fonts.semiBold,
      fontSize: 13,
      color: catalogUi.accent,
    },
    area: {
      borderWidth: 1,
      borderColor: catalogUi.border,
      borderRadius: 12,
      padding: 12,
      minHeight: 72,
      textAlignVertical: "top",
      fontFamily: fonts.regular,
      fontSize: 15,
      color: catalogUi.text,
      marginBottom: 4,
    },
    err: {
      color: catalogUi.dark ? "#FCA5A5" : "#b91c1c",
      fontFamily: fonts.regular,
      marginBottom: 8,
    },
    footer: { flexDirection: "row", gap: 12, marginTop: 12, marginBottom: 8 },
    btnGhost: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 14,
      borderRadius: 14,
      backgroundColor: catalogUi.iconCircleBg,
    },
    btnGhostText: { fontFamily: fonts.bold, fontSize: 16, color: catalogUi.accent },
    btnPrimary: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 14,
      borderRadius: 14,
      backgroundColor: catalogUi.accent,
    },
    btnPrimaryText: { fontFamily: fonts.bold, fontSize: 16, color: "#fff" },
  });
}

export type TimelineEntryFormStyles = ReturnType<typeof createTimelineEntryFormStyles>;
