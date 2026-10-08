import type { PlannedSessionSource, PlannedSessionStatus } from "@/components/plans/types";

const STATUS_LABELS: Record<PlannedSessionStatus, string> = {
  plan_ready: "План готов",
  draft: "Черновик — добавьте упражнения",
  in_progress: "В процессе",
};

const SOURCE_LABELS: Record<PlannedSessionSource, string> = {
  repeat_previous: "повтор: прошлый раз",
  from_template: "из шаблона",
};

export function formatPlannedSessionStatus(status: PlannedSessionStatus): string {
  return STATUS_LABELS[status];
}

export function formatPlannedSessionSource(source: PlannedSessionSource): string {
  return SOURCE_LABELS[source];
}

export function isPlannedSessionReady(status: PlannedSessionStatus): boolean {
  return status === "plan_ready" || status === "in_progress";
}
