/** Тип/характер упражнения в каталоге (TGL-36), slug как в API. */

export type ExerciseTypeId =
  | "cardio"
  | "strength"
  | "stretching"
  | "mobility"
  | "yoga"
  | "other";

export const EXERCISE_TYPE_OPTIONS: { id: ExerciseTypeId; label: string }[] = [
  { id: "cardio", label: "Кардио" },
  { id: "strength", label: "Силовая" },
  { id: "stretching", label: "Растяжка" },
  { id: "mobility", label: "Мобилити" },
  { id: "yoga", label: "Йога" },
  { id: "other", label: "Другое" },
];

const LABEL_BY_ID = Object.fromEntries(
  EXERCISE_TYPE_OPTIONS.map((o) => [o.id, o.label]),
) as Record<ExerciseTypeId, string>;

export function exerciseTypeLabel(id: string | null | undefined): string | null {
  if (!id) return null;
  return LABEL_BY_ID[id as ExerciseTypeId] ?? null;
}

export function isExerciseTypeId(id: string): id is ExerciseTypeId {
  return id in LABEL_BY_ID;
}
