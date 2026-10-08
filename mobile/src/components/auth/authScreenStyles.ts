import { Platform, StyleSheet } from "react-native";
import { colors } from "@/theme/colors";
import { fonts, type } from "@/theme/typography";

export const authScreenStyles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.pageBg },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 24,
    maxWidth: 480,
    width: "100%",
    alignSelf: "center",
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 28,
    ...Platform.select({
      ios: {
        shadowColor: "#1e1b4b",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 20,
      },
      android: { elevation: 6 },
      // Чтобы web выглядел как Android по глубине/теням.
      web: { elevation: 6 },
    }),
  },
  brandTitle: {
    ...type.heroTitle,
    fontSize: 24,
    lineHeight: 30,
    textAlign: "center",
    color: colors.text,
    marginBottom: 22,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 22,
    color: colors.text,
    marginBottom: 12,
  },
  err: {
    ...type.caption,
    lineHeight: 18,
    fontFamily: fonts.regular,
    color: colors.error,
    marginBottom: 8,
    textAlign: "center",
  },
  primaryBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    minHeight: 52,
  },
  primaryBtnText: {
    ...type.button,
    color: colors.surface,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    fontFamily: fonts.extraBold,
  },
  footerRow: {
    marginTop: 20,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
  },
  footerMuted: {
    ...type.bodyMedium,
    color: colors.muted,
    fontFamily: fonts.regular,
  },
  footerLink: {
    ...type.bodyMedium,
    color: colors.primary,
    fontFamily: fonts.semiBold,
  },
});
