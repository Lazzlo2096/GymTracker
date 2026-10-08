import { Link, Redirect, useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
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
import { useAuth } from "@/context/AuthContext";
import type { OAuthProviderId } from "@/auth/oauthSignIn";
import { authScreenStyles } from "@/components/auth/authScreenStyles";
import { AuthStatusBarInsetBand } from "@/components/navigation/StatusBarInsetBand";
import AuthPasswordInput from "@/components/auth/AuthPasswordInput";
import OAuthSocialRow from "@/components/auth/OAuthSocialRow";
import { toUserFacingError } from "@/api/errors";
import { trace } from "@/debug/traceLog";
import { colors } from "@/theme/colors";
import { isEmailLike } from "@/auth/emailValidation";
import { saveRegisterPromo } from "@/auth/registerPromo";
import { useTraceScreen } from "@/debug/useTraceScreen";

export default function LoginScreen() {
  useTraceScreen("login");
  const { promo: promoParam } = useLocalSearchParams<{ promo?: string }>();
  const { login, signInWithOAuth, ready, isAuthenticated } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthBusy, setOauthBusy] = useState<OAuthProviderId | null>(null);
  const passwordRef = useRef<TextInput>(null);

  const promoFromUrl =
    typeof promoParam === "string" ? promoParam : promoParam?.[0] ?? "";

  useEffect(() => {
    if (promoFromUrl.trim()) saveRegisterPromo(promoFromUrl.trim());
  }, [promoFromUrl]);

  const registerHref = promoFromUrl.trim()
    ? (`/register?promo=${encodeURIComponent(promoFromUrl.trim())}` as const)
    : "/register";

  if (ready && isAuthenticated) {
    return <Redirect href="/workouts" />;
  }

  const handleSubmit = async () => {
    trace("PRESS", "login submit");
    setError("");
    const trimmed = email.trim();
    if (!isEmailLike(trimmed)) {
      setError("Введите корректный email.");
      return;
    }
    setLoading(true);
    try {
      await login(trimmed, password);
    } catch (e) {
      setError(toUserFacingError(e, "Ошибка входа"));
    } finally {
      setLoading(false);
    }
  };

  const focusPassword = () => {
    passwordRef.current?.focus();
  };

  const submitFromKeyboard = () => {
    if (loading || oauthBusy !== null) return;
    void handleSubmit();
  };

  const handlePasswordKeyPress: React.ComponentProps<typeof TextInput>["onKeyPress"] =
    Platform.OS === "web"
      ? (event) => {
          if (event.nativeEvent.key === "Enter") submitFromKeyboard();
        }
      : undefined;

  const handleOAuth = async (provider: OAuthProviderId) => {
    trace("PRESS", `oauth ${provider}`);
    setError("");
    setOauthBusy(provider);
    try {
      await signInWithOAuth(provider);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка входа";
      if (msg !== "Вход отменён") setError(msg);
    } finally {
      setOauthBusy(null);
    }
  };

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
            returnKeyType="go"
            onSubmitEditing={submitFromKeyboard}
            onKeyPress={handlePasswordKeyPress}
            enterKeyHint="go"
          />

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
              <Text style={authScreenStyles.primaryBtnText}>Войти</Text>
            )}
          </Pressable>

          <View style={authScreenStyles.footerRow}>
            <Text style={authScreenStyles.footerMuted}>Нет аккаунта? </Text>
            <Link href={registerHref} asChild>
              <Pressable hitSlop={8}>
                <Text style={authScreenStyles.footerLink}>Зарегистрироваться</Text>
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
                returnKeyType="go"
                onSubmitEditing={submitFromKeyboard}
                onKeyPress={handlePasswordKeyPress}
                enterKeyHint="go"
              />

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
                  <Text style={authScreenStyles.primaryBtnText}>Войти</Text>
                )}
              </Pressable>

              <View style={authScreenStyles.footerRow}>
                <Text style={authScreenStyles.footerMuted}>Нет аккаунта? </Text>
                <Link href={registerHref} asChild>
                  <Pressable hitSlop={8}>
                    <Text style={authScreenStyles.footerLink}>Зарегистрироваться</Text>
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
});
