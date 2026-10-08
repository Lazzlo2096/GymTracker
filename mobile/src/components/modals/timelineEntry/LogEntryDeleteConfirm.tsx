import React from "react";
import WorkoutDeleteConfirmModal from "@/components/modals/WorkoutDeleteConfirmModal";
import {
  getLogEntryDeleteConfirmCopy,
  type LogEntryDeleteKind,
} from "@/components/modals/timelineEntry/logEntryDeleteConfirmCopy";

type Props = {
  visible: boolean;
  kind: LogEntryDeleteKind;
  markType?: "start" | "end";
  onCancel: () => void;
  onConfirm: () => void;
};

/** Подтверждение удаления записи журнала упражнения (подход, отдых, метка, комментарий). */
export default function LogEntryDeleteConfirm({
  visible,
  kind,
  markType,
  onCancel,
  onConfirm,
}: Props) {
  const copy = getLogEntryDeleteConfirmCopy(kind, markType);

  return (
    <WorkoutDeleteConfirmModal
      visible={visible}
      title={copy.title}
      message={copy.message}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}
