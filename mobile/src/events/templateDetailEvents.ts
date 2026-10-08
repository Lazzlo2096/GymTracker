import type { WorkoutTemplateDetailMock } from "@/components/plans/types";
import { emit } from "@/utils/eventBus";

export const TEMPLATES_LIST_STALE_EVENT = "templates:list-stale";

export function markTemplatesListStale(): void {
  emit(TEMPLATES_LIST_STALE_EVENT);
}

export const TEMPLATE_DETAIL_UPDATED_EVENT = "template:detail-updated";

export type TemplateDetailUpdatedPayload = {
  templateId: string;
  detail: WorkoutTemplateDetailMock;
};

export function emitTemplateDetailUpdated(
  templateId: string,
  detail: WorkoutTemplateDetailMock,
): void {
  emit(TEMPLATE_DETAIL_UPDATED_EVENT, {
    templateId: String(templateId),
    detail,
  } satisfies TemplateDetailUpdatedPayload);
}

export function parseTemplateDetailUpdatedPayload(
  payload: unknown,
): TemplateDetailUpdatedPayload | null {
  if (!payload || typeof payload !== "object") return null;
  const row = payload as TemplateDetailUpdatedPayload;
  if (typeof row.templateId !== "string" || !row.templateId.trim()) return null;
  if (!row.detail || typeof row.detail !== "object") return null;
  return { templateId: row.templateId.trim(), detail: row.detail };
}
