/**
 * @see ./modalDismissContract.ts — draft сбрасывать в onDismiss, не с первым visible=false.
 */
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
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
import {
  MODAL_FADE_MS,
} from "@/components/modals/modalDismissContract";
import { parseExerciseSetsJsonInput, patchExerciseSetsJson } from "@/api/exerciseInWorkout";
import { markWorkoutsListStale } from "@/events/workoutsListEvents";
import { useAppTheme } from "@/theme/appTheme";
import { fonts } from "@/theme/typography";
import { emitExerciseUpdated } from "@/utils/exerciseUpdatedEvent";
import { pressableStyle } from "@/utils/pressableStyles";

type Props = {
  visible: boolean;
  exerciseId: number;
  initialText: string;
  onClose: () => void;
  onDismiss?: () => void;
  onApplied?: () => void;
};

export default function PasteExerciseSetsJsonModal({
  visible,
  exerciseId,
  initialText,
  onClose,
  onDismiss,
  onApplied,
}: Props) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState(initialText);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const dismissOnceRef = useRef(false);

  useEffect(() => {
    if (visible) {
      dismissOnceRef.current = false;
      setDraft(initialText);
      setError(null);
      setSaving(false);
    }
  }, [visible, initialText]);

  const fireDismiss = () => {
    if (!onDismiss || dismissOnceRef.current) return;
    dismissOnceRef.current = true;
    setDraft("[]");
    setError(null);
    setSaving(false);
    onDismiss();
  };

  useEffect(() => {
    if (visible) return;
    if (!onDismiss) return;
    const t = setTimeout(() => {
      fireDismiss();
    }, MODAL_FADE_MS);
    return () => clearTimeout(t);
  }, [visible, onDismiss]);

  const handleApply = () => {
    if (saving || !Number.isFinite(exerciseId) || exerciseId <= 0) return;

    void (async () => {
      setSaving(true);
      setError(null);
      try {
        const setsJson = parseExerciseSetsJsonInput(draft);
        await patchExerciseSetsJson(exerciseId, setsJson);
        emitExerciseUpdated({ exerciseId, log: setsJson });
        markWorkoutsListStale();
        onApplied?.();
        onClose();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Не удалось применить JSON.");
      } finally {
        setSaving(false);
      }
    })();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={saving ? undefined : onClose}
      onDismiss={Platform.OS === "ios" ? fireDismiss : undefined}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable
          style={[styles.backdrop, { backgroundColor: theme.overlay }]}
          onPress={saving ? undefined : onClose}
        />
        <Pressable
          style={[
            styles.card,
            {
              backgroundColor: theme.card,
              marginTop: Math.max(insets.top, 16),
              marginBottom: Math.max(insets.bottom, 16),
            },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <Text style={[styles.title, { color: theme.text }]}>Вставить подходы из JSON</Text>
          <Text style={[styles.hint, { color: theme.textMuted }]}>
            Массив записей sets_json: set, rest, mark, comment. Объект с полем sets_json тоже
            подойдёт.
          </Text>

          <ScrollView
            style={styles.scroll}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scrollContent}
          >
            <TextInput
              style={[
                styles.input,
                {
                  borderColor: theme.border,
                  color: theme.text,
                  backgroundColor: theme.bg,
                },
              ]}
              value={draft}
              onChangeText={(text) => {
                setDraft(text);
                if (error) setError(null);
              }}
              placeholder='[{"type":"set","weight_kg":50,"reps":8}]'
              placeholderTextColor={theme.textPlaceholder}
              multiline
              autoCorrect={false}
              autoCapitalize="none"
              spellCheck={false}
              textAlignVertical="top"
            />
            {error ? <Text style={[styles.error, { color: theme.danger }]}>{error}</Text> : null}
          </ScrollView>

          <View style={styles.footer}>
            <Pressable
              style={pressableStyle(
                [styles.btn, styles.btnGhost, { borderColor: theme.border }],
                { disabled: saving },
              )}
              onPress={onClose}
              disabled={saving}
            >
              <Text style={[styles.btnGhostText, { color: theme.textMuted }]}>Отмена</Text>
            </Pressable>
            <Pressable
              style={pressableStyle(
                [styles.btn, styles.btnPrimary, { backgroundColor: theme.accent }],
                { disabled: saving },
              )}
              onPress={handleApply}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.btnPrimaryText}>Применить</Text>
              )}
            </Pressable>
          </View>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  card: {
    flex: 1,
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },
  title: {
    fontFamily: fonts.extraBold,
    fontSize: 18,
    lineHeight: 24,
    letterSpacing: -0.3,
  },
  hint: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
  },
  scroll: {
    flex: 1,
    minHeight: 0,
  },
  scrollContent: {
    flexGrow: 1,
  },
  input: {
    flex: 1,
    minHeight: 220,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }),
    fontSize: 13,
    lineHeight: 18,
  },
  error: {
    marginTop: 8,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
  },
  footer: {
    flexDirection: "row",
    gap: 10,
  },
  btn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  btnGhost: {
    borderWidth: 1,
  },
  btnGhostText: {
    fontFamily: fonts.semiBold,
    fontSize: 15,
  },
  btnPrimary: {},
  btnPrimaryText: {
    fontFamily: fonts.semiBold,
    fontSize: 15,
    color: "#fff",
  },
});
