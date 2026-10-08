import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { BarbellOutlineIcon } from "@/components/icons/WorkoutFigmaIcons";
import { metricToken } from "@/theme/metricTokens";

const BARBELL_GLYPH_KEYS = new Set(["barbell", "dumbbell", "bench", "shoulder", "abs"]);

/**
 * Соответствие ключей иконок каталога (как на вебе) → MaterialCommunityIcons (заливка).
 * Штанга (barbell) — SVG из Figma (io:barbell-outline).
 */
const GLYPH_MAP: Record<string, keyof typeof MaterialCommunityIcons.glyphMap> = {
  biceps: "arm-flex",
  pulldown: "arrow-down-bold-circle",
  squat: "run-fast",
  deadlift: "weight-lifter",
  kettlebell: "kettlebell",
  cable: "vector-polyline",
  cardio: "heart",
};

type MciProps = ComponentProps<typeof MaterialCommunityIcons>;

type Props = { name?: string; dark?: boolean } & Pick<MciProps, "size" | "color">;

/**
 * Иконка упражнения в списках (вместо inline-SVG с веба).
 */
export function ExerciseGlyph({ name, size = 28, color, dark = false }: Props) {
  const key = name && (GLYPH_MAP[name] || BARBELL_GLYPH_KEYS.has(name)) ? name : "barbell";
  const c = color ?? metricToken("blue", dark).fg;
  if (BARBELL_GLYPH_KEYS.has(key)) {
    return <BarbellOutlineIcon size={size} color={c} />;
  }
  const icon = GLYPH_MAP[key] ?? "kettlebell";
  return <MaterialCommunityIcons name={icon} size={size} color={c} />;
}

/** Совместимое имя с предыдущей версией модуля. */
export const ExerciseIcon = ExerciseGlyph;
