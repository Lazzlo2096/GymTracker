import { Link, Redirect, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { toUserFacingError } from "@/api/errors";
import { getApiBaseUrl } from "@/config/env";
import { useAuth } from "@/context/AuthContext";
import type { OAuthProviderId } from "@/auth/oauthSignIn";
import { clearRegisterPromo, peekRegisterPromo, saveRegisterPromo } from "@/auth/registerPromo";
import { authScreenStyles } from "@/components/auth/authScreenStyles";
import { AuthStatusBarInsetBand } from "@/components/navigation/StatusBarInsetBand";
import AuthPasswordInput from "@/components/auth/AuthPasswordInput";
import OAuthSocialRow from "@/components/auth/OAuthSocialRow";
import { isEmailLike } from "@/auth/emailValidation";
import { colors } from "@/theme/colors";
import { trace } from "@/debug/traceLog";
import { useTraceScreen } from "@/debug/useTraceScreen";

function usernameFromEmail(email: string): string {
  const local = email.split("@")[0]?.trim() || "user";
  const cleaned = local.replace(/[^A-Za-z0-9_.-]+/g, "").slice(0, 100);
  return cleaned || "user";
}

type PromoResolve = {
  valid: boolean;
  code: string;
  allowed_at_register?: boolean;
  owner_display_name?: string | null;
};

export default function RegisterScreen() {
  useTraceScreen("register");
  const { promo: promoParam } = useLocalSearchParams<{ promo?: string }>();
  const { register, signInWithOAuth, ready, isAuthenticated } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [promoLocked, setPromoLocked] = useState(false);
  const [promoHint, setPromoHint] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthBusy, setOauthBusy] = useState<OAuthProviderId | null>(null);
  const passwordRef = useRef<TextInput>(null);
  const password2Ref = useRef<TextInput>(null);
  const promoRef = useRef<TextInput>(null);

  const initialPromo = useMemo(() => {
    const fromUrl = typeof promoParam === "string" ? promoParam : promoParam?.[0];
    return (fromUrl || peekRegisterPromo() || "").trim();
  }, [promoParam]);

  useEffect(() => {
    if (!initialPromo) return;
    saveRegisterPromo(initialPromo);
    setPromoCode(initialPromo);
    setPromoLocked(true);

    (async () => {
      try {
        const r = await fetch(
          `${getApiBaseUrl()}/api/v1/promo-codes/resolve/${encodeURIComponent(initialPromo)}`,
          { headers: { Accept: "application/json" } },
        );
        const data = (await r.json().catch(() => ({}))) as PromoResolve;
        if (!r.ok || !data.valid) {
          setPromoHint("Промокод из ссылки не найден");
          return;
        }
        if (!data.allowed_at_register) {
          setPromoHint("Этот промокод нельзя использовать при регистрации");
          return;
        }
        const who = data.owner_display_name
          ? ` от ${data.owner_display_name}`
          : "";
        setPromoHint(`Вы перешли по промокоду${who}`);
      } catch {
        setPromoHint("Вы перешли по промокоду");
      }
    })();
  }, [initialPromo]);

  if (ready && isAuthenticated) {
    return <Redirect href="/workouts" />;
  }

  const handleSubmit = async () => {
    trace("PRESS", "register submit");
    setError("");
    const trimmed = email.trim();
    if (!isEmailLike(trimmed)) {
      setError("Введите корректный email.");
      return;
    }
    if (password.length < 8) {
      setError("Пароль не менее 8 символов.");
      return;
    }
    if (password !== password2) {
      setError("Пароли не совпадают.");
      return;
    }
    setLoading(true);
    try {
      const promo = promoCode.trim() || undefined;
      await register(trimmed, usernameFromEmail(trimmed), password, promo);
      clearRegisterPromo();
    } catch (e) {
      setError(toUserFacingError(e, "Ошибка регистрации"));
    } finally {
      setLoading(false);
    }
  };

  const focusPassword = () => {
    passwordRef.current?.focus();
  };

  const focusPassword2 = () => {
    password2Ref.current?.focus();
  };

  const focusPromo = () => {
    promoRef.current?.focus();
  };

  const submitFromKeyboard = () => {
    if (loading || oauthBusy !== null) return;
    void handleSubmit();
  };

  const focusAfterPassword2 = () => {
    if (promoLocked) {
      submitFromKeyboard();
      return;
    }
    focusPromo();
  };

  const handleSubmitKeyPress: React.ComponentProps<typeof TextInput>["onKeyPress"] =
    Platform.OS === "web"
      ? (event) => {
          if (event.nativeEvent.key === "Enter") submitFromKeyboard();
        }
      : undefined;

  const handleOAuth = async (provider: OAuthProviderId) => {
    setError("");
    if (promoCode.trim()) saveRegisterPromo(promoCode.trim());
    setOauthBusy(provider);
    try {
      await signInWithOAuth(provider);
      clearRegisterPromo();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка входа";
      if (msg !== "Вход отменён") setError(msg);
    } finally {
      setOauthBusy(null);
    }
  };

  const promoField = (
    <>
      <TextInput
        ref={promoRef}
        style={[authScreenStyles.input, promoLocked && styles.inputLocked]}
        placeholder="промокод (необязательно)"
        placeholderTextColor={colors.placeholder}
        value={promoCode}
        onChangeText={promoLocked ? undefined : setPromoCode}
        editable={!promoLocked}
        autoCapitalize="characters"
        autoCorrect={false}
        returnKeyType="go"
        onSubmitEditing={submitFromKeyboard}
        onKeyPress={promoLocked ? undefined : handleSubmitKeyPress}
        enterKeyHint="go"
      />
      {promoHint ? <Text style={styles.promoHint}>{promoHint}</Text> : null}
    </>
  );

  if (!ready) {
    return (
      <View style={authScreenStyles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={authScreenStyles.flex}>
      <AuthStatusBarInsetBand />
      {Platform.OS === "web" ? (
        <ScrollView
          contentContainerStyle={authScreenStyles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={authScreenStyles.card}>
            <Text style={authScreenStyles.brandTitle}>GymTracker</Text>

            <TextInput
              style={authScreenStyles.input}
              placeholder="email"
              placeholderTextColor={colors.placeholder}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={focusPassword}
              enterKeyHint="next"
            />
            <AuthPasswordInput
              ref={passwordRef}
              placeholder="пароль"
              placeholderTextColor={colors.placeholder}
              value={password}
              onChangeText={setPassword}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={focusPassword2}
              enterKeyHint="next"
            />
            <AuthPasswordInput
              ref={password2Ref}
              placeholder="подтверждение пароля"
              placeholderTextColor={colors.placeholder}
              value={password2}
              onChangeText={setPassword2}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType={promoLocked ? "go" : "next"}
              onSubmitEditing={focusAfterPassword2}
              onKeyPress={promoLocked ? handleSubmitKeyPress : undefined}
              enterKeyHint={promoLocked ? "go" : "next"}
            />
            {promoField}

            <OAuthSocialRow busyProvider={oauthBusy} onPress={handleOAuth} />

            {error ? <Text style={authScreenStyles.err}>{error}</Text> : null}

            <Pressable
              style={[authScreenStyles.primaryBtn, loading && styles.primaryDisabled]}
              onPress={handleSubmit}
              disabled={loading || oauthBusy !== null}
            >
              {loading ? (
                <ActivityIndicator color={colors.surface} />
              ) : (
                <Text style={authScreenStyles.primaryBtnText}>Зарегистрироваться</Text>
              )}
            </Pressable>

            <View style={authScreenStyles.footerRow}>
              <Text style={authScreenStyles.footerMuted}>Уже есть аккаунт? </Text>
              <Link href="/login" asChild>
                <Pressable hitSlop={8}>
                  <Text style={authScreenStyles.footerLink}>Войти</Text>
                </Pressable>
              </Link>
            </View>
          </View>
        </ScrollView>
      ) : (
        <KeyboardAvoidingView
          style={authScreenStyles.flex}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            contentContainerStyle={authScreenStyles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={authScreenStyles.card}>
              <Text style={authScreenStyles.brandTitle}>GymTracker</Text>

              <TextInput
                style={authScreenStyles.input}
                placeholder="email"
                placeholderTextColor={colors.placeholder}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={focusPassword}
                enterKeyHint="next"
              />
              <AuthPasswordInput
                ref={passwordRef}
                placeholder="пароль"
                placeholderTextColor={colors.placeholder}
                value={password}
                onChangeText={setPassword}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={focusPassword2}
                enterKeyHint="next"
              />
              <AuthPasswordInput
                ref={password2Ref}
                placeholder="повторите пароль"
                placeholderTextColor={colors.placeholder}
                value={password2}
                onChangeText={setPassword2}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType={promoLocked ? "go" : "next"}
                onSubmitEditing={focusAfterPassword2}
                onKeyPress={promoLocked ? handleSubmitKeyPress : undefined}
                enterKeyHint={promoLocked ? "go" : "next"}
              />
              {promoField}

              <OAuthSocialRow busyProvider={oauthBusy} onPress={handleOAuth} />

              {error ? <Text style={authScreenStyles.err}>{error}</Text> : null}

              <Pressable
                style={[authScreenStyles.primaryBtn, loading && styles.primaryDisabled]}
                onPress={handleSubmit}
                disabled={loading || oauthBusy !== null}
              >
                {loading ? (
                  <ActivityIndicator color={colors.surface} />
                ) : (
                  <Text style={authScreenStyles.primaryBtnText}>Создать аккаунт</Text>
                )}
              </Pressable>

              <View style={authScreenStyles.footerRow}>
                <Text style={authScreenStyles.footerMuted}>Уже есть аккаунт? </Text>
                <Link href="/login" asChild>
                  <Pressable hitSlop={8}>
                    <Text style={authScreenStyles.footerLink}>Войти</Text>
                  </Pressable>
                </Link>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  primaryDisabled: { opacity: 0.7 },
  inputLocked: { opacity: 0.85 },
  promoHint: {
    color: colors.primary,
    fontSize: 13,
    marginTop: -6,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
});
