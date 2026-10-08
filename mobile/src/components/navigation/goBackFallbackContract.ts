/**
 * ## Контракт «Назад» на вложенных Stack-экранах (expo-router)
 *
 * Экраны в `app/(app)/_layout.tsx` Stack (`workout/[id]`, `plan-template/[id]`, pick-режимы
 * каталога/залов) могут открываться **напрямую по URL** (web refresh, deep link, закладка).
 * В стеке нет предыдущего маршрута → `router.back()` / `GO_BACK` не обрабатывается.
 *
 * ### Рекомендуемый контракт
 *
 * 1. **Кнопка «Назад»** на stack-экране — только через `useGoBackWithScreenEnter(fallbackHref)`
 *    или `goBackWithScreenEnter(router, direction, fallbackHref, navigation)`.
 * 2. **`fallbackHref`** — логичный родительский таб/список (`/plans`, `/workouts`, `/exercise_catalog`).
 * 3. **Не вызывать голый `router.back()`** на экранах, доступных по прямому URL, если нет проверки
 *    `navigationCanPop` / `fallbackHref`.
 * 4. **Pick-режимы** (`pickForWorkout`, `pickForTemplateSlot`, …) — `fallbackHref` на экран,
 *    откуда открыли pick, или `router.back()` только если гарантирован push из формы.
 *
 * ### Чеклист перед PR / новый stack-экран
 *
 * - [ ] Экран в Stack `app/(app)/_layout.tsx` или отдельном stack — у «Назад» есть `fallbackHref`.
 * - [ ] Открыть экран **напрямую** в браузере (`/plan-template/1`, `/workout/1`, …) → «Назад»
 *       уводит на fallback **без** warning `GO_BACK was not handled`.
 * - [ ] Открыть экран через `router.push` со списка → «Назад» делает pop (анимация влево).
 * - [ ] Системный жест назад / браузер Back на web ведёт себя так же, если обработчик завязан
 *       на `useGoBackWithScreenEnter` (не отдельный `router.back()` без fallback).
 * - [ ] После pick-режима (каталог, залы) возврат не ломает стек формы/детали.
 *
 * ### Референсы
 *
 * - `ScreenEnterFrame.tsx` — `useGoBackWithScreenEnter`, `goBackWithScreenEnter`, `navigationCanPop`
 * - `workout/[id]/index.tsx` → `"/workouts"`
 * - `plan-template` / `PlansTemplateDetailScreen` → `"/plans"`
 * - `exercise-in-catalog/[id].tsx` → `"/exercise_catalog"`
 * - `exercise/[id].tsx` → `/workout/{id}` или `"/workouts"`
 */
