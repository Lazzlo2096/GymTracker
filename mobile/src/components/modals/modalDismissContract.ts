/**
 * ## Контракт закрытия модалок (fade и bottom sheet)
 *
 * При `visible: true → false` закрытие не мгновенное: ещё ~280 ms отрисовываются
 * кадры анимации (fade-out у `Modal` или slide-down у bottom sheet через `useBottomSheet`).
 *
 * Если родитель **в том же колбеке**, что ставит `visible = false`, обнуляет данные
 * (заголовок, subtitle, список действий, черновик поля) или размонтирует модалку
 * (`{editor && <Dialog />}`), React успевает отрисовать «пустой» или чужой контент
 * поверх затухающего оверлея — пользователь видит мигание (пропадает имя сущности,
 * «Редактировать упражнение» превращается в «Редактировать», шторка «прыгает»).
 *
 * ### Рекомендуемый контракт
 *
 * 1. **Два уровня состояния** — данные контента (что показываем) и отдельно флаг
 *    `visible` для пропа модалки. Открытие: сначала зафиксировать данные, затем `visible = true`.
 * 2. **Закрытие** — только `visible = false` (и блокировка повторного закрытия при сохранении).
 *    Данные **не** сбрасывать синхронно с первым `visible = false`.
 * 3. **`onDismiss`** — очищать данные **только** после завершения анимации:
 *    - fade: `onDismiss` у `Modal` + таймер `MODAL_FADE_MS` (Android часто не шлёт `onDismiss`);
 *    - bottom sheet: `onDismiss` у `useBottomSheet` / `WorkoutActionsSheet` после slide-down.
 *
 * ### Внутри bottom sheet-компонентов
 *
 * Не подтягивать пропсы в локальный state, пока `visible === false` и шторка ещё
 * смонтирована (`mounted` из `useBottomSheet`) — иначе при очистке родителем контент
 * сменится до конца анимации.
 *
 * ### Чеклист перед PR / после изменения модалки
 *
 * - [ ] Закрытие по «Отмена», «Сохранить», backdrop и свайпу: контент **не исчезает**
 *       раньше оверлея/шторки (нет пустого кадра, «прыжка», только tabber без формы).
 * - [ ] Данные контента (title, target, draft, options) сбрасываются в **`onDismiss`** /
 *       после `MODAL_FADE_MS` / `BOTTOM_SHEET_CLOSE_MS`, а **не** синхронно с первым `visible = false`.
 * - [ ] У sheet два уровня state при необходимости: `visible` для анимации и отдельно payload
 *       (см. `fieldDialogVisible` + `metaEditor` в `workout/[id]/index.tsx`).
 * - [ ] **Embedded**-форма внутри sheet: проп «показывать форму» учитывает `mounted` родителя,
 *       не только `visible` (например `(visible || mounted) && activeTab`).
 * - [ ] Внутри bottom sheet: `useEffect` с reset по `visible` не затирает state, пока
 *       `mounted === true` и идёт анимация закрытия.
 * - [ ] На время закрытия (`!visible && mounted`) интерактив формы отключён (`pointerEvents`,
 *       блокировка повторного submit), если нужно.
 */
export const MODAL_FADE_MS = 280;

/** Длительность закрытия bottom sheet (`useBottomSheet`). */
export const BOTTOM_SHEET_CLOSE_MS = 280;
