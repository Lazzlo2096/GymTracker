import { apiFetch, parseErrorDetail } from "@/api/client";
import { markTemplatesListStale } from "@/events/templateDetailEvents";

/** Заголовок по умолчанию при создании шаблона с FAB «+». */
export const NEW_TEMPLATE_DEFAULT_TITLE = "Новый шаблон";

/** Создаёт пустой шаблон с названием «Новый шаблон». */
export async function createQuickWorkoutTemplate(options?: {
  /** false — не эмитить templates:list-stale (например перед уходом на деталь). */
  markListStale?: boolean;
}): Promise<string> {
  const response = await apiFetch("/api/v1/workout_templates/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: NEW_TEMPLATE_DEFAULT_TITLE,
      description: null,
      note: null,
      user_gym_id: null,
      estimated_minutes: null,
      exercises: [],
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(parseErrorDetail(payload));
  }
  const id = Number((payload as { id?: unknown }).id);
  if (!Number.isFinite(id) || id <= 0) {
    throw new Error("Сервер не вернул id шаблона");
  }
  if (options?.markListStale !== false) {
    markTemplatesListStale();
  }
  return String(Math.trunc(id));
}
