/** @see ../modalDismissContract.ts */
import React, { useEffect, useMemo, useState } from "react";
import {
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { apiFetch, parseErrorDetail } from "@/api/client";
import { BottomSheetDragHeader, useBottomSheet } from "@/components/ui/bottomSheet";
import {
  CommentEntryFormFields,
  createTimelineEntryFormStyles,
  LogEntryDeleteConfirm,
  LogEntryEditorFooter,
  LogEntryEditorHeader,
} from "@/components/modals/timelineEntry";
import { emitExerciseUpdatedFromSetApiResponse } from "@/utils/exerciseUpdatedEvent";
import { parseLocalDateTimeInput, toLocalDateTimeInputValue } from "@/utils/localDateTimeInput";
import { useCatalogUi } from "@/theme/catalogUi";
import { useAppTheme } from "@/theme/appTheme";

export type LogEntry = Record<string, unknown>;

export function isCommentLogEntry(item: LogEntry | null): boolean {
  if (!item) return false;
  if (item.type === "comment") return true;

  const text = typeof item.comment === "string" ? item.comment.trim() : "";
  if (!text) return false;
  if (item.type === "mark" || item.type === "rest" || item.type === "set") return false;
  if (item.mark_type === "start" || item.mark_type === "end") return false;
  if (item.rest != null || item.rest_seconds != null) return false;
  if (
    item.reps != null ||
    item.weight != null ||
    item.weight_kg != null ||
    item.set_time != null ||
    item.set_seconds != null
  ) {
    return false;
  }
  return true;
}

function pickCommentDatetime(initial: LogEntry | null): string {
  const raw = initial?.datetime ?? initial?.time;
  if (typeof raw === "string" && raw.trim()) return toLocalDateTimeInputValue(raw);
  return toLocalDateTimeInputValue();
}

type Props = {
  visible: boolean;
  onClose: () => void;
  exerciseId: number;
  setIdx: number | null;
  initial: LogEntry | null;
  mode?: "create" | "edit";
  /** Встроить форму без оболочки Modal (внутри TimelineEntryCreateModal). */
  embedded?: boolean;
  primaryLabel?: string;
  onLoadingChange?: (loading: boolean) => void;
};

/** Редактор отдельной comment-сущности в журнале упражнения. */
export default function CommentEditorModal({
  visible,
  onClose,
  exerciseId,
  setIdx,
  initial,
  mode = "edit",
  embedded = false,
  primaryLabel,
  onLoadingChange,
}: Props) {
  const catalogUi = useCatalogUi();
  const theme = useAppTheme();
  const sheetStyles = useMemo(() => createSheetStyles(catalogUi), [catalogUi]);
  const formStyles = useMemo(() => createTimelineEntryFormStyles(catalogUi), [catalogUi]);
  const insets = useSafeAreaInsets();

  const [datetime, setDatetime] = useState(toLocalDateTimeInputValue());
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [error, setError] = useState("");
  const { mounted, sheetTranslateY, backdropOpacity, panHandlers, requestClose } = useBottomSheet(
    embedded ? false : visible,
    onClose,
    { dismissEnabled: !loading },
  );

  useEffect(() => {
    onLoadingChange?.(loading);
  }, [loading, onLoadingChange]);

  useEffect(() => {
    if (!visible) return;
    setError("");
    if (mode === "create" || !initial) {
      setDatetime(toLocalDateTimeInputValue());
      setComment("");
      return;
    }
    setDatetime(pickCommentDatetime(initial));
    setComment(typeof initial.comment === "string" ? initial.comment : "");
  }, [visible, initial, mode]);

  const handleSave = async () => {
    setLoading(true);
    setError("");
    try {
      const dt = parseLocalDateTimeInput(datetime);
      if (!dt) throw new Error("Укажите корректное время");
      const text = comment.trim();
      if (!text) throw new Error("Введите текст комментария");
      const body = {
        type: "comment" as const,
        datetime: dt,
        comment: text,
      };
      const r =
        mode === "edit" && setIdx != null
          ? await apiFetch(`/api/v1/exercises_in_workout/${exerciseId}/set/${setIdx}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            })
          : await apiFetch(`/api/v1/exercises_in_workout/${exerciseId}/set`, {
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
      const r = await apiFetch(`/api/v1/exercises_in_workout/${exerciseId}/set/${setIdx}`, {
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

  const showDelete = mode === "edit" && setIdx != null;
  const saveLabel = primaryLabel ?? (mode === "create" ? "Добавить" : "Сохранить");

  const formBody = (
    <>
            <CommentEntryFormFields
              datetime={datetime}
              onDatetimeChange={setDatetime}
              comment={comment}
              onCommentChange={setComment}
              styles={formStyles}
              placeholderTextColor={catalogUi.textPlaceholder}
            />

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
      <Modal visible={mounted} animationType="none" transparent statusBarTranslucent onRequestClose={onClose}>
      <View style={sheetStyles.backdrop}>
        <Animated.View
          pointerEvents="box-none"
          style={[StyleSheet.absoluteFill, { opacity: backdropOpacity, backgroundColor: theme.overlay }]}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={requestClose} />
        </Animated.View>
        <Animated.View
          style={[
            sheetStyles.sheet,
            {
              backgroundColor: theme.card,
              paddingBottom: 16 + Math.max(insets.bottom, 12),
              transform: [{ translateY: sheetTranslateY }],
            },
          ]}
        >
          <BottomSheetDragHeader panHandlers={panHandlers}>
            <LogEntryEditorHeader
              title="Комментарий"
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
        kind="comment"
        onCancel={() => setDeleteConfirmVisible(false)}
        onConfirm={() => {
          setDeleteConfirmVisible(false);
          void handleDelete();
        }}
      />
    </>
  );
}

const createSheetStyles = (catalogUi: ReturnType<typeof useCatalogUi>) =>
  StyleSheet.create({
    backdrop: { flex: 1, justifyContent: "flex-end" },
    sheet: {
      backgroundColor: catalogUi.cardBg,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: "92%",
      paddingHorizontal: 16,
      paddingTop: 8,
    },
  });
