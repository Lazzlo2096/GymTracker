/** @see ./modalDismissContract.ts */
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useState } from "react";
import {
  Animated,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import SegmentedTabs, { type SegmentedTabItem } from "@/components/ui/SegmentedTabs";
import { BottomSheetDragHeader, useBottomSheet } from "@/components/ui/bottomSheet";
import CommentEditorModal from "@/components/modals/CommentEditorModal";
import MarkEditorModal from "@/components/modals/MarkEditorModal";
import RestEditorModal from "@/components/modals/RestEditorModal";
import SetEditorModal from "@/components/modals/SetEditorModal";
import { fonts } from "@/theme/typography";
import { useAppTheme } from "@/theme/appTheme";

export type TimelineEntryKind = "set" | "rest" | "mark" | "comment";

type Props = {
  visible: boolean;
  onClose: () => void;
  exerciseId: number;
  initialKind?: TimelineEntryKind;
  showSetTextFields?: boolean;
};

const ENTRY_TABS: readonly SegmentedTabItem<TimelineEntryKind>[] = [
  { id: "set", label: "Подход", icon: "dumbbell", nativeId: "timeline-create-tab-set" },
  { id: "rest", label: "Отдых", icon: "timer-sand", nativeId: "timeline-create-tab-rest" },
  { id: "mark", label: "Метка", icon: "flag", nativeId: "timeline-create-tab-mark" },
  { id: "comment", label: "Коммент.", icon: "comment-text", nativeId: "timeline-create-tab-comment" },
];

const EMBEDDED_EDITOR_PROPS = {
  embedded: true as const,
  mode: "create" as const,
  setIdx: null,
  initial: null,
};

/**
 * Создание записи в журнале упражнения: подход, отдых, метка или комментарий.
 * Формы — через канонические редакторы (Set/Rest/Mark/CommentEditorModal).
 */
export default function TimelineEntryCreateModal({
  visible,
  onClose,
  exerciseId,
  initialKind = "set",
  showSetTextFields = true,
}: Props) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(), []);
  const insets = useSafeAreaInsets();

  const [kind, setKind] = useState<TimelineEntryKind>(initialKind);
  const [loading, setLoading] = useState(false);

  const { mounted, sheetTranslateY, backdropOpacity, panHandlers, requestClose } = useBottomSheet(
    visible,
    onClose,
    { dismissEnabled: !loading },
  );

  useEffect(() => {
    if (!visible) return;
    setKind(initialKind);
    setLoading(false);
  }, [visible, initialKind]);

  if (!mounted) return null;

  /** Контент вкладки держим до конца slide-down — см. modalDismissContract.ts */
  const tabContentVisible = (tab: TimelineEntryKind) => (visible || mounted) && kind === tab;
  const sheetClosing = !visible && mounted;

  return (
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
            <View style={styles.head}>
              <Text style={[styles.title, { color: theme.text }]}>Новая запись</Text>
              <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
                <Ionicons name="close" size={24} color={theme.text} />
              </Pressable>
            </View>
          </BottomSheetDragHeader>

          <SegmentedTabs
            tabs={ENTRY_TABS}
            value={kind}
            onChange={visible ? setKind : () => {}}
            labelSize="sm"
            trackNativeId="timeline-create-tabs"
            indicatorNativeId="timeline-create-tab-indicator"
            style={styles.tabs}
          />

          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            pointerEvents={sheetClosing ? "none" : "auto"}
            style={Platform.OS === "web" ? styles.scrollWeb : undefined}
            contentContainerStyle={Platform.OS === "web" ? styles.scrollContentWeb : undefined}
          >
            <SetEditorModal
              {...EMBEDDED_EDITOR_PROPS}
              visible={tabContentVisible("set")}
              exerciseId={exerciseId}
              onClose={onClose}
              onLoadingChange={setLoading}
              showSetTextFields={showSetTextFields}
            />
            <RestEditorModal
              {...EMBEDDED_EDITOR_PROPS}
              visible={tabContentVisible("rest")}
              exerciseId={exerciseId}
              onClose={onClose}
              onLoadingChange={setLoading}
            />
            <MarkEditorModal
              {...EMBEDDED_EDITOR_PROPS}
              visible={tabContentVisible("mark")}
              exerciseId={exerciseId}
              onClose={onClose}
              onLoadingChange={setLoading}
            />
            <CommentEditorModal
              {...EMBEDDED_EDITOR_PROPS}
              visible={tabContentVisible("comment")}
              exerciseId={exerciseId}
              onClose={onClose}
              onLoadingChange={setLoading}
            />
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const createStyles = () =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      justifyContent: "flex-end",
    },
    sheet: {
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: "92%",
      paddingHorizontal: 16,
      paddingTop: 8,
    },
    head: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 12,
    },
    title: { fontFamily: fonts.extraBold, fontSize: 18, flex: 1 },
    closeBtn: { padding: 4 },
    tabs: { marginBottom: 12 },
    scrollWeb: { overflow: "visible", zIndex: 1 },
    scrollContentWeb: { overflow: "visible" },
  });
