import React from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import type { TimelineEntryFormStyles } from "./timelineEntryFormStyles";

type Props = {
  loading: boolean;
  onCancel: () => void;
  onPrimary: () => void;
  primaryLabel: string;
  styles: TimelineEntryFormStyles;
};

export default function LogEntryEditorFooter({
  loading,
  onCancel,
  onPrimary,
  primaryLabel,
  styles,
}: Props) {
  return (
    <View style={styles.footer}>
      <Pressable style={styles.btnGhost} onPress={onCancel} disabled={loading}>
        <Text style={styles.btnGhostText}>Отмена</Text>
      </Pressable>
      <Pressable style={styles.btnPrimary} onPress={() => void onPrimary()} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.btnPrimaryText}>{primaryLabel}</Text>
        )}
      </Pressable>
    </View>
  );
}
