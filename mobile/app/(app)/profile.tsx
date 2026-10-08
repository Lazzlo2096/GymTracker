import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import EmailVerificationBanner from "@/components/profile/EmailVerificationBanner";
import GoalEditModal from "@/components/profile/modals/GoalEditModal";
import EmailVerificationModal from "@/components/profile/modals/EmailVerificationModal";
import InfoNoticeModal from "@/components/profile/modals/InfoNoticeModal";
import TextFieldModal from "@/components/profile/modals/TextFieldModal";
import ReferralSystemModal from "@/components/profile/modals/ReferralSystemModal";
import ActivatePromoModal from "@/components/profile/modals/ActivatePromoModal";
import { cancelWorkoutReminders } from "@/notifications/scheduleWorkoutReminders";
import {
  pickImageFromLibrary,
  runAfterNotificationPermissionGranted,
  takePhotoWithCamera,
} from "@/permissions";
import { registerPushAfterPermission } from "@/notifications/registerPushAfterPermission";
import DatePickerPopover from "@/components/modals/DatePickerPopover";
import FilterSelectModal from "@/components/modals/FilterSelectModal";
import WorkoutDeleteConfirmModal from "@/components/modals/WorkoutDeleteConfirmModal";
import { useBottomTabBarScrollPadding } from "@/components/navigation/bottomTabBarInset";
import AppSwitch from "@/components/ui/AppSwitch";
import ScreenTitleRowIconButton from "@/components/ui/ScreenTitleRowIconButton";

import { useAuth } from "@/context/AuthContext";
import { useTraceScreen } from "@/debug/useTraceScreen";
import { useGuardedFocusLoad } from "@/hooks/useGuardedFocusLoad";
import { apiFetch, parseErrorDetail } from "@/api/client";
import { on } from "@/utils/eventBus";
import { uploadProfileAvatar } from "@/utils/avatarUpload";
import { resolveMediaUrl } from "@/utils/mediaUrl";
import { useAppTheme } from "@/theme/appTheme";
import { metricToken } from "@/components/workouts/metricIcon";
import { fonts, type } from "@/theme/typography";
import { ageCompletedYearsFromIso, parseIsoDateOnlyLocal, toIsoDateOnly } from "@/utils/ageFromBirthDate";
import { pressableStyle } from "@/utils/pressableStyles";

const textBreakProps =
  Platform.OS === "android"
    ? ({ hyphenationFrequency: "none" } as const)
    : Platform.OS === "ios"
      ? ({ lineBreakStrategyIOS: "push-out" } as const)
      : {};

const UNITS_OPTIONS = [
  { id: "metric", label: "kg" },
  { id: "imperial", label: "lbs" },
];

export default function ProfileScreen() {
  useTraceScreen("profile");
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const horizontalPadding = width >= 400 ? 20 : 16;
  const { user, logout, refreshUser, applyUser } = useAuth();
  const theme = useAppTheme();
  const dark = theme.dark;

  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarCacheKey, setAvatarCacheKey] = useState(0);

  const [editName, setEditName] = useState(false);
  const [editAge, setEditAge] = useState(false);
  const [editHeight, setEditHeight] = useState(false);
  const [editGoal, setEditGoal] = useState(false);
  const [editTargetWeight, setEditTargetWeight] = useState(false);
  const [unitsOpen, setUnitsOpen] = useState(false);
  const [gearOpen, setGearOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [referralOpen, setReferralOpen] = useState(false);
  const [promoOpen, setPromoOpen] = useState(false);
  const [info, setInfo] = useState<{ title: string; body: string } | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [verifyModalOpen, setVerifyModalOpen] = useState(false);
  const bottomPad = useBottomTabBarScrollPadding();

  const openInfo = useCallback((payload: { title: string; body: string }) => {
    setInfo(payload);
    setInfoOpen(true);
  }, []);

  const { reload: reloadProfile, invalidateInFlightLoads } = useGuardedFocusLoad({
    enabled: true,
    load: async () => {
      await refreshUser();
      return { kind: "success", data: undefined };
    },
    onSuccess: () => {},
  });

  useEffect(() => {
    return on("profile:updated", () => {
      void reloadProfile({ silent: true });
    });
  }, [reloadProfile]);

  const openGymPicker = useCallback(() => {
    const qs = new URLSearchParams({ pickForProfile: "1" });
    if (user?.preferred_user_gym_id != null) {
      qs.set("initialGymId", String(user.preferred_user_gym_id));
    }
    invalidateInFlightLoads();
    router.push(`/gyms?${qs.toString()}`);
  }, [invalidateInFlightLoads, router, user?.preferred_user_gym_id]);

  const patchMe = async (body: Record<string, unknown>) => {
    const r = await apiFetch("/api/v1/auth/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      throw new Error(parseErrorDetail(d));
    }

    await refreshUser();
  };

  const uploadAvatarFromUri = async (uri: string, mimeType?: string | null) => {
    setAvatarBusy(true);
    try {
      const updated = await uploadProfileAvatar(uri, mimeType);
      applyUser(updated);
      setAvatarCacheKey((k) => k + 1);
    } catch (e) {
      Alert.alert("Ошибка", e instanceof Error ? e.message : "Не удалось загрузить фото");
    } finally {
      setAvatarBusy(false);
    }
  };

  const pickAvatarFromLibrary = async () => {
    const asset = await pickImageFromLibrary({
      allowsEditing: Platform.OS !== "web",
      aspect: [1, 1],
      quality: 0.85,
    });
    if (!asset?.uri) return;
    await uploadAvatarFromUri(asset.uri, asset.mimeType ?? null);
  };

  const pickAvatarFromCamera = async () => {
    const asset = await takePhotoWithCamera({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (!asset?.uri) return;
    await uploadAvatarFromUri(asset.uri, asset.mimeType ?? null);
  };

  const openAvatarPicker = () => {
    if (avatarBusy) return;

    // Alert с несколькими кнопками на web (Chrome) часто не показывается.
    if (Platform.OS === "web") {
      void pickAvatarFromLibrary();
      return;
    }

    Alert.alert("Фото профиля", "Выберите источник", [
      { text: "Галерея", onPress: () => void pickAvatarFromLibrary() },
      { text: "Камера", onPress: () => void pickAvatarFromCamera() },
      { text: "Отмена", style: "cancel" },
    ]);
  };

  const avatarUri = user?.avatar_url
    ? `${resolveMediaUrl(user.avatar_url)}?v=${avatarCacheKey}`
    : undefined;

  const gymLine = () => {
    const g = user?.preferred_gym;
    if (!g) return "Не выбран";
    return g.name;
  };

  const unitsLabel = user?.measurement_units === "imperial" ? "lbs" : "kg";

  const colors = {
    bg: theme.bg,
    card: theme.card,
    text: dark ? "#F4F0FB" : "#081033",
    muted: dark ? "#A89BC4" : "#737B9B",
    border: theme.border,
    divider: theme.divider,
    softPurple: dark ? "#33224D" : metricToken("violet", false).circle,
    avatarBg: dark ? "#2B2340" : metricToken("violet", false).circle,
    switchOff: theme.switchOff,
    switchThumb: theme.switchThumb,
    danger: "#FF2D55",
    accent: theme.accent,
    accentMuted: theme.accentMuted,
    accentSoft: theme.accentSoft,
  };

  const birthDateBounds = useMemo(() => {
    const max = new Date();
    max.setHours(0, 0, 0, 0);
    const min = new Date(max);
    min.setFullYear(min.getFullYear() - 120);
    return { min, max };
  }, []);

  if (!user) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg }]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  const ageYears = ageCompletedYearsFromIso(user.birth_date);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView
        style={[styles.screen, { backgroundColor: colors.bg }]}
        contentContainerStyle={{
          paddingBottom: bottomPad,
          paddingTop: 12,
          paddingHorizontal: horizontalPadding,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.topBar}>
          <Text style={[styles.h1, { color: colors.text }]} {...textBreakProps}>
            Профиль
          </Text>

          <ScreenTitleRowIconButton
            accessibilityLabel="Настройки"
            hitSlop={8}
            onPress={() => setGearOpen(true)}
            style={styles.topBarGear}
          >
            <MaterialCommunityIcons name="cog" size={22} color={metricToken("violet", dark).fg} />
          </ScreenTitleRowIconButton>
        </View>

        <View
          style={[
            styles.heroCard,
            {
              backgroundColor: colors.card,
            },
          ]}
        >
          <Pressable
            style={styles.avatarOuter}
            onPress={openAvatarPicker}
            disabled={avatarBusy}
            accessibilityRole="button"
            accessibilityLabel="Изменить фото профиля"
          >
            <View style={[styles.avatarCircle, { backgroundColor: colors.avatarBg }]}>
              {avatarBusy ? (
                <ActivityIndicator color={colors.accent} />
              ) : avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatarImg} />
              ) : (
                <Ionicons name="person" size={48} color={colors.accent} />
              )}
            </View>
            {!avatarBusy ? (
              <View
                style={[styles.avatarEditBadge, { backgroundColor: colors.accent, borderColor: colors.card }]}
                pointerEvents="none"
              >
                <Ionicons name="camera" size={16} color={theme.white} />
              </View>
            ) : null}
          </Pressable>

          <View style={styles.heroContent}>
            <View style={styles.heroNameRow}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.displayName, { color: colors.text }]} {...textBreakProps}>
                  {user.display_name}
                </Text>

                <Text style={[styles.email, { color: colors.muted }]} {...textBreakProps}>
                  {user.email}
                </Text>
              </View>

              <Ionicons name="chevron-forward" size={24} color={colors.muted} />
            </View>

            <View style={[styles.stajBadge, { backgroundColor: colors.softPurple }]}>
              <View style={styles.stajDot} />
              <Text style={[styles.stajText, { color: colors.accent }]}>
                Стаж: {user.experience_label ?? "—"}
              </Text>
            </View>

            <Pressable
              style={[
                styles.editProfileBtn,
                {
                  backgroundColor: colors.softPurple,
                },
              ]}
              onPress={() => setEditName(true)}
            >
              <Ionicons name="pencil" size={17} color={colors.accent} />
              <Text style={[styles.editProfileText, { color: colors.accent }]}>
                Редактировать профиль
              </Text>
            </Pressable>
          </View>
        </View>

        <View
          nativeID="profile-stats-card"
          testID="profile-stats-card"
          style={[
            styles.statsCard,
            {
              backgroundColor: colors.card,
            },
          ]}
        >
          <StatItem
            nativeId="profile-stat-height"
            icon={
              <View
                style={[
                  styles.statGlyphCircle,
                  { backgroundColor: metricToken("blue", dark).circle },
                ]}
              >
                <MaterialCommunityIcons
                  name="human-male-height-variant"
                  size={22}
                  color={metricToken("blue", dark).fg}
                />
              </View>
            }
            label="Рост"
            value={user.height_cm != null ? `${user.height_cm} см` : "—"}
            onPress={() => setEditHeight(true)}
            colors={colors}
          />

          <View
            nativeID="profile-stat-divider-height-weight"
            testID="profile-stat-divider-height-weight"
            style={[styles.statDivider, { backgroundColor: colors.divider }]}
          />

          <StatItem
            nativeId="profile-stat-weight"
            icon={
              <View
                style={[
                  styles.statGlyphCircle,
                  { backgroundColor: metricToken("teal", dark).circle },
                ]}
              >
                <MaterialCommunityIcons
                  name="weight-kilogram"
                  size={22}
                  color={metricToken("teal", dark).fg}
                />
              </View>
            }
            label="Целевой вес"
            value={user.target_weight_kg != null ? `${user.target_weight_kg} кг` : "—"}
            onPress={() => setEditTargetWeight(true)}
            colors={colors}
          />

          <View
            nativeID="profile-stat-divider-weight-goal"
            testID="profile-stat-divider-weight-goal"
            style={[styles.statDivider, { backgroundColor: colors.divider }]}
          />

          <StatItem
            nativeId="profile-stat-goal"
            icon={
              <View
                style={[
                  styles.statGlyphCircle,
                  { backgroundColor: metricToken("violet", dark).circle },
                ]}
              >
                <MaterialCommunityIcons
                  name="target"
                  size={22}
                  color={metricToken("violet", dark).fg}
                />
              </View>
            }
            label="Цель"
            value={user.training_goal?.trim() || "—"}
            onPress={() => setEditGoal(true)}
            colors={colors}
          />
        </View>

        {!user.is_email_verified ? (
          <EmailVerificationBanner
            colors={colors}
            onPress={() => setVerifyModalOpen(true)}
          />
        ) : null}

        <SectionTitle title="Мои данные" color={colors.text} />

        <View
          style={[
            styles.listCard,
            {
              backgroundColor: colors.card,
            },
          ]}
        >
          <Row
            icon="calendar-outline"
            label="Возраст"
            value={ageYears != null ? `${ageYears} лет` : "—"}
            onPress={() => setEditAge(true)}
            colors={colors}
          />

          <Row
            icon="resize-outline"
            label="Единицы измерения"
            value={unitsLabel}
            onPress={() => setUnitsOpen(true)}
            colors={colors}
          />

          <Row
            icon="location-outline"
            label="Мой зал"
            value={gymLine()}
            onPress={openGymPicker}
            colors={colors}
          />

          <Row
            icon="business-outline"
            label="Все залы"
            value="Журнал, фото, избранное"
            onPress={() => router.push("/gyms")}
            colors={colors}
          />

          <Row
            icon="barbell-outline"
            label="Каталог упражнений"
            value="Свои движения, заметки"
            onPress={() => router.push("/exercise_catalog")}
            colors={colors}
          />

          <Row
            icon="nutrition-outline"
            label="Мой дневник питания"
            value="Калории, БЖУ"
            premium
            onPress={() =>
              openInfo({
                title: "Мой дневник питания",
                body: "Ведение питания, калорий и макросов доступно по подписке Premium. Раздел появится в следующих версиях.",
              })
            }
            colors={colors}
          />

          <Row
            icon="scale-outline"
            label="Мой дневник веса"
            value="История, график"
            onPress={() => router.push("/weight-diary")}
            colors={colors}
          />

          <Row
            icon="body-outline"
            label="Мой дневник измерений"
            value="Обхваты, замеры"
            onPress={() =>
              openInfo({
                title: "Мой дневник измерений",
                body: "Ведение обхватов и других замеров тела появится в следующих версиях.",
              })
            }
            colors={colors}
          />

          <Row
            icon="radio-button-on-outline"
            label="Цель тренировок"
            value={user.training_goal?.trim() || "—"}
            onPress={() => setEditGoal(true)}
            colors={colors}
            last
          />
        </View>

        <SectionTitle title="Настройки" color={colors.text} />

        <View
          style={[
            styles.listCard,
            {
              backgroundColor: colors.card,
            },
          ]}
        >
          <ToggleRow
            icon="notifications-outline"
            label="Уведомления"
            value={Boolean(user.settings_notifications)}
            onValueChange={(v) => {
              if (!v) {
                void (async () => {
                  try {
                    await patchMe({ settings_notifications: false });
                  } catch (e) {
                    Alert.alert("Ошибка", e instanceof Error ? e.message : "");
                  }
                })();
                return;
              }
              runAfterNotificationPermissionGranted(async () => {
                try {
                  await patchMe({ settings_notifications: true });
                  await registerPushAfterPermission();
                } catch (e) {
                  Alert.alert("Ошибка", e instanceof Error ? e.message : "");
                }
              });
            }}
            colors={colors}
          />

          <ToggleRow
            icon="moon-outline"
            label="Тёмная тема"
            value={Boolean(user.settings_dark_theme)}
            onValueChange={async (v) => {
              try {
                await patchMe({ settings_dark_theme: v });
              } catch (e) {
                Alert.alert("Ошибка", e instanceof Error ? e.message : "");
              }
            }}
            colors={colors}
          />

          <ToggleRow
            icon="alarm-outline"
            label="Напоминания о тренировке"
            value={Boolean(user.settings_workout_reminders)}
            onValueChange={(v) => {
              if (!v) {
                void (async () => {
                  try {
                    await patchMe({ settings_workout_reminders: false });
                    await cancelWorkoutReminders();
                  } catch (e) {
                    Alert.alert("Ошибка", e instanceof Error ? e.message : "");
                  }
                })();
                return;
              }
              runAfterNotificationPermissionGranted(async () => {
                try {
                  if (!user.settings_notifications) {
                    await patchMe({
                      settings_notifications: true,
                      settings_workout_reminders: true,
                    });
                    await registerPushAfterPermission();
                  } else {
                    await patchMe({ settings_workout_reminders: true });
                  }
                  await cancelWorkoutReminders();
                } catch (e) {
                  Alert.alert("Ошибка", e instanceof Error ? e.message : "");
                }
              });
            }}
            colors={colors}
            last
          />
        </View>

        <SectionTitle title="Аккаунт" color={colors.text} />

        <View
          style={[
            styles.listCard,
            {
              backgroundColor: colors.card,
            },
          ]}
        >
          <Row
            icon="people-outline"
            label="Реферальная система"
            onPress={() => setReferralOpen(true)}
            colors={colors}
          />
          <Row
            icon="ticket-outline"
            label="Активировать промокод"
            onPress={() => setPromoOpen(true)}
            colors={colors}
          />

          <Row
            icon="shield-checkmark-outline"
            label="Безопасность"
            onPress={() =>
              openInfo({
                title: "Безопасность",
                body: "Смена пароля и двухфакторная аутентификация появятся в следующих версиях. Сейчас используйте надёжный пароль при регистрации.",
              })
            }
            colors={colors}
          />

          <Row
            icon="lock-closed-outline"
            label="Конфиденциальность"
            onPress={() =>
              openInfo({
                title: "Конфиденциальность",
                body: "Мы храним данные тренировок для вашего личного кабинета. Политика обработки персональных данных будет опубликована на сайте проекта.",
              })
            }
            colors={colors}
          />

          <Row
            icon="help-circle-outline"
            label="Помощь и поддержка"
            onPress={() =>
              openInfo({
                title: "Помощь и поддержка",
                body: "По вопросам приложения напишите разработчику или откройте документацию в репозитории gymtracker.",
              })
            }
            colors={colors}
          />

          <Row
            icon="bug-outline"
            label="Сообщить о баге"
            onPress={() =>
              openInfo({
                title: "Сообщить о баге",
                body: "Форма отправки отчёта об ошибке появится в следующих версиях.",
              })
            }
            colors={colors}
          />

          <Row
            icon="bulb-outline"
            label="Предложить новую функцию"
            premium
            onPress={() =>
              openInfo({
                title: "Предложить новую функцию",
                body: "Отправка идей доступна по подписке Premium. Оформление подписки появится в следующих версиях.",
              })
            }
            colors={colors}
          />

          <Row
            icon="log-out-outline"
            label="Выйти из аккаунта"
            danger
            onPress={() => setLogoutConfirmOpen(true)}
            colors={colors}
            last
          />
        </View>
      </ScrollView>

      <TextFieldModal
        visible={editName}
        title="Имя в приложении"
        initial={user.display_name}
        placeholder="Как к вам обращаться"
        onClose={() => setEditName(false)}
        onSave={async (v) => {
          if (!v) throw new Error("Введите имя");
          await patchMe({ display_name: v });
        }}
      />

      <DatePickerPopover
        visible={editAge}
        selectedDate={parseIsoDateOnlyLocal(user.birth_date)}
        allowClear
        minDate={birthDateBounds.min}
        maxDate={birthDateBounds.max}
        screenWidth={width}
        screenHeight={height}
        topInset={insets.top}
        bottomInset={insets.bottom}
        onClose={() => setEditAge(false)}
        onSelectDate={(d) => {
          setEditAge(false);
          void (async () => {
            try {
              if (d == null) {
                await patchMe({ birth_date: null });
                return;
              }
              const iso = toIsoDateOnly(d);
              const age = ageCompletedYearsFromIso(iso);
              if (age == null || age < 5 || age > 120) {
                Alert.alert("Ошибка", "Возраст должен быть от 5 до 120 лет (по дате рождения).");
                return;
              }
              await patchMe({ birth_date: iso });
            } catch (e) {
              Alert.alert("Ошибка", e instanceof Error ? e.message : "");
            }
          })();
        }}
      />

      <TextFieldModal
        visible={editHeight}
        title="Рост (см)"
        initial={user.height_cm != null ? String(user.height_cm) : ""}
        placeholder="Например: 182"
        keyboardType="numeric"
        onClose={() => setEditHeight(false)}
        onSave={async (v) => {
          const trimmed = v.trim();
          if (!trimmed) {
            await patchMe({ height_cm: null });
            return;
          }

          const n = parseInt(trimmed, 10);
          if (!Number.isFinite(n) || n < 50 || n > 280) {
            throw new Error("Рост от 50 до 280 см");
          }
          await patchMe({ height_cm: n });
        }}
      />

      <GoalEditModal
        visible={editGoal}
        initial={user.training_goal ?? ""}
        onClose={() => setEditGoal(false)}
        onSave={async (v) => {
          await patchMe({ training_goal: v || null });
        }}
      />

      <TextFieldModal
        visible={editTargetWeight}
        title="Целевой вес (кг)"
        initial={user.target_weight_kg != null ? String(user.target_weight_kg) : ""}
        placeholder="Например: 75"
        keyboardType="number-pad"
        onClose={() => setEditTargetWeight(false)}
        onSave={async (v) => {
          const trimmed = v.trim();
          if (!trimmed) {
            await patchMe({ target_weight_kg: null });
            return;
          }

          const n = parseInt(trimmed, 10);
          if (!Number.isFinite(n) || n < 20 || n > 500) {
            throw new Error("Целевой вес от 20 до 500 кг");
          }

          await patchMe({ target_weight_kg: n });
        }}
      />

      <FilterSelectModal
        visible={unitsOpen}
        title="Единицы измерения"
        options={UNITS_OPTIONS}
        selectedId={user.measurement_units === "imperial" ? "imperial" : "metric"}
        onSelect={(id) =>
          void patchMe({ measurement_units: id }).then(() => setUnitsOpen(false))
        }
        onClose={() => setUnitsOpen(false)}
      />

      <InfoNoticeModal
        visible={gearOpen}
        title="Настройки приложения"
        body="Push: реферальная программа, стрики и подсказки по привычному времени. Напоминания о тренировке — за 3 часа до запланированной (планирование скоро). На iOS/Android нужно разрешение в системе."
        onClose={() => setGearOpen(false)}
      />

      <InfoNoticeModal
        visible={infoOpen}
        title={info?.title ?? ""}
        body={info?.body ?? ""}
        onClose={() => setInfoOpen(false)}
        onDismiss={() => setInfo(null)}
      />

      <EmailVerificationModal
        visible={verifyModalOpen}
        email={user.email}
        showResend
        onClose={() => setVerifyModalOpen(false)}
      />

      <ReferralSystemModal visible={referralOpen} onClose={() => setReferralOpen(false)} />

      <ActivatePromoModal
        visible={promoOpen}
        onClose={() => setPromoOpen(false)}
        onSuccess={() => refreshUser()}
      />

      <WorkoutDeleteConfirmModal
        visible={logoutConfirmOpen}
        title="Выйти из аккаунта?"
        message="Потребуется войти снова."
        confirmLabel="Выйти"
        onCancel={() => setLogoutConfirmOpen(false)}
        onConfirm={() => {
          setLogoutConfirmOpen(false);
          void (async () => {
            await logout();
            router.replace("/login");
          })();
        }}
      />
    </>
  );
}

function SectionTitle({ title, color }: { title: string; color: string }) {
  return <Text style={[styles.sectionTitle, { color }]}>{title}</Text>;
}

function StatItem({
  nativeId,
  icon,
  label,
  value,
  onPress,
  colors,
}: {
  nativeId: string;
  icon: React.ReactNode;
  label: string;
  value: string;
  onPress: () => void;
  colors: any;
}) {
  return (
    <Pressable
      nativeID={nativeId}
      testID={nativeId}
      style={pressableStyle(styles.statItem, {
        hover: { opacity: 0.92 },
        pressed: { opacity: 0.86 },
      })}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
    >
      {icon}

      <Text style={[styles.statLabel, { color: colors.muted }]}>{label}</Text>

      <Text style={[styles.statValue, { color: colors.text }]} {...textBreakProps}>
        {value}
      </Text>
    </Pressable>
  );
}

function Row({
  icon,
  label,
  value,
  onPress,
  last,
  danger,
  premium,
  colors,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  onPress: () => void;
  last?: boolean;
  danger?: boolean;
  premium?: boolean;
  colors: any;
}) {
  const mainColor = danger ? colors.danger : colors.text;
  const iconColor = danger ? colors.danger : colors.accent;

  return (
    <Pressable
      style={pressableStyle(
        [
          styles.row,
          !last
            ? {
                borderBottomWidth: StyleSheet.hairlineWidth,
                borderBottomColor: colors.divider,
              }
            : {},
        ],
        {
          hover: { backgroundColor: colors.cardSoft },
          pressed: { opacity: 0.9 },
        },
      )}
      onPress={onPress}
      accessibilityRole="button"
    >
      <Ionicons name={icon} size={25} color={iconColor} style={styles.rowIcon} />

      <View style={styles.rowLabelWrap}>
        <Text style={[styles.rowLabel, { color: mainColor }]} {...textBreakProps}>
          {label}
        </Text>
        {premium ? (
          <View style={[styles.premiumIcon, { backgroundColor: colors.accentSoft }]}>
            <Ionicons name="diamond-outline" size={14} color={colors.accent} />
          </View>
        ) : null}
      </View>

      {value ? (
        <Text style={[styles.rowValue, { color: colors.muted }]} {...textBreakProps}>
          {value}
        </Text>
      ) : null}

      <Ionicons
        name="chevron-forward"
        size={20}
        color={danger ? colors.muted : colors.muted}
        style={{ marginLeft: 8 }}
      />
    </Pressable>
  );
}

function ToggleRow({
  icon,
  label,
  value,
  onValueChange,
  last,
  colors,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: boolean;
  onValueChange: (v: boolean) => void | Promise<void>;
  last?: boolean;
  colors: any;
}) {
  return (
    <View
      style={[
        styles.row,
        !last && {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.divider,
        },
      ]}
    >
      <Ionicons name={icon} size={25} color={colors.accent} style={styles.rowIcon} />

      <Text style={[styles.toggleRowLabel, { color: colors.text }]} {...textBreakProps}>
        {label}
      </Text>

      <AppSwitch
        value={value}
        onValueChange={onValueChange}
        trackColor={{
          false: colors.switchOff,
          true: colors.accent,
        }}
        thumbColor={colors.switchThumb}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
    minHeight: 48,
  },

  /** Без доп. margin — правый край кружка совпадает с краем плашек (padding только у ScrollView). */
  topBarGear: {
    marginRight: 0,
  },

  /** Крупный заголовок экрана (как в макете Профиля ~26px). */
  h1: {
    flex: 1,
    marginRight: 12,
    fontFamily: fonts.extraBold,
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: -0.6,
  },

  heroCard: {
    marginHorizontal: 0,
    borderRadius: 22,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",

    shadowColor: "#190A3D",
    shadowOpacity: 0.06,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },

  avatarOuter: {
    width: 96,
    height: 96,
    position: "relative",
    overflow: "visible",
  },

  avatarCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },

  avatarImg: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },

  avatarEditBadge: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    zIndex: 10,
    elevation: 10,
  },

  heroContent: {
    flex: 1,
    marginLeft: 16,
    minWidth: 0,
  },

  heroNameRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  displayName: {
    ...type.cardEntityTitle,
  },

  email: {
    marginTop: 3,
    ...type.caption,
    fontFamily: fonts.regular,
  },

  stajBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    gap: 8,
  },

  stajDot: {
    width: 6,
    height: 6,
    borderRadius: 4,
    backgroundColor: "#35D15A",
  },

  stajText: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    lineHeight: 16,
  },

  editProfileBtn: {
    height: 30,
    borderRadius: 13,
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  editProfileText: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    lineHeight: 16,
  },

  statsCard: {
    marginHorizontal: 0,
    marginTop: 16,
    borderRadius: 22,
    paddingVertical: 20,
    paddingHorizontal: 4,
    flexDirection: "row",
    alignItems: "center",

    shadowColor: "#190A3D",
    shadowOpacity: 0.055,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },

  statItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 86,
    paddingHorizontal: 6,
  },

  statGlyphCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },

  statDivider: {
    width: StyleSheet.hairlineWidth,
    height: 58,
  },

  statLabel: {
    marginTop: 8,
    ...type.statTileLabel,
    textAlign: "center",
  },

  statValue: {
    marginTop: 5,
    ...type.statTileValue,
    textAlign: "center",
    wordWrap: "keep-all",
  },

  sectionTitle: {
    ...type.sectionAccent,
    letterSpacing: -0.3,
    marginTop: 22,
    marginBottom: 10,
  },

  listCard: {
    marginHorizontal: 0,
    borderRadius: 20,
    paddingHorizontal: 18,
    overflow: "hidden",

    shadowColor: "#190A3D",
    shadowOpacity: 0.045,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },

  row: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
  },

  rowIcon: {
    width: 34,
    marginRight: 10,
  },

  rowLabelWrap: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  rowLabel: {
    flexShrink: 1,
    minWidth: 0,
    ...type.settingsRowLabel,
  },

  /** Подпись в строке с Switch — как раньше, flex:1, чтобы рычаг был у правого края. */
  toggleRowLabel: {
    flex: 1,
    minWidth: 0,
    ...type.settingsRowLabel,
  },

  premiumIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginRight: 10,
  },

  rowValue: {
    maxWidth: "48%",
    ...type.settingsRowValue,
    textAlign: "right",
  },
});
