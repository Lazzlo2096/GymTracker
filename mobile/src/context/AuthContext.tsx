import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getApiBaseUrl } from "@/config/env";
import { apiFetch, AUTH_SESSION_INVALID_EVENT } from "@/api/client";
import { ensureBackendReachable } from "@/api/health";
import {
  authErrorMessage,
  fetchFailureMessage,
  isNetworkError,
  missingAuthTokensMessage,
  registerErrorMessage,
} from "@/api/errors";
import { oauthSignIn, type OAuthProviderId } from "@/auth/oauthSignIn";
import { clearTokens, getAccessToken, getRefreshToken, setTokens } from "@/auth/tokenStorage";
import { trace, traceSpanEnd, traceSpanStart } from "@/debug/traceLog";
import { on } from "@/utils/eventBus";

/** Пользователь из `GET /api/v1/auth/me`. */
export type UserMe = {
  id: number;
  email: string;
  display_name: string;
  role?: string;
  created_at?: string;
  experience_label?: string;
  avatar_url?: string | null;
  height_cm?: number | null;
  /** ISO `YYYY-MM-DD` с бэкенда (`UserMe.birth_date`). */
  birth_date?: string | null;
  training_goal?: string | null;
  measurement_units?: string;
  settings_notifications?: boolean;
  settings_dark_theme?: boolean;
  settings_workout_reminders?: boolean;
  workout_reminder_time?: string | null;
  workout_reminder_weekdays?: string;
  workout_reminder_timezone?: string;
  preferred_user_gym_id?: number | null;
  preferred_gym?: { id: number; name: string; address?: string | null } | null;
  target_weight_kg?: number | null;
  is_premium?: boolean;
  premium_until?: string | null;
  premium_lifetime?: boolean;
  email_verified_at?: string | null;
  is_email_verified?: boolean;
};

type AuthCtx = {
  ready: boolean;
  isAuthenticated: boolean;
  user: UserMe | null;
  login: (loginValue: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string, promoCode?: string) => Promise<void>;
  signInWithOAuth: (provider: OAuthProviderId) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  /** Обновить пользователя в памяти без лишнего запроса (например после загрузки аватара). */
  applyUser: (user: UserMe) => void;
  /** Показать модалку верификации после регистрации по email. */
  showEmailVerificationAfterRegister: boolean;
  dismissEmailVerificationAfterRegister: () => void;
};

const Ctx = createContext<AuthCtx | null>(null);

async function fetchMe(): Promise<UserMe> {
  const r = await apiFetch("/api/v1/auth/me");
  if (!r.ok) throw new Error("Not authenticated");
  return (await r.json()) as UserMe;
}

/**
 * Провайдер авторизации: при старте читает токены и пытается загрузить профиль.
 * Логин/регистрация сохраняют пару JWT из JSON (мобильный сценарий); выход чистит SecureStore.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<UserMe | null>(null);
  const [showEmailVerificationAfterRegister, setShowEmailVerificationAfterRegister] =
    useState(false);

  const refreshUser = useCallback(async () => {
    const spanId = traceSpanStart("AUTH", "refreshUser");
    const token = await getAccessToken();
    if (!token) {
      trace("AUTH", "refreshUser: no token → user=null");
      setUser(null);
      traceSpanEnd(spanId, { hasToken: false });
      return;
    }
    try {
      const u = await fetchMe();
      setUser(u);
      traceSpanEnd(spanId, { userId: u.id });
    } catch (e) {
      setUser(null);
      traceSpanEnd(spanId, { error: e instanceof Error ? e.message : String(e) }, "error");
    }
  }, []);

  const applyUser = useCallback((u: UserMe) => {
    trace("AUTH", "applyUser", { userId: u.id });
    setUser(u);
  }, []);

  const dismissEmailVerificationAfterRegister = useCallback(() => {
    setShowEmailVerificationAfterRegister(false);
  }, []);

  useEffect(() => {
    trace("AUTH", "AuthProvider init start");
    (async () => {
      await refreshUser();
      setReady(true);
      trace("AUTH", "AuthProvider ready");
    })();
  }, [refreshUser]);

  useEffect(() => {
    return on(AUTH_SESSION_INVALID_EVENT, () => {
      trace("AUTH", "session invalid → user=null");
      setUser(null);
    });
  }, []);

  const login = useCallback(async (loginValue: string, password: string) => {
    const spanId = traceSpanStart("AUTH", "login");
    let r: Response;
    try {
      await ensureBackendReachable(true);
      const loginUrl = `${getApiBaseUrl()}/api/v1/auth/login`;
      r = await fetch(loginUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ login: loginValue.trim(), password }),
      });
    } catch (e) {
      if (e instanceof Error && !isNetworkError(e)) throw e;
      traceSpanEnd(spanId, { phase: "fetch" }, "error");
      throw new Error(
        fetchFailureMessage(e, `${getApiBaseUrl()}/api/v1/auth/login`),
      );
    }
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      traceSpanEnd(spanId, { status: r.status }, "error");
      throw new Error(authErrorMessage(r.status, data));
    }
    const tokens = data as { access_token?: string; refresh_token?: string };
    if (!tokens.access_token || !tokens.refresh_token) {
      traceSpanEnd(spanId, { reason: "missing tokens" }, "error");
      throw new Error(missingAuthTokensMessage());
    }
    await setTokens(tokens.access_token, tokens.refresh_token);
    const u = await fetchMe();
    setUser(u);
    traceSpanEnd(spanId, { userId: u.id, status: r.status });
  }, []);

  const register = useCallback(
    async (email: string, username: string, password: string, promoCode?: string) => {
    const spanId = traceSpanStart("AUTH", "register");
    let r: Response;
    const body: Record<string, string> = {
      email,
      username: username.trim(),
      password,
    };
    if (promoCode?.trim()) body.promo_code = promoCode.trim();
    try {
      await ensureBackendReachable(true);
      const registerUrl = `${getApiBaseUrl()}/api/v1/auth/register`;
      r = await fetch(registerUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(body),
      });
    } catch (e) {
      if (e instanceof Error && !isNetworkError(e)) throw e;
      traceSpanEnd(spanId, { phase: "fetch" }, "error");
      throw new Error(
        fetchFailureMessage(e, `${getApiBaseUrl()}/api/v1/auth/register`),
      );
    }
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      traceSpanEnd(spanId, { status: r.status }, "error");
      throw new Error(registerErrorMessage(r.status, data));
    }
    const tokens = data as { access_token?: string; refresh_token?: string };
    if (!tokens.access_token || !tokens.refresh_token) {
      traceSpanEnd(spanId, { reason: "missing tokens" }, "error");
      throw new Error(missingAuthTokensMessage());
    }
    await setTokens(tokens.access_token, tokens.refresh_token);
    const u = await fetchMe();
    setUser(u);
    if (!u.is_email_verified) {
      setShowEmailVerificationAfterRegister(true);
    }
    traceSpanEnd(spanId, { userId: u.id, emailVerified: u.is_email_verified });
  },
  []);

  const signInWithOAuth = useCallback(async (provider: OAuthProviderId) => {
    const spanId = traceSpanStart("AUTH", `oauth ${provider}`);
    const tokens = await oauthSignIn(provider);
    await setTokens(tokens.access_token, tokens.refresh_token);
    const u = await fetchMe();
    setUser(u);
    traceSpanEnd(spanId, { userId: u.id, provider });
  }, []);

  const logout = useCallback(async () => {
    const spanId = traceSpanStart("AUTH", "logout");
    try {
      const access = await getAccessToken();
      const refresh = await getRefreshToken();
      const headers: Record<string, string> = { Accept: "application/json" };
      if (access) headers.Authorization = `Bearer ${access}`;
      if (refresh) headers["X-Refresh-Token"] = `Bearer ${refresh}`;
      await fetch(`${getApiBaseUrl()}/api/v1/auth/logout`, { method: "POST", headers });
    } catch (e) {
      trace("AUTH", "logout network error (continuing local clear)", {
        error: e instanceof Error ? e.message : String(e),
      });
    }
    await clearTokens();
    setUser(null);
    setShowEmailVerificationAfterRegister(false);
    traceSpanEnd(spanId);
  }, []);

  const value = useMemo<AuthCtx>(
    () => ({
      ready,
      isAuthenticated: !!user,
      user,
      login,
      register,
      signInWithOAuth,
      logout,
      refreshUser,
      applyUser,
      showEmailVerificationAfterRegister,
      dismissEmailVerificationAfterRegister,
    }),
    [
      ready,
      user,
      login,
      register,
      signInWithOAuth,
      logout,
      refreshUser,
      applyUser,
      showEmailVerificationAfterRegister,
      dismissEmailVerificationAfterRegister,
    ]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used within AuthProvider");
  return c;
}
