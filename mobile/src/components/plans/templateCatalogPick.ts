/** Событие выбора упражнений из каталога для строки шаблона тренировки. */
export const TEMPLATE_CATALOG_PICK_EVENT = "template:exercise-catalog-picked";

export type TemplateCatalogExercisePick = {
  catalogId: number;
  name: string;
  muscle_group: string | null;
};

export type TemplateCatalogPickPayload = {
  slotId: string;
  /** Пустой массив — сбросить привязку к каталогу в слоте. */
  exercises: TemplateCatalogExercisePick[];
};
