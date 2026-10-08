/**
 * ## Контракт анимаций: раскрывающийся список + вложенный аккордеон
 *
 * Типичный экран: список карточек (каталог) + разворот одной карточки (сплит по дням).
 * Ошибки дают «просадку FPS» в первые секунды, двойные анимации и рывки при «Скрыть».
 *
 * Референс: вкладка «Программа» на `/plans` — `PlansProgramCatalogItem` (обёртка списка)
 * + `PlansProgramCard` (аккордеон внутри карточки).
 *
 * ### Рекомендуемый контракт
 *
 * **Обёртка списка** (появление «Все» / скрытие лишних пунктов):
 * 1. Анимируй height/opacity обёртки **только** при `animateEntrance` / `animateExit`, не при
 *    обычном развороте дочерней карточки.
 * 2. На exit — **заморозь** высоту (`lockedHeight`) и состояние разворота дочерней карточки
 *    до конца анимации; не сбрасывай `expanded` синхронно с первым кадром скрытия.
 * 3. Завершение exit — по колбеку анимации (`onExitComplete`), не по `setTimeout` с угаданной длительностью.
 * 4. Во время exit не обновляй `onLayout` высоты обёртки.
 *
 * **Аккордеон внутри карточки** (разворот по тапу):
 * 1. **Mount без анимации** — `setValue` сразу в `useLayoutEffect` на первом кадре; `Animated.timing`
 *    только когда `expanded` **изменился после mount** (`prevExpandedRef`).
 * 2. **Не клади** результат measure (`bodyHeight`, `measuredHeight`) в deps эффекта, который
 *    запускает collapse/expand — иначе после `onLayout` стартует лишняя 300 ms анимация на всех карточках.
 * 3. Высоту тела мерь в скрытом слое; при `expanded && !height` — отложи старт до measure
 *    (`pendingExpandRef` + один `runAnimation(true)`).
 * 4. Chevron/opacity — `useNativeDriver: true` на native; на **web** `Platform.OS !== "web"`.
 *
 * ### Чеклист перед PR / после изменения expand-анимаций
 *
 * - [ ] Открытие вкладки / mount списка: в dev-логах `[TRACE]` **нет** пачки
 *       `programCard.expand` с `expanded:false` и `bodyHeight:0`.
 * - [ ] Каждый пользовательский разворот: один `START` → один `END` с `finished:true` (~заданная длительность).
 * - [ ] Нет `finished:false` / отменённых анимаций сразу после mount или measure.
 * - [ ] Разворот карточки не двигает height обёртки списка (обёртка пассивна вне enter/exit).
 * - [ ] «Скрыть» в каталоге: карточки уходят с fade/height, список сжимается без мгновенного unmount.
 * - [ ] При «Скрыть» развёрнутая карточка не схлопывается в том же кадре, что и exit списка.
 * - [ ] Проверка на **Web** (JS driver) и по возможности на **Expo Go** (native driver).
 *
 * ### Антипаттерны
 *
 * ```tsx
 * // ❌ Анимация на mount и при каждом onLayout
 * useEffect(() => {
 *   Animated.timing(anim, { toValue: expanded ? 1 : 0 }).start();
 * }, [expanded, bodyHeight]);
 *
 * // ❌ Обёртка списка всегда анимирует height по measuredHeight дочерней карточки
 * <Animated.View style={{ height: animatedHeight }} />
 *
 * // ❌ Скрытие каталога: сразу showAll=false + expanded=null + unmount лишних карточек
 * onPress={() => { setShowAll(false); setExpanded(null); }}
 *
 * // ✅ Mount: только setValue; анимация — при смене expanded после mount
 * if (!mountedRef.current) { mountedRef.current = true; anim.setValue(expanded ? 1 : 0); return; }
 * if (prevExpandedRef.current === expanded) return;
 *
 * // ✅ Обёртка: height-анимация только при animateEntrance || animateExit
 * const isListAnimating = animateEntrance || animateExit;
 *
 * // ✅ Exit: isCatalogExiting + onExitComplete, expanded заморожен до конца
 * ```
 */
export const EXPAND_ACCORDION_MS = 300;

/** Типичная длительность enter/exit одной карточки в каталоге (см. PlansProgramCatalogItem). */
export const LIST_CATALOG_ENTER_MS = 320;
export const LIST_CATALOG_EXIT_MS = 260;
