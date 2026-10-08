import { StyleSheet } from "react-native";
import { PLAQUE_RADIUS, plaqueListShadow } from "@/theme/plaqueStyles";
import { metricToken } from "@/theme/metricTokens";
import type { useAppTheme } from "@/theme/appTheme";
import { fonts, type } from "@/theme/typography";

export function createHomeStatsStyles(theme: ReturnType<typeof useAppTheme>) {
  const activityHigh = metricToken("green", theme.dark);
  const activityMid = metricToken("teal", theme.dark);

  return {
    theme,
    tokens: { activityHigh, activityMid },
    styles: StyleSheet.create({
      card: {
        borderRadius: PLAQUE_RADIUS,
        backgroundColor: theme.card,
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 18,
        marginBottom: 12,
        ...plaqueListShadow(),
      },

      sectionHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 12,
      },

      sectionTitle: {
        ...type.section,
        fontSize: 17,
        lineHeight: 22,
        fontFamily: fonts.semiBold,
        color: theme.text,
        marginBottom: 12,
      },

      sectionTitleInline: {
        marginBottom: 0,
      },

      periodSelect: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
      },

      periodText: {
        ...type.settingsRowValue,
        color: theme.textMuted,
      },

      periodDot: {
        ...type.settingsRowValue,
        color: theme.textMuted,
        marginHorizontal: 2,
      },

      bucketSelectTrigger: {
        flexDirection: "row",
        alignItems: "center",
        gap: 2,
        paddingVertical: 2,
        paddingLeft: 2,
      },

      bucketSelectLabel: {
        ...type.settingsRowValue,
        color: theme.text,
        fontFamily: fonts.medium,
      },

      bucketModalBackdrop: {
        flex: 1,
      },

      bucketModalDismiss: {
        ...StyleSheet.absoluteFillObject,
      },

      bucketDropdown: {
        minWidth: 168,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: theme.border,
        borderRadius: 10,
        backgroundColor: theme.card,
        overflow: "hidden",
        elevation: 12,
        shadowColor: "#000",
        shadowOpacity: 0.14,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
      },

      bucketDropdownItem: {
        minHeight: 40,
        paddingHorizontal: 12,
        justifyContent: "center",
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: theme.divider,
      },

      bucketDropdownItemFirst: {
        borderTopWidth: 0,
      },

      bucketDropdownText: {
        fontFamily: fonts.medium,
        fontSize: 13,
        lineHeight: 18,
        color: theme.text,
      },

      bucketDropdownTextActive: {
        color: theme.accent,
        fontFamily: fonts.semiBold,
      },

      chartScrollContent: {
        paddingBottom: 2,
      },

      chartPlot: {
        marginTop: 8,
        height: 132,
        position: "relative",
        justifyContent: "flex-end",
      },

      gridLine: {
        position: "absolute",
        left: 0,
        right: 0,
        height: StyleSheet.hairlineWidth,
        backgroundColor: theme.divider,
      },

      chartBarsRow: {
        flexDirection: "row",
        alignItems: "flex-end",
        justifyContent: "space-between",
      },

      chartColumn: {
        flex: 1,
        alignItems: "center",
        minWidth: 0,
      },

      chartColumnFixed: {
        alignItems: "center",
        flexGrow: 0,
        flexShrink: 0,
      },

      barArea: {
        alignItems: "center",
        justifyContent: "flex-end",
      },

      barValue: {
        fontFamily: fonts.medium,
        fontSize: 10,
        lineHeight: 12,
        color: theme.text,
        marginBottom: 3,
        textAlign: "center",
        width: "100%",
      },

      verticalBar: {
        width: 12,
        borderRadius: 6,
        backgroundColor: activityHigh.fg,
      },

      chartLabelsRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        paddingTop: 8,
        marginTop: 2,
      },

      axisLabel: {
        fontFamily: fonts.medium,
        fontSize: 9,
        lineHeight: 12,
        color: theme.textMuted,
        textAlign: "center",
        width: "100%",
      },

      axisYear: {
        fontFamily: fonts.medium,
        fontSize: 8,
        lineHeight: 11,
        color: theme.textMuted,
        marginTop: 1,
        textAlign: "center",
        width: "100%",
      },

      calendarHeatmapLayout: {
        position: "relative",
      },

      calendarScrollContent: {
        paddingTop: 4,
        paddingRight: 25,
      },

      calendarDayLabelsColumn: {
        position: "absolute",
        top: 0,
        right: 0,
        width: 25,
        paddingRight: 4,
        backgroundColor: theme.card,
      },

      calendarDayLabelsMonthSpacer: {
        height: 16,
        marginTop: 4,
        marginBottom: 4,
      },

      calendarDayLabelRow: {
        width: 25,
        height: 20,
        marginBottom: 2,
        justifyContent: "center",
      },

      monthsRow: {
        flexDirection: "row",
        marginBottom: 4,
        height: 16,
      },

      weekHeaderCell: {
        width: 22,
        overflow: "visible",
      },

      monthLabel: {
        fontFamily: fonts.medium,
        fontSize: 10,
        lineHeight: 13,
        width: 72,
        color: theme.textMuted,
      },

      calendarRow: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 2,
      },

      dayCell: {
        width: 20,
        height: 20,
        borderRadius: 5,
        marginRight: 2,
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
      },

      dayCellEmpty: {
        width: 20,
        height: 20,
        marginRight: 2,
      },

      dayNumber: {
        fontFamily: fonts.medium,
        fontSize: 10,
        lineHeight: 12,
      },

      dayDot: {
        position: "absolute",
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: theme.accent,
        top: 0,
        right: 1,
      },

      dayLabel: {
        width: 20,
        marginLeft: 5,
        fontFamily: fonts.medium,
        fontSize: 10,
        lineHeight: 13,
        color: theme.textMuted,
      },

      editButton: {
        marginTop: 16,
        textAlign: "center",
        ...type.settingsRowLabel,
        color: theme.textMuted,
      },

      streaksList: {
        marginTop: 4,
        gap: 3,
      },

      streakRow: {
        flexDirection: "row",
        alignItems: "center",
        width: "100%",
        gap: 3,
      },

      streakDate: {
        width: 72,
        flexShrink: 0,
        fontFamily: fonts.medium,
        fontSize: 9,
        lineHeight: 12,
        color: theme.textMuted,
        textAlign: "center",
      },

      streakBarTrack: {
        flex: 1,
        minWidth: 0,
        alignItems: "center",
        justifyContent: "center",
      },

      streakBar: {
        height: 20,
        borderRadius: 5,
        alignItems: "center",
        justifyContent: "center",
        minWidth: 28,
        maxWidth: "100%",
      },

      streakValue: {
        fontFamily: fonts.medium,
        fontSize: 10,
        lineHeight: 12,
      },
    }),
  };
}

export type HomeStatsStyles = ReturnType<typeof createHomeStatsStyles>;

export function streakBarColors(
  days: number,
  maxDays: number,
  theme: ReturnType<typeof useAppTheme>,
  tokens: HomeStatsStyles["tokens"],
): { backgroundColor: string; textColor: string } {
  if (days === maxDays) {
    return { backgroundColor: theme.accent, textColor: theme.white };
  }
  if (days >= 68) {
    return { backgroundColor: tokens.activityHigh.fg, textColor: theme.white };
  }
  if (days >= 60) {
    return { backgroundColor: tokens.activityMid.circle, textColor: tokens.activityMid.fg };
  }
  return { backgroundColor: theme.border, textColor: theme.textMuted };
}

export function calendarCellColors(
  intensity: 0 | 1 | 2,
  theme: ReturnType<typeof useAppTheme>,
  tokens: HomeStatsStyles["tokens"],
): { backgroundColor: string; textColor: string } {
  if (intensity === 2) {
    return { backgroundColor: tokens.activityHigh.fg, textColor: theme.white };
  }
  if (intensity === 1) {
    return { backgroundColor: tokens.activityMid.circle, textColor: tokens.activityMid.fg };
  }
  return { backgroundColor: theme.border, textColor: theme.textMuted };
}
