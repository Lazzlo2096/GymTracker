export const SET_EFFORT_LEVELS = ["легко", "отлично", "на грани", "тяжело"] as const;

export type SetEffortLevel = (typeof SET_EFFORT_LEVELS)[number];

export function parseSetEffortLevel(value: unknown): SetEffortLevel | null {
  if (typeof value !== "string") return null;
  if (SET_EFFORT_LEVELS.includes(value as SetEffortLevel)) return value as SetEffortLevel;
  return null;
}
