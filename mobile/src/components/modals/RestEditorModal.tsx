/** @see ./modalDismissContract.ts */
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useState } from "react";
import {
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { apiFetch, parseErrorDetail } from "@/api/client";
import {
  emitExerciseUpdatedFromSetApiResponse,
  type ExerciseTimelineSource,
} from "@/utils/exerciseUpdatedEvent";
import { useCatalogUi } from "@/theme/catalogUi";
import { fonts } from "@/theme/typography";
import { BottomSheetDragHeader, useBottomSheet } from "@/components/ui/bottomSheet";
import {
  createTimelineEntryFormStyles,
  LogEntryDeleteConfirm,
  LogEntryEditorFooter,
  LogEntryEditorHeader,
} from "@/components/modals/timelineEntry";
import { useAppTheme } from "@/theme/appTheme";

export type LogEntry = Record<string, unknown>;

const QUICK_REST_SEC = [60, 90, 120, 150, 180, 300] as const;

function fmtMmSs(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function parseMmSs(raw: string): number | null {
  const t = raw.trim();
  const m = /^(\d+):(\d{2})$/.exec(t);
  if (!m) return null;
  const mm = parseInt(m[1], 10);
  const ss = parseInt(m[2], 10);
  if (!Number.isFinite(mm) || !Number.isFinite(ss) || ss >= 60) return null;
  return mm * 60 + ss;
}

function parseRestToSec(rest: unknown): number | null {
  if (typeof rest === "number" && Number.isFinite(rest)) return Math.max(0, Math.floor(rest));
  if (typeof rest !== "string") return null;
  return parseMmSs(rest);
}

export function isRestLogEntry(item: LogEntry | null): boolean {
  if (!item) return false;
  if (item.type === "rest") return true;
  if (typeof item.rest_seconds === "number") return true;
  if (item.rest != null && String(item.rest).trim() !== "") return true;
  return false;
}

type Props = {
  visible: boolean;
  onClose: () => void;
  exerciseId: number;
  setIdx: number | null;
  initial: LogEntry | null;
  mode?: "create" | "edit";
  /** Журнал подходов или planned_sets_json. */
  timeline?: ExerciseTimelineSource;
  /** Встроить форму без оболочки Modal (внутри TimelineEntryCreateModal). */
  embedded?: boolean;
  primaryLabel?: string;
  onLoadingChange?: (loading: boolean) => void;
};

/**
 * Редактор записи отдыха в журнале упражнения.
 */
export default function RestEditorModal({
  visible,
  onClose,
  exerciseId,
  setIdx,
  initial,
  mode = "edit",
  timeline = "log",
  embedded = false,
  primaryLabel,
  onLoadingChange,
}: Props) {
  const catalogUi = useCatalogUi();
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(catalogUi), [catalogUi]);
  const formStyles = useMemo(() => createTimelineEntryFormStyles(catalogUi), [catalogUi]);
  const insets = useSafeAreaInsets();

  const [restStr, setRestStr] = useState("2:00");
  const [restUnit, setRestUnit] = useState<"mmss" | "sec">("mmss");
  const [openedSelect, setOpenedSelect] = useState(false);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const { mounted, sheetTranslateY, backdropOpacity, panHandlers, requestClose } = useBottomSheet(
    embedded ? false : visible,
    onClose,
    { dismissEnabled: !loading },
  );
  const [error, setError] = useState("");

  useEffect(() => {
    onLoadingChange?.(loading);
  }, [loading, onLoadingChange]);

  useEffect(() => {
    if (!visible) return;
    setError("");
    setOpenedSelect(false);
    if (mode === "create" || !initial) {
      setRestStr("2:00");
      setRestUnit("mmss");
      setComment("");
      return;
    }
    const rs =
      typeof initial.rest_seconds === "number"
        ? initial.rest_seconds
        : parseRestToSec(initial.rest);
    setRestStr(fmtMmSs(rs != null && rs > 0 ? rs : 120));
    setRestUnit("mmss");
    setComment(typeof initial.comment === "string" ? initial.comment : "");
  }, [visible, initial, mode]);

  const chooseRestUnit = (next: "mmss" | "sec") => {
    if (next === restUnit) {
      setOpenedSelect(false);
      return;
    }
    if (next === "mmss") {
      const sec = parseInt(restStr.trim(), 10);
      if (Number.isFinite(sec) && sec >= 0) setRestStr(fmtMmSs(sec));
      setRestUnit("mmss");
      setOpenedSelect(false);
      return;
    }
    const sec = parseMmSs(restStr);
    if (sec != null) setRestStr(String(sec));
    setRestUnit("sec");
    setOpenedSelect(false);
  };

  const applyQuickRest = (sec: number) => {
    setRestStr(restUnit === "sec" ? String(sec) : fmtMmSs(sec));
  };

  const parseRestInput = () =>
    restUnit === "mmss"
      ? parseMmSs(restStr)
      : (() => {
          const sec = parseInt(restStr.trim(), 10);
          return Number.isFinite(sec) && sec >= 0 ? sec : null;
        })();

  const handleSave = async () => {
    setLoading(true);
    setError("");
    try {
      const rs = parseRestInput();
      if (rs == null || rs < 0) throw new Error("Укажите длительность отдыха");
      const body =
        timeline === "planned"
          ? {
              type: "rest" as const,
              rest_seconds: rs,
            }
          : {
              type: "rest" as const,
              rest_seconds: rs,
              comment: comment.trim() || null,
            };
      const base =
        timeline === "planned"
          ? `/api/v1/exercises_in_workout/${exerciseId}/planned_set`
          : `/api/v1/exercises_in_workout/${exerciseId}/set`;
      const r =
        mode === "edit" && setIdx != null
          ? await apiFetch(`${base}/${setIdx}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            })
          : await apiFetch(base, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(parseErrorDetail(d));
      emitExerciseUpdatedFromSetApiResponse(exerciseId, d);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (setIdx == null) return;
    setLoading(true);
    setError("");
    try {
      const base =
        timeline === "planned"
          ? `/api/v1/exercises_in_workout/${exerciseId}/planned_set`
          : `/api/v1/exercises_in_workout/${exerciseId}/set`;
      const r = await apiFetch(`${base}/${setIdx}`, {
        method: "DELETE",
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(parseErrorDetail(d));
      emitExerciseUpdatedFromSetApiResponse(exerciseId, d);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  };

  const activeQuick = parseRestInput();
  const showDelete = mode === "edit" && setIdx != null;
  const saveLabel = primaryLabel ?? (mode === "create" ? "Добавить" : "Сохранить");

  const formBody = (
    <>
            <Text style={[styles.lab, { color: theme.textMuted }]}>Длительность отдыха</Text>
            <View style={[styles.selectWrap, openedSelect && styles.selectWrapActive]}>
              <View style={[styles.split, { borderColor: theme.border, backgroundColor: theme.bg }]}>
                <TextInput
                  style={styles.splitInput}
                  value={restStr}
                  onChangeText={setRestStr}
                  placeholder={restUnit === "mmss" ? "2:00" : "120"}
                  placeholderTextColor={theme.textPlaceholder}
                  onFocus={() => setOpenedSelect(false)}
                />
                <Pressable
                  style={[styles.unitBtn, { borderLeftColor: theme.border, backgroundColor: theme.card }]}
                  onPress={() => setOpenedSelect((s) => !s)}
                >
                  <Text style={[styles.unitTxt, { color: theme.textMuted }]}>
                    {restUnit === "mmss" ? "М:СС" : "сек"}
                  </Text>
                  <Ionicons
                    name={openedSelect ? "chevron-up" : "chevron-down"}
                    size={14}
                    color={catalogUi.textMuted}
                  />
                </Pressable>
              </View>
              {openedSelect ? (
                <View style={[styles.dropdown, { borderColor: theme.border, backgroundColor: theme.card }]}>
                  <Pressable style={styles.dropdownItem} onPress={() => chooseRestUnit("mmss")}>
                    <Text style={[styles.dropdownText, { color: theme.text }, restUnit === "mmss" && styles.dropdownTextActive]}>
                      М:СС
                    </Text>
                  </Pressable>
                  <Pressable style={styles.dropdownItem} onPress={() => chooseRestUnit("sec")}>
                    <Text style={[styles.dropdownText, { color: theme.text }, restUnit === "sec" && styles.dropdownTextActive]}>
                      сек
                    </Text>
                  </Pressable>
                </View>
              ) : null}
            </View>

            {timeline === "log" ? (
              <>
                <Text style={formStyles.labFull}>Комментарий</Text>
                <TextInput
                  style={formStyles.area}
                  value={comment}
                  onChangeText={setComment}
                  placeholder="Например: сократил специально"
                  placeholderTextColor={catalogUi.textPlaceholder}
                  multiline
                />
              </>
            ) : null}

            <Text style={formStyles.labFull}>Быстрый выбор</Text>
            <View style={styles.quickRow}>
              {QUICK_REST_SEC.map((sec) => {
                const active = activeQuick === sec;
                return (
                  <Pressable
                    key={sec}
                    style={[styles.quickChip, active && styles.quickChipOn]}
                    onPress={() => applyQuickRest(sec)}
                  >
                    <Text
                      numberOfLines={1}
                      ellipsizeMode="clip"
                      style={[styles.quickChipTxt, active && styles.quickChipTxtOn]}
                    >
                      {fmtMmSs(sec)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {error ? <Text style={formStyles.err}>{error}</Text> : null}

            <LogEntryEditorFooter
              loading={loading}
              onCancel={onClose}
              onPrimary={handleSave}
              primaryLabel={saveLabel}
              styles={formStyles}
            />
    </>
  );

  if (embedded) {
    if (!visible) return null;
    return formBody;
  }

  if (!mounted) return null;

  return (
    <>
      <Modal
        visible={mounted}
        animationType="none"
        transparent
        statusBarTranslucent
        onRequestClose={onClose}
      >
      <View style={styles.backdrop}>
        <Animated.View
          pointerEvents="box-none"
          style={[StyleSheet.absoluteFill, { opacity: backdropOpacity, backgroundColor: theme.overlay }]}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={requestClose} />
        </Animated.View>
        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.card,
              paddingBottom: 16 + Math.max(insets.bottom, 12),
              transform: [{ translateY: sheetTranslateY }],
            },
          ]}
        >
          <BottomSheetDragHeader panHandlers={panHandlers}>
            <LogEntryEditorHeader
              title="Отдых"
              onClose={onClose}
              onDelete={showDelete ? () => setDeleteConfirmVisible(true) : undefined}
              deleteDisabled={loading}
            />
          </BottomSheetDragHeader>

          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {formBody}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
      <LogEntryDeleteConfirm
        visible={deleteConfirmVisible}
        kind="rest"
        onCancel={() => setDeleteConfirmVisible(false)}
        onConfirm={() => {
          setDeleteConfirmVisible(false);
          void handleDelete();
        }}
      />
    </>
  );
}

const createStyles = (catalogUi: ReturnType<typeof useCatalogUi>) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      justifyContent: "flex-end",
    },
    sheet: {
      backgroundColor: catalogUi.cardBg,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: "92%",
      paddingHorizontal: 16,
      paddingTop: 8,
    },
    lab: { fontFamily: fonts.semiBold, fontSize: 11, color: catalogUi.textMuted, marginBottom: 6 },
    split: {
      flexDirection: "row",
      borderWidth: 1,
      borderColor: catalogUi.border,
      borderRadius: 12,
      overflow: "hidden",
      backgroundColor: catalogUi.pageBg,
    },
    selectWrap: {
      position: "relative",
      zIndex: 20,
    },
    selectWrapActive: {
      zIndex: 120,
    },
    splitInput: {
      flex: 1,
      paddingVertical: 10,
      paddingHorizontal: 8,
      fontFamily: fonts.semiBold,
      fontSize: 15,
      color: catalogUi.text,
      minWidth: 0,
      borderTopLeftRadius: 11,
      borderBottomLeftRadius: 11,
    },
    dropdown: {
      position: "absolute",
      top: 44,
      left: 0,
      right: 0,
      borderWidth: 1,
      borderColor: catalogUi.border,
      borderRadius: 10,
      backgroundColor: catalogUi.cardBg,
      overflow: "hidden",
      zIndex: 100,
      elevation: 10,
      shadowColor: "#000",
      shadowOpacity: 0.14,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
    },
    dropdownItem: {
      minHeight: 36,
      paddingHorizontal: 10,
      justifyContent: "center",
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: catalogUi.border,
    },
    dropdownText: {
      fontFamily: fonts.semiBold,
      fontSize: 13,
      color: catalogUi.text,
    },
    dropdownTextActive: {
      color: catalogUi.accent,
    },
    unitBtn: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 6,
      borderLeftWidth: 1,
      borderLeftColor: catalogUi.border,
      backgroundColor: catalogUi.cardBg,
      borderTopRightRadius: 11,
      borderBottomRightRadius: 11,
    },
    unitTxt: { fontFamily: fonts.semiBold, fontSize: 12, color: catalogUi.textMuted, marginRight: 2 },
    quickRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
      rowGap: 6,
      marginBottom: 12,
    },
    quickChip: {
      width: "31.8%",
      minHeight: 44,
      paddingVertical: 10,
      paddingHorizontal: 2,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: catalogUi.border,
      backgroundColor: catalogUi.cardBg,
      alignItems: "center",
    },
    quickChipOn: { borderColor: catalogUi.accent, backgroundColor: catalogUi.iconCircleBg },
    quickChipTxt: { fontFamily: fonts.semiBold, fontSize: 13, color: catalogUi.text, textAlign: "center" },
    quickChipTxtOn: { color: catalogUi.accent },
  });
