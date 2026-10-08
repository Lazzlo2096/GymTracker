/** Промокод с ссылки register?promo= — между login/register и OAuth. */

const KEY = "gt_register_promo";

export function saveRegisterPromo(code: string): void {
  const v = code.trim();
  if (!v) return;
  try {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem(KEY, v);
    }
  } catch {
    /* ignore */
  }
}

export function peekRegisterPromo(): string | null {
  try {
    if (typeof sessionStorage !== "undefined") {
      return sessionStorage.getItem(KEY);
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function clearRegisterPromo(): void {
  try {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.removeItem(KEY);
    }
  } catch {
    /* ignore */
  }
}

export function buildReferralShareMessage(code: string, registerUrl: string): string {
  return [
    "Присоединяйся к GymTracker — трекер тренировок!",
    "",
    `Регистрация: ${registerUrl}`,
    `Промокод: ${code}`,
  ].join("\n");
}
