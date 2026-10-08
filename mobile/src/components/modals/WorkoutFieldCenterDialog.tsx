import React from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fonts } from "@/theme/typography";
import { useAppTheme } from "@/theme/appTheme";
import { MODAL_FADE_MS } from "@/components/modals/modalDismissContract";

/**
 * @see ./modalDismissContract.ts — контракт fade: `field`/`draft` сбрасывать в `onDismiss`, не с `visible=false`.
 */

/** Какое поле тренировки редактируется (только для этого диалога). */
export type WorkoutFieldCenterDialogField = "day_title" | "note";

export type WorkoutFieldCenterDialogProps = {
  visible: boolean;
  field: WorkoutFieldCenterDialogField;
  draft: string;
  onChangeDraft: (text: string) => void;
  saving: boolean;
  onCancel: () => void;
  onSave: () => void;
  /**
   * Вызов после завершения fade-out при `visible → false`. Родитель должен сбрасывать
   * состояние редактора (поле, черновик) **здесь**, а не синхронно с первым закрытием —
   * иначе возможен кадр с «чужим» заголовком/пустым полем. См. блок «Использование» вверху файла.
   */
  onDismiss?: () => void;
};

function fieldCopy(field: WorkoutFieldCenterDialogField): {
  title: string;
  placeholder: string;
  multiline: boolean;
} {
  switch (field) {
    case "day_title":
      return { title: "Название дня", placeholder: "Например: День ног", multiline: false };
    case "note":
      return { title: "Заметка", placeholder: "Комментарий к тренировке", multiline: true };
  }
}

/** Центрированная модалка одного текстового поля; не bottom sheet. */
const FADE_MS = MODAL_FADE_MS;

export default function WorkoutFieldCenterDialog({
  visible,
  field,
  draft,
  onChangeDraft,
  saving,
  onCancel,
  onSave,
  onDismiss,
}: WorkoutFieldCenterDialogProps) {
  const insets = useSafeAreaInsets();
  const theme = useAppTheme();
  const cfg = fieldCopy(field);
  const dismissOnceRef = React.useRef(false);
  const wasDialogVisibleRef = React.useRef(false);
  const inputRef = React.useRef<TextInput>(null);
  /** Кратковременно управляем selection: setNativeProps на ref у TextInput нет в RN Web / части ref-типов. */
  const [caretSelection, setCaretSelection] = React.useState<
    { start: number; end: number } | undefined
  >(undefined);

  /**
   * multiline + autoFocus часто ставит каретку в начало. Без setTimeout: до отрисовки (layout) + microtask,
   * чтобы отпустить controlled selection и не ломать перемещение каретки.
   */
  React.useLayoutEffect(() => {
    if (!visible) {
      wasDialogVisibleRef.current = false;
      setCaretSelection(undefined);
      return;
    }
    const justOpened = !wasDialogVisibleRef.current;
    wasDialogVisibleRef.current = true;
    if (!justOpened) return;

    const len = draft.length;
    setCaretSelection({ start: len, end: len });
    queueMicrotask(() => {
      setCaretSelection(undefined);
    });
  }, [visible, cfg.multiline, draft, field]);

  const fireDismiss = React.useCallback(() => {
    if (!onDismiss || dismissOnceRef.current) return;
    dismissOnceRef.current = true;
    onDismiss();
  }, [onDismiss]);

  React.useEffect(() => {
    if (visible) {
      dismissOnceRef.current = false;
      return;
    }
    if (!onDismiss) return;
    const t = setTimeout(() => {
      fireDismiss();
    }, FADE_MS);
    return () => clearTimeout(t);
  }, [visible, onDismiss, fireDismiss]);

  const showClear = field === "day_title" && draft.length > 0 && !saving;

  const handleClear = React.useCallback(() => {
    onChangeDraft("");
    setCaretSelection({ start: 0, end: 0 });
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      queueMicrotask(() => {
        setCaretSelection(undefined);
      });
    });
  }, [onChangeDraft]);

  const dialogCard = (
    <Pressable
      style={styles.cardHitbox}
      onPress={(e) => e.stopPropagation()}
      accessibilityViewIsModal
    >
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Text style={[styles.cardTitle, { color: theme.text }]}>{cfg.title}</Text>

        <View style={styles.inputWrap}>
          <TextInput
            ref={inputRef}
            value={draft}
            onChangeText={onChangeDraft}
            placeholder={cfg.placeholder}
            placeholderTextColor={theme.textPlaceholder}
            editable={!saving}
            multiline={cfg.multiline}
            textAlignVertical={cfg.multiline ? "top" : "center"}
            style={[
              styles.input,
              { borderColor: theme.border, color: theme.text },
              cfg.multiline && styles.inputMultiline,
              showClear && styles.inputWithClear,
            ]}
            selection={caretSelection}
            autoFocus
          />
          {showClear ? (
            <Pressable
              style={styles.inputClearBtn}
              onPress={handleClear}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Очистить поле"
            >
              <Ionicons name="close-circle" size={20} color={theme.textMuted} />
            </Pressable>
          ) : null}
        </View>

        <View style={styles.actions}>
          <Pressable
            onPress={onCancel}
            disabled={saving}
            style={({ pressed }) => [styles.btnGhost, pressed && styles.pressed]}
          >
            <Text style={[styles.btnGhostLabel, { color: theme.textMuted }]}>Отмена</Text>
          </Pressable>
          <Pressable
            onPress={onSave}
            disabled={saving}
            style={({ pressed }) => [styles.btnPrimary, { backgroundColor: theme.accent }, pressed && styles.pressed]}
          >
            {saving ? (
              <ActivityIndicator color={theme.white} size="small" />
            ) : (
              <Text style={styles.btnPrimaryLabel}>Сохранить</Text>
            )}
          </Pressable>
        </View>
      </View>
    </Pressable>
  );

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      animationType="fade"
      onRequestClose={onCancel}
      onDismiss={fireDismiss}
    >
      <View style={styles.shell} pointerEvents="box-none">
        <Pressable
          style={[styles.scrim, { backgroundColor: theme.overlay }]}
          onPress={onCancel}
          disabled={saving}
          accessibilityLabel="Закрыть"
        />

        {Platform.OS === "web" ? (
          <View
            pointerEvents="box-none"
            style={[
              styles.centerStage,
              {
                paddingTop: Math.max(insets.top, 12),
                paddingBottom: Math.max(insets.bottom, 12),
              },
            ]}
          >
            {dialogCard}
          </View>
        ) : (
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            pointerEvents="box-none"
            style={[
              styles.centerStage,
              {
                paddingTop: Math.max(insets.top, 12),
                paddingBottom: Math.max(insets.bottom, 12),
              },
            ]}
            keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
          >
          {dialogCard}
          </KeyboardAvoidingView>
        )}
      </View>
    </Modal>
  );
}

const CARD_MAX_W = 400;

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    width: "100%",
    height: "100%",
  },

  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(17, 16, 36, 0.48)",
  },

  centerStage: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 22,
  },

  cardHitbox: {
    width: "100%",
    maxWidth: CARD_MAX_W,
  },

  card: {
    width: "100%",
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E8E5EF",
    shadowColor: "#1A1530",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.14,
    shadowRadius: 28,
    elevation: 12,
  },

  cardTitle: {
    fontSize: 19,
    lineHeight: 24,
    fontFamily: fonts.extraBold,
    color: "#10123A",
    marginBottom: 14,
    letterSpacing: -0.35,
  },

  inputWrap: {
    position: "relative",
    marginBottom: 18,
  },

  input: {
    borderWidth: 1,
    borderColor: "#E4E0EE",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 17,
    lineHeight: 24,
    fontFamily: fonts.semiBold,
    color: "#22254F",
  },

  inputWithClear: {
    paddingRight: 40,
  },

  inputClearBtn: {
    position: "absolute",
    right: 10,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    width: 28,
  },

  inputMultiline: {
    minHeight: 120,
    maxHeight: 200,
  },

  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 10,
  },

  btnGhost: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
  },

  btnGhostLabel: {
    fontSize: 16,
    lineHeight: 22,
    fontFamily: fonts.semiBold,
    color: "#6F6B8C",
  },

  btnPrimary: {
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 12,
    minWidth: 128,
    alignItems: "center",
    justifyContent: "center",
  },

  btnPrimaryLabel: {
    fontSize: 16,
    lineHeight: 22,
    fontFamily: fonts.bold,
    color: "#FFFFFF",
  },

  pressed: {
    opacity: 0.82,
  },
});
