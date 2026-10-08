import { StyleSheet } from "react-native";
import { metricToken } from "@/theme/metricTokens";
import { fonts, type } from "@/theme/typography";
import type { useAppTheme } from "@/theme/appTheme";
import { PLAQUE_RADIUS } from "@/theme/plaqueStyles";

export const workoutListItemTitleMetrics = {
  lineHeight: 18,
};

/** Стили `workouts-list-item-*` (карточка в истории тренировок). */
export const createWorkoutListItemStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
  card: {
    borderRadius: PLAQUE_RADIUS,
    borderWidth: 0,
    backgroundColor: theme.card,
    marginBottom: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    flexDirection: "row",

    shadowColor: "#24213A",
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: {
      width: 0,
      height: 8,
    },
    elevation: 2,
  },

  cardWithMetrics: {
    minHeight: 148,
  },

  dateBlock: {
    width: 46,
    alignItems: "center",
    paddingTop: 12,
  },

  dateDay: {
    fontFamily: fonts.extraBold,
    fontSize: 24,
    lineHeight: 30,
    color: theme.text,
    letterSpacing: -0.6,
  },

  dateMonth: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    lineHeight: 18,
    color: theme.text,
    marginTop: 1,
  },

  weekdayPill: {
    marginTop: 8,
    borderRadius: 7,
    backgroundColor: theme.cardSoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },

  weekdayText: {
    fontFamily: fonts.extraBold,
    fontSize: 12,
    lineHeight: 16,
    color: theme.accent,
  },

  verticalDivider: {
    width: 1,
    backgroundColor: theme.border,
    marginHorizontal: 12,
    marginVertical: 4,
  },

  cardContent: {
    flex: 1,
  },

  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },

  titleWithActiveDot: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginRight: 12,
  },

  workoutTitle: {
    flex: 1,
    minWidth: 0,
    ...type.cardEntityTitle,
    color: theme.text,
    lineHeight: workoutListItemTitleMetrics.lineHeight,
  },

  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 5,
    minHeight: 20,
  },

  locationText: {
    flexShrink: 1,
    marginLeft: 6,
    fontFamily: fonts.semiBold,
    fontSize: 14,
    lineHeight: 18,
    color: theme.accent,
  },

  noteText: {
    flex: 1,
    minWidth: 0,
    marginLeft: 7,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    color: theme.textMuted,
  },

  metricsRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 6,
  },

  metricItem: {
    flex: 1,
    flexDirection: "column",
    alignItems: "center",
    minWidth: 0,
  },

  metricIconCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 0,
  },

  metricGreen: {
    backgroundColor: metricToken("green", theme.dark).circle,
  },

  metricBlue: {
    backgroundColor: metricToken("blue", theme.dark).circle,
  },

  metricAmber: {
    backgroundColor: metricToken("amber", theme.dark).circle,
  },

  metricTeal: {
    backgroundColor: metricToken("teal", theme.dark).circle,
  },

  metricViolet: {
    backgroundColor: metricToken("violet", theme.dark).circle,
  },

  metricTextBlock: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
  },

  metricValue: {
    ...type.statTileValue,
    color: theme.text,
    fontSize: 14,
    lineHeight: 17,
    textAlign: "center",
    marginTop: 8,
  },

  metricLabel: {
    ...type.statTileLabel,
    color: theme.textMuted,
    fontSize: 12,
    lineHeight: 15,
    marginTop: 2,
    textAlign: "center",
  },
  });

export const workoutListItemStyles = createWorkoutListItemStyles({
  dark: false,
  bg: "#F8F7FC",
  card: "#FFFFFF",
  cardSoft: "#EDE9FE",
  text: "#11142D",
  textMuted: "#5C5870",
  border: "#E6E3F0",
  divider: "#ECEAF2",
  overlay: "rgba(24, 20, 40, 0.45)",
  accent: "#6D28D9",
  accentMuted: "#8B7CAD",
  accentSoft: "#EDE9FE",
  white: "#FFFFFF",
  danger: "#dc2626",
  switchOff: "#DADCE6",
  switchThumb: "#FFFFFF",
});
