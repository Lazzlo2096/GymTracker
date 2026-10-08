/**
 * Формат `М:SS` для таймера (как `formatTime` на вебе).
 * Поддерживает отрицательные значения (перерасход отдыха).
 */
export function formatTime(sec: number): string {
  let sign = "";
  if (sec < 0) {
    sign = "-";
    sec = Math.abs(sec);
  }
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${sign}${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

/** Длительность в секундах → `мм:сс` для отображения в логе подходов. */
export function fmtDuration(sec: number): string {
  if (typeof sec !== "number" || isNaN(sec)) return String(sec);
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
