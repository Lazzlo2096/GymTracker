/** @see @/components/modals/modalDismissContract.ts */
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { catalogUi } from "@/theme/catalogUi";
import { fonts } from "@/theme/typography";
import { useAppTheme } from "@/theme/appTheme";

type Props = {
  visible: boolean;
  title: string;
  initial: string;
  placeholder?: string;
  keyboardType?: "default" | "numeric" | "decimal-pad";
  multiline?: boolean;
  onClose: () => void;
  onSave: (value: string) => Promise<void>;
};

export default function TextFieldModal({
  visible,
  title,
  initial,
  placeholder,
  keyboardType = "default",
  multiline = false,
  onClose,
  onSave,
}: Props) {
  const theme = useAppTheme();
  const [val, setVal] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (visible) {
      setVal(initial);
      setErr("");
    }
  }, [visible, initial]);

  const submit = async () => {
    setLoading(true);
    setErr("");
    try {
      await onSave(val.trim());
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={[styles.backdrop, { backgroundColor: theme.overlay }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
          <TextInput
            style={[styles.input, { borderColor: theme.border, color: theme.text }, multiline && styles.inputMulti]}
            value={val}
            onChangeText={setVal}
            placeholder={placeholder}
            placeholderTextColor={theme.textPlaceholder}
            keyboardType={keyboardType}
            multiline={multiline}
            autoFocus
          />
          {err ? <Text style={styles.err}>{err}</Text> : null}
          <View style={styles.row}>
            <Pressable onPress={onClose} style={styles.btnGhost}>
              <Text style={[styles.btnGhostText, { color: theme.textMuted }]}>Отмена</Text>
            </Pressable>
            <Pressable style={[styles.btn, { backgroundColor: theme.accent }]} onPress={() => void submit()} disabled={loading}>
              {loading ? <ActivityIndicator color={theme.white} /> : <Text style={styles.btnText}>Сохранить</Text>}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: "rgba(0,0,0,0.45)" },
  card: {
    backgroundColor: catalogUi.cardBg,
    borderRadius: 16,
    padding: 20,
  },
  title: { fontFamily: fonts.extraBold, fontSize: 18, color: catalogUi.text, marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderColor: catalogUi.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: fonts.regular,
    fontSize: 16,
    color: catalogUi.text,
  },
  inputMulti: { minHeight: 100, textAlignVertical: "top" },
  err: { color: "#dc2626", marginTop: 8, fontFamily: fonts.regular },
  row: { flexDirection: "row", justifyContent: "flex-end", gap: 12, marginTop: 16 },
  btn: {
    backgroundColor: catalogUi.accent,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    minWidth: 120,
    alignItems: "center",
  },
  btnText: { fontFamily: fonts.bold, color: catalogUi.cardBg, fontSize: 16 },
  btnGhost: { paddingVertical: 12, justifyContent: "center" },
  btnGhostText: { fontFamily: fonts.semiBold, color: catalogUi.textMuted, fontSize: 16 },
});
