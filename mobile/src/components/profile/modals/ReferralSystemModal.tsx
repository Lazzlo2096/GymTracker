import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Modal,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { apiFetch, parseErrorDetail } from "@/api/client";
import { buildReferralShareMessage } from "@/auth/registerPromo";
import {
  bottomSheetFrameStyle,
  bottomSheetMaxHeight,
  bottomSheetPadding,
  BottomSheetDismissButton,
  BottomSheetDragHeader,
  useBottomSheet,
} from "@/components/ui/bottomSheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { profileBottomSheetStyles as s } from "@/components/profile/modals/profileBottomSheetStyles";
import { useAppTheme } from "@/theme/appTheme";
import { fonts } from "@/theme/typography";
import { pressableStyle } from "@/utils/pressableStyles";

type Invitee = {
  display_name: string;
  status: string;
  tonnage_kg: number;
  milestone_kg: number;
  progress_percent: number;
};

type ReferralStats = {
  invited_total: number;
  milestone_completed: number;
  in_progress: number;
  rewards_earned: number;
  milestone_kg: number;
};

type PromoMe = {
  code: string;
  register_url: string;
  stats: ReferralStats;
  invitees: Invitee[];
};

type Props = {
  visible: boolean;
  onClose: () => void;
};

function statusLabel(status: string): string {
  if (status === "owner_rewarded") return "План выполнен";
  if (status === "pending") return "В процессе";
  return status;
}

function StatTile({
  label,
  value,
  icon,
  theme,
}: {
  label: string;
  value: string | number;
  icon: keyof typeof Ionicons.glyphMap;
  theme: ReturnType<typeof useAppTheme>;
}) {
  return (
    <View
      style={[
        s.statCard,
        { backgroundColor: theme.cardSoft, borderColor: theme.border },
      ]}
    >
      <Ionicons name={icon} size={20} color={theme.accent} />
      <Text style={[s.statValue, { color: theme.text }]}>{value}</Text>
      <Text style={[s.statLabel, { color: theme.textMuted }]}>{label}</Text>
    </View>
  );
}

export default function ReferralSystemModal({ visible, onClose }: Props) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { mounted, sheetTranslateY, backdropOpacity, panHandlers, requestClose, windowHeight } =
    useBottomSheet(visible, onClose);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<PromoMe | null>(null);
  const [err, setErr] = useState("");
  const [copyDone, setCopyDone] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const r = await apiFetch("/api/v1/promo-codes/me");
      if (!r.ok) throw new Error(parseErrorDetail(await r.json().catch(() => ({}))));
      setData((await r.json()) as PromoMe);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка загрузки");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) load();
  }, [visible, load]);

  useEffect(() => {
    if (!visible) setCopyDone(false);
  }, [visible]);

  useEffect(() => {
    if (!copyDone) return;
    const t = setTimeout(() => setCopyDone(false), 2000);
    return () => clearTimeout(t);
  }, [copyDone]);

  const copyCode = async (code: string) => {
    try {
      if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(code);
        setCopyDone(true);
        return;
      }
      const result = await Share.share({ message: code });
      if (Platform.OS === "ios" && result.action === Share.dismissedAction) return;
      setCopyDone(true);
    } catch {
      Alert.alert("Ошибка", "Не удалось скопировать промокод");
    }
  };

  const shareReferral = async () => {
    if (!data) return;
    const message = buildReferralShareMessage(data.code, data.register_url);
    await Share.share({ message, url: data.register_url });
  };

  if (!mounted) return null;

  return (
    <Modal
      visible={mounted}
      animationType="none"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={s.backdrop}>
        <Animated.View
          pointerEvents="box-none"
          style={[StyleSheet.absoluteFill, { opacity: backdropOpacity, backgroundColor: theme.overlay }]}
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
            <Text style={[s.title, { color: theme.text }]}>Реферальная система</Text>
          </BottomSheetDragHeader>

          {loading ? (
            <ActivityIndicator color={theme.accent} style={styles.loader} />
          ) : err ? (
            <Text style={[s.err, { color: theme.danger }]}>{err}</Text>
          ) : data ? (
            <View style={styles.content}>
              <Text style={[s.hint, { color: theme.textMuted }]}>
                Поделитесь промокодом. Когда приглашённые люди суммарно прозанимаются с приложением
                не меньше {/* data.stats.milestone_hours */ 100} часов, то вы получите Premium.
              </Text>

              <View style={s.statsRow}>
                <StatTile
                  label="Приглашено"
                  value={data.stats.invited_total}
                  icon="people-outline"
                  theme={theme}
                />
                <StatTile
                  label="Выполнили план"
                  value={data.stats.milestone_completed}
                  icon="checkmark-circle-outline"
                  theme={theme}
                />
                <StatTile
                  label="В процессе"
                  value={data.stats.in_progress}
                  icon="time-outline"
                  theme={theme}
                />
                <StatTile
                  label="Наград получено"
                  value={data.stats.rewards_earned}
                  icon="diamond-outline"
                  theme={theme}
                />
              </View>

              <View style={[s.codeBox, { backgroundColor: theme.cardSoft }]}>
                <Text style={[s.codeLabel, { color: theme.textMuted }]}>Ваш промокод</Text>
                <Text style={[s.code, { color: theme.text }]} selectable>
                  {data.code}
                </Text>
              </View>

              <View style={s.btnRow}>
                <Pressable
                  style={pressableStyle(
                    [s.iconBtn, { borderColor: theme.border, backgroundColor: theme.cardSoft }],
                    { pressed: { opacity: 0.88 } },
                  )}
                  onPress={() => void copyCode(data.code)}
                >
                  <Ionicons
                    name={copyDone ? "checkmark-outline" : "copy-outline"}
                    size={18}
                    color={theme.accent}
                  />
                  <Text style={[s.iconBtnText, { color: theme.text }]}>
                    {copyDone ? "Скопировано" : "Скопировать"}
                  </Text>
                </Pressable>
                <Pressable
                  style={pressableStyle([s.iconBtn, { backgroundColor: theme.accent, borderColor: theme.accent }], {
                    pressed: { opacity: 0.9 },
                  })}
                  onPress={shareReferral}
                >
                  <Ionicons name="share-social-outline" size={18} color="#fff" />
                  <Text style={[s.iconBtnText, { color: "#fff" }]}>Поделиться</Text>
                </Pressable>
              </View>

              <Text style={[s.sectionTitle, { color: theme.text }]}>Приглашённые</Text>
              {data.invitees.length === 0 ? (
                <Text style={[styles.empty, { color: theme.textMuted }]}>
                  Пока никого нет — отправьте промокод друзьям
                </Text>
              ) : (
                data.invitees.map((inv, i) => {
                  const done = inv.status === "owner_rewarded";
                  return (
                    <View
                      key={`${inv.display_name}-${i}`}
                      style={[styles.invitee, { borderColor: theme.divider }]}
                    >
                      <View style={styles.inviteeHead}>
                        <Text style={[styles.inviteeName, { color: theme.text }]}>
                          {inv.display_name}
                        </Text>
                        <Text
                          style={[
                            styles.inviteeStatus,
                            { color: done ? theme.accent : theme.textMuted },
                          ]}
                        >
                          {statusLabel(inv.status)}
                        </Text>
                      </View>
                      <View style={[styles.progressTrack, { backgroundColor: theme.cardSoft }]}>
                        <View
                          style={[
                            styles.progressFill,
                            {
                              backgroundColor: theme.accent,
                              width: `${Math.min(100, inv.progress_percent)}%`,
                            },
                          ]}
                        />
                      </View>
                      <Text style={[styles.inviteeMeta, { color: theme.textMuted }]}>
                        {inv.tonnage_kg} / {inv.milestone_kg} т ({inv.progress_percent}%)
                      </Text>
                    </View>
                  );
                })
              )}
            </View>
          ) : null}

          <BottomSheetDismissButton label="Закрыть" onPress={onClose} />
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 4 },
  loader: { marginVertical: 24 },
  empty: { fontFamily: fonts.regular, fontSize: 14, marginBottom: 12, lineHeight: 20 },
  invitee: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
  },
  inviteeHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  inviteeName: { fontFamily: fonts.semiBold, fontSize: 15, flex: 1 },
  inviteeStatus: { fontFamily: fonts.semiBold, fontSize: 12 },
  progressTrack: { height: 6, borderRadius: 3, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 3 },
  inviteeMeta: { fontFamily: fonts.regular, fontSize: 12, marginTop: 6 },
});
