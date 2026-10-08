/** @see ./modalDismissContract.ts */
import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
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
import { MODAL_FADE_MS } from "@/components/modals/modalDismissContract";
import {
  createTimelineEntryFormStyles,
  LogEntryDeleteConfirm,
  LogEntryEditorFooter,
  LogEntryEditorHeader,
} from "@/components/modals/timelineEntry";
import ScreenTitleRowIconButton from "@/components/ui/ScreenTitleRowIconButton";
import { useAppTheme } from "@/theme/appTheme";
import SetEffortLevelPicker from "@/components/exercise/SetEffortLevelPicker";
import SetWeightCompositionPanel from "@/components/exercise/SetWeightCompositionPanel";
import SegmentedTabs, { type SegmentedTabItem } from "@/components/ui/SegmentedTabs";
import { fetchLatestBodyweightKg } from "@/api/weightDiary";
import {
  buildCompositionFromDraft,
  extractCompositionDraft,
  parseWeightComposition,
  type CompositionTermDraft,
  type WeightInputMode,
} from "@/domain/weightComposition";
import { parseSetEffortLevel, type SetEffortLevel } from "@/utils/workoutSetEffort";

export type LogEntry = Record<string, unknown>;

type Props = {
  visible: boolean;
  onClose: () => void;
  exerciseId: number;
  setIdx: number | null;
  initial: LogEntry | null;
  mode: "create" | "edit" | "draft";
  /** Журнал подходов или planned_sets_json. */
  timeline?: ExerciseTimelineSource;
  /** Встроить форму без оболочки Modal (внутри TimelineEntryCreateModal). */
  embedded?: boolean;
  /** sheet — нижний лист; center — диалог по центру экрана. */
  presentation?: "sheet" | "center";
  primaryLabel?: string;
  onLoadingChange?: (loading: boolean) => void;
  /** После fade-out центрированной модалки — сброс payload у родителя. */
  onDismiss?: () => void;
  /** Поля «Вес (текст)» и «Повторения (текст)». */
  showSetTextFields?: boolean;
  /** Локальное сохранение черновика без API (следующий подход). */
  onDraftSave?: (entry: LogEntry) => void;
  /** Момент подхода для выбора веса из дневника: последнее измерение <= этого времени. */
  bodyweightAt?: string | Date | null;
  /** Скрыть автопоказ редактора завершённого подхода и закрыть текущую модалку. */
  onDisableAutoEdit?: () => void;
};

function pickExplicitWeightKg(item: LogEntry): number | null {
  const w = item.weight_kg ?? item.weight;
  if (typeof w === "number" && Number.isFinite(w)) return w;
  if (typeof w === "string") {
    const n = parseFloat(w.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function pickReps(item: LogEntry): number | null {
  const r = item.reps;
  if (typeof r === "number" && Number.isFinite(r)) return Math.floor(r);
  if (typeof r === "string") {
    const n = parseInt(r, 10);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function pickReachedFailure(item: LogEntry): boolean {
  return item.reached_failure === true;
}

type DropdownAnchor = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const WEIGHT_UNIT_OPTIONS: { id: "kg" | "lbs" | "plates"; label: string }[] = [
  { id: "kg", label: "кг" },
  { id: "lbs", label: "lbs" },
  { id: "plates", label: "плитки" },
];

const WEIGHT_INPUT_TABS: readonly SegmentedTabItem<WeightInputMode>[] = [
  { id: "simple", label: "Числами", nativeId: "set-editor-weight-mode-simple" },
  { id: "bodyweight_plus", label: "Конструктор", nativeId: "set-editor-weight-mode-bodyweight-plus" },
  { id: "text", label: "Текстом", nativeId: "set-editor-weight-mode-text" },
];

/**
 * Редактор подхода: нижний лист с весом, повторениями и комментарием.
 */
export default function SetEditorModal({
  visible,
  onClose,
  exerciseId,
  setIdx,
  initial,
  mode,
  timeline = "log",
  embedded = false,
  presentation = "sheet",
  primaryLabel,
  onLoadingChange,
  onDismiss,
  showSetTextFields = true,
  onDraftSave,
  bodyweightAt = null,
  onDisableAutoEdit,
}: Props) {
  const isCenter = presentation === "center";
  const isSheet = !embedded && !isCenter;
  const catalogUi = useCatalogUi();
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(catalogUi), [catalogUi]);
  const formStyles = useMemo(() => createTimelineEntryFormStyles(catalogUi), [catalogUi]);
  const insets = useSafeAreaInsets();

  const [weight, setWeight] = useState("");
  const [weightString, setWeightString] = useState("");
  const [reps, setReps] = useState("");
  const [repsString, setRepsString] = useState("");
  const [weightUnit, setWeightUnit] = useState<"kg" | "lbs" | "plates">("kg");
  const [openedSelect, setOpenedSelect] = useState<"weight" | null>(null);
  const [weightSelectAnchor, setWeightSelectAnchor] = useState<DropdownAnchor | null>(null);
  const weightSelectAnchorRef = useRef<View>(null);
  const [commentSet, setCommentSet] = useState("");
  const [reachedFailure, setReachedFailure] = useState(false);
  const [effortLevel, setEffortLevel] = useState<SetEffortLevel | null>(null);
  const [loading, setLoading] = useState(false);
  const [weightInputMode, setWeightInputMode] = useState<WeightInputMode>("simple");
  const [bodyweightKg, setBodyweightKg] = useState<number | null>(null);
  const [bodyweightLoading, setBodyweightLoading] = useState(false);
  const [compositionTerms, setCompositionTerms] = useState<CompositionTermDraft[]>([]);
  const weightStringTouchedRef = useRef(false);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const { mounted, sheetTranslateY, backdropOpacity, panHandlers, requestClose } = useBottomSheet(
    isSheet && visible,
    onClose,
    { dismissEnabled: !loading },
  );
  const dismissOnceRef = useRef(false);
  const fireDismiss = useCallback(() => {
    if (!onDismiss || dismissOnceRef.current) return;
    dismissOnceRef.current = true;
    onDismiss();
  }, [onDismiss]);

  useEffect(() => {
    if (visible) {
      dismissOnceRef.current = false;
      return;
    }
    if (!isCenter || !onDismiss) return;
    const t = setTimeout(fireDismiss, MODAL_FADE_MS);
    return () => clearTimeout(t);
  }, [visible, isCenter, onDismiss, fireDismiss]);

  const [error, setError] = useState("");

  useEffect(() => {
    onLoadingChange?.(loading);
  }, [loading, onLoadingChange]);

  useEffect(() => {
    if (!visible) return;
    setError("");
    setOpenedSelect(null);
    setWeightSelectAnchor(null);
    weightStringTouchedRef.current = false;
    setBodyweightLoading(true);

    void fetchLatestBodyweightKg({ at: bodyweightAt })
      .then((kg) => setBodyweightKg(kg))
      .catch(() => setBodyweightKg(null))
      .finally(() => setBodyweightLoading(false));

    if (!initial) {
      setWeight("");
      setWeightString("");
      setReps("");
      setRepsString("");
      setWeightUnit("kg");
      setCommentSet("");
      setReachedFailure(false);
      setEffortLevel(null);
      setWeightInputMode("simple");
      setCompositionTerms([]);
      return;
    }

    const composition = parseWeightComposition(initial.weight_composition);
    const compositionDraft = extractCompositionDraft(composition);
    if (compositionDraft) {
      setWeightInputMode("bodyweight_plus");
      setCompositionTerms(compositionDraft);
    } else if (
      (typeof initial.weight_string === "string" && initial.weight_string.trim()) ||
      (typeof initial.reps_string === "string" && initial.reps_string.trim())
    ) {
      setWeightInputMode("text");
      setCompositionTerms([]);
    } else {
      setWeightInputMode("simple");
      setCompositionTerms([]);
    }

    const w = pickExplicitWeightKg(initial);
    const r = pickReps(initial);
    setWeight(w != null ? String(w) : "");
    setWeightString(
      typeof initial.weight_string === "string" ? initial.weight_string : "",
    );
    setReps(r != null ? String(r) : "");
    setRepsString(typeof initial.reps_string === "string" ? initial.reps_string : "");
    setWeightUnit("kg");
    setCommentSet(typeof initial.comment === "string" ? initial.comment : "");
    setReachedFailure(pickReachedFailure(initial));
    setEffortLevel(parseSetEffortLevel(initial.effort_level));
  }, [visible, initial, bodyweightAt]);

  const compositionPreview = useMemo(
    () => buildCompositionFromDraft(compositionTerms),
    [compositionTerms],
  );

  const handleWeightChange = (value: string) => {
    setWeight(value);
  };

  const handleWeightStringChange = (value: string) => {
    weightStringTouchedRef.current = true;
    setWeightString(value);
  };

  const handleRepsStringChange = (value: string) => {
    setRepsString(value);
  };

  const title =
    mode === "draft"
      ? "Следующий подход"
      : mode === "create"
        ? "Новый подход"
        : "Подход";

  const closeWeightSelect = useCallback(() => {
    setOpenedSelect(null);
    setWeightSelectAnchor(null);
  }, []);

  const toggleWeightSelect = useCallback(() => {
    if (openedSelect === "weight") {
      closeWeightSelect();
      return;
    }

    weightSelectAnchorRef.current?.measureInWindow((x, y, width, height) => {
      setWeightSelectAnchor({ x, y, width, height });
      setOpenedSelect("weight");
    });
  }, [closeWeightSelect, openedSelect]);

  const chooseWeightUnit = (next: "kg" | "lbs" | "plates") => {
    setWeightUnit(next);
    closeWeightSelect();
  };

  const parseWeightField = (): number | null => {
    const trimmed = weight.trim();
    if (!trimmed) return null;
    const rawWeight = parseFloat(trimmed.replace(",", "."));
    if (!Number.isFinite(rawWeight)) return null;
    const w =
      weightUnit === "kg" ? rawWeight : weightUnit === "lbs" ? rawWeight * 0.45359237 : rawWeight * 5;
    return Math.round(w * 1000) / 1000;
  };

  const parseRepsField = (): number | null => {
    const trimmed = reps.trim();
    if (!trimmed) return null;
    const r = parseInt(trimmed, 10);
    return Number.isFinite(r) ? r : null;
  };

  const appendCommonSetFields = (body: Record<string, unknown>) => {
    const r = parseRepsField();
    if (r != null) body.reps = r;
    if (commentSet.trim()) body.comment = commentSet.trim();
    body.reached_failure = reachedFailure;
    if (effortLevel) body.effort_level = effortLevel;
  };

  const appendTextFields = (body: Record<string, unknown>) => {
    body.weight_string = weightString.trim() || null;
    body.reps_string = repsString.trim() || null;
  };

  const appendWeightFields = (body: Record<string, unknown>) => {
    body.weight_kg = parseWeightField();
    body.weight_composition =
      compositionTerms.length > 0 ? buildCompositionFromDraft(compositionTerms) : null;
  };

  const buildSetPayload = () => {
    const body: Record<string, unknown> = {
      type: "set",
    };
    appendWeightFields(body);
    appendTextFields(body);
    if (mode === "draft") {
      body.reps = parseRepsField();
      return body;
    }
    appendCommonSetFields(body);
    return body;
  };

  const buildEditMergePayload = (): Record<string, unknown> => {
    if (timeline === "planned") {
      const merge: Record<string, unknown> = {
        type: "set",
        reps: parseRepsField(),
      };
      appendWeightFields(merge);
      appendTextFields(merge);
      return merge;
    }

    const merge: Record<string, unknown> = {
      type: "set",
      reps: parseRepsField(),
      comment: commentSet.trim() || null,
      reached_failure: reachedFailure,
      effort_level: effortLevel,
    };
    appendWeightFields(merge);
    appendTextFields(merge);
    return merge;
  };

  const handleSave = async () => {
    if (mode === "draft") {
      onDraftSave?.(buildSetPayload());
      onClose();
      return;
    }

    setLoading(true);
    setError("");
    try {
      const setBody = buildSetPayload();
      const base =
        timeline === "planned"
          ? `/api/v1/exercises_in_workout/${exerciseId}/planned_set`
          : `/api/v1/exercises_in_workout/${exerciseId}/set`;
      if (mode === "edit" && setIdx != null) {
        const merge = buildEditMergePayload();
        const r = await apiFetch(`${base}/${setIdx}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(merge),
        });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(parseErrorDetail(d));
        emitExerciseUpdatedFromSetApiResponse(exerciseId, d);
      } else {
        const r = await apiFetch(base, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(setBody),
        });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(parseErrorDetail(d));
        emitExerciseUpdatedFromSetApiResponse(exerciseId, d);
      }
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

  const showDelete = mode === "edit" && setIdx != null;
  const saveLabel =
    primaryLabel ?? (mode === "draft" ? "Готово" : mode === "create" ? "Добавить" : "Сохранить");
  const handleDisableAutoEdit = useCallback(() => {
    onDisableAutoEdit?.();
    onClose();
  }, [onClose, onDisableAutoEdit]);
  const disableAutoEditAction = onDisableAutoEdit ? (
    <ScreenTitleRowIconButton
      onPress={handleDisableAutoEdit}
      disabled={loading}
      accessibilityLabel="Не открывать редактор подхода автоматически"
    >
      <Ionicons name="eye-off-outline" size={20} color={theme.text} />
    </ScreenTitleRowIconButton>
  ) : null;

  const weightUnitOverlay =
    openedSelect === "weight" && weightSelectAnchor ? (
      <Modal
        visible
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={closeWeightSelect}
      >
        <View style={styles.dropdownOverlayRoot} pointerEvents="box-none">
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={closeWeightSelect}
            accessibilityLabel="Закрыть выбор единицы веса"
          />
          <View
            style={[
              styles.dropdownOverlayAnchor,
              {
                top: weightSelectAnchor.y + weightSelectAnchor.height + 4,
                left: weightSelectAnchor.x,
                width: weightSelectAnchor.width,
              },
            ]}
          >
            <View style={[styles.dropdownPanel, { borderColor: theme.border, backgroundColor: theme.card }]}>
              {WEIGHT_UNIT_OPTIONS.map((option, index) => (
                <Pressable
                  key={option.id}
                  style={[styles.dropdownItem, index > 0 && styles.dropdownItemDivider]}
                  onPress={() => chooseWeightUnit(option.id)}
                >
                  <Text
                    style={[
                      styles.dropdownText,
                      { color: theme.text },
                      weightUnit === option.id && styles.dropdownTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      </Modal>
    ) : null;

  const formBody = (
    <>
      <SegmentedTabs
        tabs={WEIGHT_INPUT_TABS}
        value={weightInputMode}
        onChange={setWeightInputMode}
        labelSize="sm"
        trackNativeId="set-editor-weight-mode"
        indicatorNativeId="set-editor-weight-mode-indicator"
        style={{ marginBottom: 10 }}
      />

      {weightInputMode === "bodyweight_plus" ? (
        <SetWeightCompositionPanel
          terms={compositionTerms}
          onTermsChange={setCompositionTerms}
          defaultBodyweightKg={bodyweightKg}
          bodyweightLoading={bodyweightLoading}
          preview={{
            cached_effective_kg: compositionPreview.cached_effective_kg,
            cached_display: compositionPreview.cached_display,
          }}
        />
      ) : null}

      {weightInputMode === "text" ? (
        <View style={styles.textTabFields}>
          <Text style={formStyles.labFull}>Вес (текст)</Text>
          <TextInput
            style={formStyles.input}
            value={weightString}
            onChangeText={handleWeightStringChange}
            placeholder="Например: гравитрон −20, собственный вес"
            placeholderTextColor={catalogUi.textPlaceholder}
            autoCapitalize="sentences"
          />

          <Text style={formStyles.labFull}>Повторения (текст)</Text>
          <TextInput
            style={formStyles.input}
            value={repsString}
            onChangeText={handleRepsStringChange}
            placeholder="Например: до отказа, 8-10"
            placeholderTextColor={catalogUi.textPlaceholder}
            autoCapitalize="sentences"
          />
        </View>
      ) : (
      <View style={styles.row2}>
        {weightInputMode === "simple" ? (
        <View style={styles.cell}>
          <Text style={[styles.lab, { color: theme.textMuted }]}>Вес</Text>
          <View ref={weightSelectAnchorRef} collapsable={false} style={styles.selectWrap}>
            <View style={[styles.split, { borderColor: theme.border, backgroundColor: theme.bg }]}>
              <TextInput
                style={[styles.splitInput, { color: theme.text, backgroundColor: theme.bg }]}
                value={weight}
                onChangeText={handleWeightChange}
                keyboardType="decimal-pad"
                onFocus={closeWeightSelect}
              />
              <Pressable
                style={[styles.unitBtn, { borderLeftColor: theme.border, backgroundColor: theme.card }]}
                onPress={toggleWeightSelect}
              >
                <Text style={[styles.unitTxt, { color: theme.textMuted }]}>
                  {weightUnit === "kg" ? "кг" : weightUnit === "lbs" ? "lbs" : "плитки"}
                </Text>
                <Ionicons
                  name={openedSelect === "weight" ? "chevron-up" : "chevron-down"}
                  size={14}
                  color={catalogUi.textMuted}
                />
              </Pressable>
            </View>
          </View>
        </View>
        ) : null}
        <View style={styles.cell}>
          <Text style={[styles.lab, { color: theme.textMuted }]}>Повторения</Text>
          <View style={[styles.split, { borderColor: theme.border, backgroundColor: theme.bg }]}>
            <TextInput
              style={[styles.splitInput, { color: theme.text, backgroundColor: theme.bg }]}
              value={reps}
              onChangeText={setReps}
              keyboardType="number-pad"
              onFocus={closeWeightSelect}
            />
            <View
              style={[styles.unitBtn, { borderLeftColor: theme.border, backgroundColor: theme.card }]}
            >
              <Text style={[styles.unitTxt, { color: theme.textMuted }]}>повт.</Text>
            </View>
          </View>
        </View>
      </View>
      )}

      <View style={styles.fieldsBelow}>
      {mode !== "draft" ? (
        <>
          <SetEffortLevelPicker value={effortLevel} onChange={setEffortLevel} />

          <Pressable
            style={styles.failureRow}
            onPress={() => setReachedFailure((v) => !v)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: reachedFailure }}
            accessibilityLabel="Был отказ"
          >
            <Text style={[styles.failureLabel, { color: theme.textMuted }]}>Был отказ</Text>
            <Ionicons
              name={reachedFailure ? "checkbox" : "square-outline"}
              size={22}
              color={catalogUi.accent}
            />
          </Pressable>

          <Text style={formStyles.labFull}>Комментарий к подходу</Text>
          <TextInput
            style={formStyles.area}
            value={commentSet}
            onChangeText={setCommentSet}
            placeholder="Например: рабочий вес, контролируй технику"
            placeholderTextColor={catalogUi.textPlaceholder}
            multiline
          />
        </>
      ) : null}

      {error ? <Text style={formStyles.err}>{error}</Text> : null}

      <LogEntryEditorFooter
        loading={loading}
        onCancel={onClose}
        onPrimary={handleSave}
        primaryLabel={saveLabel}
        styles={formStyles}
      />
      </View>
    </>
  );

  if (embedded) {
    if (!visible) return null;
    return (
      <>
        {formBody}
        {weightUnitOverlay}
      </>
    );
  }

  if (isCenter) {
    const centerCard = (
      <Pressable style={centerStyles.cardHitbox} onPress={(e) => e.stopPropagation()}>
        <View style={[centerStyles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <LogEntryEditorHeader
            title={title}
            onClose={onClose}
            onDelete={showDelete ? () => setDeleteConfirmVisible(true) : undefined}
            deleteDisabled={loading}
            extraActions={disableAutoEditAction}
          />
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            style={centerStyles.scroll}
            contentContainerStyle={centerStyles.scrollContent}
          >
            {formBody}
          </ScrollView>
        </View>
      </Pressable>
    );

    return (
      <>
        <Modal
          visible={visible}
          transparent
          statusBarTranslucent
          animationType="fade"
          onRequestClose={onClose}
          onDismiss={fireDismiss}
        >
          <View style={centerStyles.shell} pointerEvents="box-none">
            <Pressable
              style={[centerStyles.scrim, { backgroundColor: theme.overlay }]}
              onPress={onClose}
              disabled={loading}
              accessibilityLabel="Закрыть"
            />
            {Platform.OS === "web" ? (
              <View
                pointerEvents="box-none"
                style={[
                  centerStyles.centerStage,
                  {
                    paddingTop: Math.max(insets.top, 12),
                    paddingBottom: Math.max(insets.bottom, 12),
                  },
                ]}
              >
                {centerCard}
              </View>
            ) : (
              <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : undefined}
                pointerEvents="box-none"
                style={[
                  centerStyles.centerStage,
                  {
                    paddingTop: Math.max(insets.top, 12),
                    paddingBottom: Math.max(insets.bottom, 12),
                  },
                ]}
                keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
              >
                {centerCard}
              </KeyboardAvoidingView>
            )}
          </View>
        </Modal>
        <LogEntryDeleteConfirm
          visible={deleteConfirmVisible}
          kind="set"
          onCancel={() => setDeleteConfirmVisible(false)}
          onConfirm={() => {
            setDeleteConfirmVisible(false);
            void handleDelete();
          }}
        />
        {weightUnitOverlay}
      </>
    );
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
              title={title}
              onClose={onClose}
              onDelete={showDelete ? () => setDeleteConfirmVisible(true) : undefined}
              deleteDisabled={loading}
              extraActions={disableAutoEditAction}
            />
          </BottomSheetDragHeader>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {formBody}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
      <LogEntryDeleteConfirm
        visible={deleteConfirmVisible}
        kind="set"
        onCancel={() => setDeleteConfirmVisible(false)}
        onConfirm={() => {
          setDeleteConfirmVisible(false);
          void handleDelete();
        }}
      />
      {weightUnitOverlay}
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
    row2: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 12 },
    cell: { flex: 1, minWidth: 0 },
    fieldsBelow: {
      marginTop: 0,
    },
    textTabFields: {
      marginBottom: 12,
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
      ...(Platform.OS === "web"
        ? {
            borderWidth: 0,
            outlineWidth: 0,
          }
        : {}),
    },
    dropdownOverlayRoot: {
      flex: 1,
    },
    dropdownOverlayAnchor: {
      position: "absolute",
    },
    dropdownPanel: {
      borderWidth: 1,
      borderColor: catalogUi.border,
      borderRadius: 10,
      backgroundColor: catalogUi.cardBg,
      overflow: "hidden",
      shadowColor: "#000",
      shadowOpacity: 0.16,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      ...(Platform.OS === "android" ? { elevation: 8 } : {}),
      ...(Platform.OS === "web" ? ({ boxShadow: "0 4px 16px rgba(0,0,0,0.14)" } as const) : {}),
    },
    dropdownItem: {
      minHeight: 36,
      paddingHorizontal: 10,
      justifyContent: "center",
    },
    dropdownItemDivider: {
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
    failureRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 8,
      marginBottom: 4,
      paddingVertical: 6,
    },
    failureLabel: {
      fontFamily: fonts.semiBold,
      fontSize: 13,
    },
  });

const CENTER_CARD_MAX_W = 420;

const centerStyles = StyleSheet.create({
  shell: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
  },
  centerStage: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 22,
  },
  cardHitbox: {
    width: "100%",
    maxWidth: CENTER_CARD_MAX_W,
    maxHeight: "88%",
  },
  card: {
    width: "100%",
    maxHeight: "100%",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
    borderWidth: 1,
    shadowColor: "#1A1530",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.14,
    shadowRadius: 28,
    elevation: 12,
  },
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingBottom: 4,
  },
});
