export type MachineSettingsValue = Record<string, unknown> | string | null | undefined;

/** Текст для отображения и редактирования (строки «ключ: значение»). */
export function formatMachineSettings(value: MachineSettingsValue): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "object") {
    const entries = Object.entries(value);
    if (!entries.length) return "";
    // Свободный текст без «ключ: значение» хранится как { note: "..." } — не показываем префикс.
    if (entries.length === 1 && entries[0][0] === "note" && typeof entries[0][1] === "string") {
      return entries[0][1];
    }
    return entries
      .map(([key, v]) => {
        if (v != null && typeof v === "object") return `${key}: ${JSON.stringify(v)}`;
        return `${key}: ${String(v)}`;
      })
      .join("\n");
  }
  return String(value);
}

function parseScalar(raw: string): unknown {
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (raw === "null") return null;
  if (/^-?\d+(\.\d+)?$/.test(raw)) return Number(raw);
  if (
    (raw.startsWith("{") && raw.endsWith("}")) ||
    (raw.startsWith("[") && raw.endsWith("]"))
  ) {
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      return raw;
    }
  }
  if (
    (raw.startsWith('"') && raw.endsWith('"')) ||
    (raw.startsWith("'") && raw.endsWith("'"))
  ) {
    return raw.slice(1, -1);
  }
  return raw;
}

/**
 * Разбор текста в объект для PATCH `machine_settings`.
 * Пустая строка → null. Поддерживаются JSON-объект и строки «ключ: значение».
 */
export function parseMachineSettingsText(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("{")) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      throw new Error("Некорректный JSON");
    }
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error('Нужен объект JSON, например {"seat_height": 3}');
    }
    return parsed as Record<string, unknown>;
  }

  if (!trimmed.includes(":")) {
    return { note: trimmed };
  }

  const result: Record<string, unknown> = {};
  for (const line of trimmed.split("\n")) {
    const lineTrim = line.trim();
    if (!lineTrim) continue;
    const colonIdx = lineTrim.indexOf(":");
    if (colonIdx < 0) {
      throw new Error(`Строка «${lineTrim}»: используйте формат «ключ: значение»`);
    }
    const key = lineTrim.slice(0, colonIdx).trim();
    if (!key) continue;
    const rawVal = lineTrim.slice(colonIdx + 1).trim();
    result[key] = parseScalar(rawVal);
  }

  return Object.keys(result).length ? result : null;
}
