/** Горизонтальные метрики: ~2 карточки на экран + край следующей (~40% ширины). */

export const METRIC_SNAP_GAP = 8;
export const METRIC_SNAP_ITEM_RATIO = 0.4;
export const METRIC_SNAP_MIN_WIDTH = 96;

export function workoutScreenHorizontalPadding(screenWidth: number): number {
  return screenWidth >= 400 ? 20 : 16;
}

export function metricSnapItemWidth(availableWidth: number): number {
  return Math.max(
    METRIC_SNAP_MIN_WIDTH,
    Math.floor(availableWidth * METRIC_SNAP_ITEM_RATIO),
  );
}
