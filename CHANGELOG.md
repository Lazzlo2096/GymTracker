# 📓 Changelog
Все заметные изменения этого проекта будут документироваться в этом файле.

---

## v0.7.13 – [2026-05-13]

### Mobile — авторизация и OAuth
- Экраны **входа** и **регистрации** приведены к макету: карточка с фиолетовой обводкой (`colors.primary`), поля, ряд соцкнопок, основная кнопка, футер со ссылкой.
- Интеграция **OAuth** с уже существующим backend: `GET /api/v1/auth/oauth/{provider}/start` + `POST .../exchange`, редирект через `Linking.createURL('oauth')` и `WebBrowser.openAuthSessionAsync`; провайдеры **Google**, **Яндекс**, **VK**.
- В **`AuthContext`** добавлен **`signInWithOAuth`**, в корневом **`_layout`** вызывается **`WebBrowser.maybeCompleteAuthSession()`**.
- Регистрация по email: поле подтверждения пароля, имя пользователя для API формируется из локальной части email (санитизация).

### Mobile — навигация и профиль
- **Нижняя панель вкладок** (`BottomNavBar`): симметричные вертикальные отступы у блока иконка+подпись, зона **safe area** вынесена отдельно, пункты выровнены по центру (без «прижатия» к верху).

### Mobile — тренировки (меню действий)
- В шторке **«Действия»** для тренировки убраны пункты **«Редактировать»** и **«Добавить подход»**; добавлен пункт **«Выбрать»** (заглушка под будущий массовый выбор).
- Для действий **Премиум** (дублирование, сравнение, график, поделиться, скрыть из сводок) добавлен визуальный бейдж **«Премиум»** и лёгкий акцент иконки.
- Те же изменения применены к меню **верхних трёх точек** на экране тренировки; на экране истории исправлен проп шторки: **`subtitle`** вместо несуществующего `workoutTitle`.

### Mobile — профиль
- Пункт **«Каталог моих упражнений»** переименован в **«Каталог упражнений»**, подпись строки в приглушённом цвете (`muted`), как у второстепенных подписей в списке.

---

## v0.7.12 – [2026-05-04]

### Backend — Auth, ORM, Alembic, CORS
- **ORM:** у `User.user_gyms` и `UserGym.user` заданы явные `foreign_keys`, устранён `AmbiguousForeignKeysError` при выборке пользователя (логин / сессия).
- **FastAPI:** в роутере каталога упражнений параметр `muscle_group` с дефолтом через `= None` вместо `Query` внутри `Annotated` (совместимость с FastAPI, без AssertionError при импорте).
- **Регистрация / пароль:** минимум 8 символов после trim, максимум 128; ослаблена избыточная проверка сложности.
- **JWT / cookies:** удлинены значения по умолчанию для `AUTH_SECRET`; для SPA при работе через cookies отключён `JWT_COOKIE_CSRF_PROTECT` (мобильный клиент по-прежнему Bearer).
- **Alembic:** в `env.py` для локального запуска без Docker по умолчанию порт PostgreSQL **5433** (как проброс в compose); импорт моделей для autogenerate; в Makefile — цели миграций через compose (`migrate-*-compose-dev`).
- **Миграция** `fb2e69d88c8f_user_schema_tweaks.py`: комментарии к `password_hash` / `refresh_jti`, приведение `age_years` к `Integer`; дублирующий индекс `ix_users_display_name` не создаётся (индекс уже в `7d6f4a9c1b12`).
- **CORS:** вместо `allow_origins=["*"]` с `credentials` — список `CORS_ALLOWED_ORIGINS` (через запятую) и/или `CORS_ALLOW_ORIGIN_REGEX`; если не задано — regex на `http(s)://localhost`, `127.0.0.1`, `[::1]` с любым портом (корректно для `fetch(..., credentials: "include")` с другого origin).

### Infrastructure
- **Nginx** (`nginx.dev.conf`, `nginx.prod.conf`): для `location /api/` отключён `proxy_cache` (ответы зависят от Cookie; общий ключ по URI давал неверный кеш для `/api/v1/auth/me` и прочих приватных GET).

### Frontend (SPA)
- **`AuthContext`:** разбор массива `detail` от Pydantic в `formatApiError`; после успешного login/register при ошибке `GET /auth/me` показывается понятное сообщение с причиной; для `fetchMe` в ошибку добавляются статус и текст ответа API.

### Mobile
- Экран **«Залы»**: журнал залов пользователя, расширение API `user_gyms`, вход из профиля.
- **Профиль** по макету: модалки, аватар через **expo-image-picker**, интеграция с API.
- **Модалка подхода:** нижний лист по макету, типы set/rest, таймер, диплинк.
- **Таймер:** шапка с меню, модалка плана подходов, правки времени и вкладок.
- **Типографика:** единый стиль Montserrat (шрифты, размеры, переносы).

### Backend — прочее
- **GET** `.../weights/latest` без записей возвращает **404** вместо некорректного ответа.

---

## v0.7.11 – [2026-04-22]

### Backend — Exercise Catalog / Sets / User Weight
- Каталог упражнений расширен новыми полями:
  - `machine_location` — текстовое описание, где стоит тренажёр в зале;
  - `machine_settings` — JSON с пользовательскими настройками тренажёра.
- Для каталога добавлена загрузка пользовательской картинки упражнения на локальный сервер:
  - `POST /api/v1/exercises_in_catalog/{item_id}/image` (multipart/form-data, `file`);
  - сохранение файла в `MEDIA_ROOT` и запись URL в поле `image`.
- Добавлена локальная раздача медиа:
  - `MEDIA_ROOT`, `MEDIA_URL_PREFIX` в `core/config.py`;
  - `StaticFiles` mount в `main.py` на `/media` (по умолчанию).
- Добавлена миграция БД для `machine_location`:
  - `c2d3e4f5a6b7_add_machine_location_to_exercises_catalog.py`.
- Добавлена миграция БД для `machine_settings`:
  - `d4e5f6a7b8c9_add_machine_settings_to_exercises_catalog.py`.
- В журнале подходов (`set`) разрешён отрицательный вес (`weight`) для кейсов вроде гравитрона.
- В серверном расчёте тоннажа (`workouts` list/sort) учтены отрицательные веса:
  - убрано принудительное ограничение `weight >= 0`, используется фактическое значение.
- В `user_weights` добавлен опциональный `weight_lbs`:
  - поле в модели/схемах/CRUD;
  - обратная совместимость сохранена (`weight_kg` остаётся обязательным);
  - миграция: `b7c8d9e0f1a2_add_weight_lbs_to_user_weights.py`.

---


## v0.7.10 – [2026-04-22]

### Backend — YooKassa Payments
- Добавлена интеграция оплаты через **YooKassa**:
  - `POST /api/v1/payments/yookassa/create` — создание платежа;
  - `GET /api/v1/payments/yookassa/{payment_id}` — проверка и синхронизация статуса платежа.
- Добавлен сервис `backend/services/postgres/payments_yookassa.py`:
  - создание платежа через API YooKassa;
  - проверка статуса платежа;
  - сохранение/обновление платежа в PostgreSQL;
  - поддержка `Idempotence-Key`.
- Добавлена модель `Payment` (`backend/db/models/postgres/payment.py`) и связь `User.payments`.
- Добавлена миграция Alembic: `a91b2c3d4e5f_add_payments_table_yookassa.py` (таблица `payments`, индексы, JSON payload провайдера).
- Добавлены env-переменные в `core/config.py`:
  - `YOOKASSA_SHOP_ID`
  - `YOOKASSA_SECRET_KEY`
  - `YOOKASSA_RETURN_URL_DEFAULT`
- Для запроса создания платежа добавлен **обязательный параметр** `receipt_email`.
- В запрос к YooKassa добавлена отправка **чека** (`receipt`) на email пользователя:
  - `receipt.customer.email`
  - `receipt.items` (1 позиция услуги, `payment_mode=full_prepayment`, `payment_subject=service`).

---

## v0.7.9 – [2026-04-05]

### Backend — OAuth (AuthX)
- Добавлены OAuth-сценарии для **Google**, **VK** и **Yandex** с сохранением текущей JWT-модели на `authx` (access/refresh + cookies + `refresh_jti` rotation).
- Новые эндпоинты:
  - `GET /api/v1/auth/oauth/{provider}/start` — формирует `auth_url` для редиректа на провайдера;
  - `POST /api/v1/auth/oauth/{provider}/exchange` — обменивает `code` на профиль, выполняет login/register и выдаёт токены.
- Добавлен сервис провайдеров: `backend/services/postgres/oauth_providers.py`:
  - сбор URL авторизации;
  - обмен authorization code на access token;
  - получение профиля пользователя у провайдера.
- Для пользователей без email у провайдера (например, VK) реализован fallback на synthetic email формата `provider_uid@oauth.local`, чтобы сохранить совместимость с текущей схемой БД (`users.email` уникальный и обязательный).
- Реализовано безопасное создание пользователя при OAuth-входе:
  - поиск существующего пользователя по email / synthetic email;
  - генерация уникального `display_name` при коллизиях.
- Добавлены настройки окружения в `core/config.py`:
  - `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_DEFAULT_REDIRECT_URI`;
  - `VK_OAUTH_CLIENT_ID`, `VK_OAUTH_CLIENT_SECRET`, `VK_OAUTH_DEFAULT_REDIRECT_URI`;
  - `YANDEX_OAUTH_CLIENT_ID`, `YANDEX_OAUTH_CLIENT_SECRET`, `YANDEX_OAUTH_DEFAULT_REDIRECT_URI`.

---

## v0.7.8 – [2026-04-05]

### Backend
- **GET /api/v1/workouts/** — ответ в виде страницы: `items`, `total`, `limit`, `offset`, `has_more` (вместо полного массива).
- Query-параметры: `limit` (1–100, по умолчанию 20), `offset`, `sort` (`workout_date` | `tonnage` | `created_at`), `order` (`asc` | `desc`), `date_from`, `date_to`, `location`, `q` (поиск по заголовку дня, заметке, локации), `day_title_contains`.
- Тоннаж по тренировке считается в PostgreSQL по JSON-подходам (`weight` / `weight_kg` × `reps`); сортировка по тоннажу без загрузки всех строк в память приложения.

### Frontend (веб)
- Список тренировок: **бесконечная прокрутка** (IntersectionObserver), подгрузка страницами по 20.
- Панель **фильтров**: период дат, локация, заголовок дня («тип»), общий поиск; сортировка по дате / тоннажу; debounce для текстовых полей.
- Карточка тренировки показывает **тоннаж** с API; состояние фильтров в `NavTabber` расширено под новые поля.

---

## v0.7.7 – [2026-04-05]

### Mobile (Expo / React Native)
- **Структура кода:** весь прикладной код перенесён в `mobile/src/` — `api/`, `auth/`, `config/`, `context/`, `theme/`, `utils/`, `components/` (`navigation/`, `ui/`, `modals/`, `exercise/`)
- **Импорты:** алиас `@/` → `src/` через `babel-plugin-module-resolver` и `tsconfig` (`baseUrl`, `paths`)
- **Тема:** общая палитра `src/theme/colors.ts` (в т.ч. `error` для ошибок валидации)
- **Удалены** корневые `mobile/lib/`, `mobile/context/`, `mobile/components/` (логика заменена модулями в `src/`)
- **Паритет с вебом:** после входа редирект на **`/workouts`** (как стартовый swipe «Тренировки» в `Layout.jsx`), а не на каталог
- **TabSets:** корректное отображение меток таймера **`mark_type` + `time`** (раньше ожидались несуществующие `start_time`/`end_time`); поддержка числового `rest` через `fmtDuration`; блок заголовка упражнения (название, заметки, иконка); кнопка **«К таймеру →»**
- **SetEditorModal:** удаление записи лога **`DELETE /exercises_in_workout/{id}/log/{idx}`** (как на вебе в `SetFinishEditor`)
- Документирующие комментарии в коде на русском там, где добавлялись или переносились модули

---

## v0.7.6 – [2026-04-05]

### Mobile (Expo / React Native)
- Приложение в каталоге `mobile/`: вход и регистрация, каталог упражнений, список тренировок с сортировкой, деталь тренировки, экран упражнения с таймером и списком подходов, профиль и выход
- Хранение `access_token` / `refresh_token` в `expo-secure-store`, API через `Authorization: Bearer` и автоматический refresh при 401
- Нижняя навигация и FAB, модальные формы (тренировка, упражнение в тренировке, запись в каталоге, редактирование подхода)
- `mobile/README.md` — настройка `EXPO_PUBLIC_API_URL` / `app.json` → `extra.apiUrl` для эмулятора и устройств

### Backend
- AuthX: `JWT_TOKEN_LOCATION` — `cookies` и `headers`, чтобы веб продолжал работать на cookies, а мобильный клиент — на Bearer

---

## v0.7.5 – [2026-03-22]

### Backend — слои данных и сценарии
- **`db/repositories/mongo/`** — доступ к MongoDB (Beanie): общий `document_crud_repository` для авто-CRUD, `workout_repository` для тренировок.
- **`db/repositories/postgres/`** — доступ к PostgreSQL (SQLAlchemy): `workout_repository`, `workout_exercise_repository`, `exercise_catalog_repository`, реестр в `document_crud_repository` для дублирования авто-CRUD (`users`, `workouts`, `user_weights`).
- **`services/postgres/`** — прикладные сценарии под Postgres (HTTP-ошибки, ответы, вызов репозиториев); роутеры остаются тонкими и импортируют отсюда функции вместо `routers/*__postgres`.
- **Роутеры** (`workout_actions`, каталог, подходы в упражнении, `crud/generic`): флаги `IS_POSTGRES_DB_ENABLE` / `IS_POSTGRES_DB_MAIN` — параллельный вызов Mongo и Postgres по тем же URL, где это предусмотрено.

---

## v0.7.4 – [2026-03-18]

### Auth (AuthX, JWT cookies)
- Удалён OIDC-провайдер и связанные зависимости (docker-compose, nginx, backend, frontend)
- Реализована авторизация через AuthX: `register/login/me/refresh/logout`
- JWT access+refresh в httpOnly cookies + CSRF cookies (`csrf_access_token`, `csrf_refresh_token`)
- Ротация refresh токена (сохранение `refresh_jti` в PostgreSQL)

### DB (PgBouncer)
- Добавлен `pgbouncer` в `docker-compose.dev.yml` и `docker-compose.prod.yml` для пула соединений к PostgreSQL
- Backend переключён на `DATABASE_URL` через `pgbouncer:6432` (вместо прямого подключения к `postgres:5432`)
- Добавлены конфиги `pgbouncer/pgbouncer.ini` и `pgbouncer/userlist.txt`

### Frontend
- AuthContext переписан под cookie-auth (без OIDC и localStorage токенов)
- `authHeaders()` теперь добавляет `X-CSRF-TOKEN` из `csrf_access_token`

---

## v0.7.3 – [2026-03-13]

### Авторизация (Login/Register UI)
- Адаптивная ширина карточки: мобилка 420px, планшет 680px, десктоп 880–1000px
- Тёмная тема: цвета через CSS-переменные (`--card`, `--text`, `--input-bg`, `--muted` и др.)
- Текст в инпутах выровнен по левому краю
- Переключатель темы (светлая/тёмная) в правом верхнем углу карточки
- Сохранение выбранной темы в `localStorage`
- Уменьшены горизонтальные отступы на планшете/ПК — инпуты и кнопки шире

### Backend
- Исправлены отступы в `auth.py` (login, register)

---

## v0.7.2 – [2026-03-13]

### Авторизация через OIDC (история)
- На этом этапе авторизация была через внешний OIDC-провайдер (регистрация, логин, токены)
- **GET /api/v1/auth/me** — данные текущего пользователя
- Исключены из проверки токена: `/docs`, `/redoc`, `/openapi.json`
- Удалены custom register/login и JWT (passlib, python-jose)

---

## v0.7.1 – [2026-03-13]

### Alembic для PostgreSQL
- Добавлен Alembic, psycopg2-binary в requirements
- Начальная миграция `initial_postgres_schema` для таблиц: users, user_weight, exercise_catalog, workout, workout_exercise
- env.py подключает модели PostgreSQL, URL берётся из `DATABASE_URL` (sync: psycopg2)
- Makefile: `make migrate`, `make migrate-revision msg="описание"`
- db.models: Mongo-модели загружаются с try/except (для запуска Alembic без pydantic/beanie)

---

## v0.7.0 – [2026-03-12]

### Таймер
- **Исправлено сохранение** — подходы и отдых корректно сохраняются в БД
- Убран вызов модалки при завершении подхода; данные сохраняются напрямую через API
- В payload добавлено поле `time` (ISO) для сортировки записей
- После сохранения вызывается `emit("exercise:updated")` для обновления экрана подходов

### Автообновление экрана подходов
- Tabber рендерит все панели (скрывая неактивные), чтобы TabSets оставался смонтированным
- TabSets подписан на `exercise:updated` и рефетчит данные при каждом сохранении в таймере
- Переключение на вкладку «Подходы» сразу показывает актуальные данные

### Прогресс подходов
- **Backend:** в `ExerciseInWorkout` добавлено поле `planned_sets` (опционально)
- **Backend:** эндпоинт `PATCH /exercises_in_workout/{id}/planned_sets`
- **Frontend:** в форме добавления упражнения — поле «Запланировано подходов»
- В таймере: линия прогресса «Подходы: X из Y» при заданном `planned_sets`
- Если не задано — показывается форма для ввода

### Значки упражнений
- **Backend:** в `ExerciseInCatalog` добавлено поле `icon` (по умолчанию `barbell`)
- 12 иконок: barbell, dumbbell, biceps, pulldown, squat, bench, shoulder, deadlift, kettlebell, cable, cardio, abs
- В форме каталога — выбор иконки (сетка кнопок)
- Иконки отображаются в каталоге, карточке упражнения и на экране подходов

### Pydantic-модели для API
- **exercise_in_workout:** `SetData`, `SetUpdate`, `PlannedSetsUpdate` — валидация add_set, update_set, update_sets, planned_sets
- **exercise_in_catalog:** `ExerciseInCatalogPatch` / `ExerciseInCatalogReplace` — валидация PATCH / PUT
- **workout_actions:** `AddExerciseToWorkoutResponse` — response model для add_exercise
- **Generic CRUD:** автогенерация `{Model}Update` через `make_update_schema()` — замена `Dict[str, Any]` на типизированные схемы

### Тёмная тема
- Input: `--input-bg`, `--input-border`, стили autofill
- Вкладки: контраст неактивных, тёмный фон активной
- TabTimer: цвета меток, кнопок, фонового круга
- BottomNav: цвета иконок
- WorkoutDetail, модалки, формы — правки для dark mode
- Иконки используют `currentColor` / `var(--text)`

---

## v0.6.0 – [2026-03-12]

### Backend
- Рефакторинг архитектуры: `core/`, `db/`, `crud/`, `schemas/`, `routers/`
- Добавлены `__init__.py` во все пакеты
- Модели перенесены в `db/models/` с разделением по БД: `db/models/mongo/`, `db/models/postgres/`
- Каждая модель вынесена в отдельный файл (user, user_weight, workout, exercise_in_catalog и др.)
- Роутеры объединены в `routers/__init__.py` через `include_router`
- `mongo_repositories/all.py` переименован в `legacy_pymongo_crud.py`
- Pydantic-схемы переведены на `BaseModel` и `Field`
- Комментарии и docstrings на русском

### Frontend
- Новая структура папок: `components/`, `layout/`, `modals/`, `tabs/`, `pages/`, `lib/`
- Все CSS переведены в SCSS
- Адаптивная верстка (брейкпоинты для мобильных, планшетов, десктопа)
- Выровнены имена файлов: `WorkoutCard.jsx` + `WorkoutCard.scss`, `List.scss` объединён с `Page.scss`
- Удалён дубликат `SetExtendedForm`
- Контент `frontend/my-react-vite-frontend` перенесён в `frontend/`

### Docker
- Только два compose-файла: `docker-compose.dev.yml` и `docker-compose.prod.yml`
- Удалены: `docker-compose.web.yml`, `docker-compose.db.mongo.yml`, `docker-compose.db.postgres.yml`, `docker-compose.frontend*.yml`

### Документация
- Обновлены README: корень, backend, frontend
- Обновлён Makefile (`make dev`, `make prod`, `make down`)

---

## v0.5.0 – [2025-10-01]
- Добавлены первые тесты для API.
- Получен первый рабочий end-to-end сценарий.

---

## v0.4.0 – [2025-09-29]
- Реализован autocrud для моделей
  - Генерация CRUD-роутов автоматически.
  - Минимизировано количество ручного кода
  - Фильтрация (автоматически по всем полям модели)
  - Сортировка
  - Пагинация. (запланировано!)
  - Пришлось всё сделать документами в mongo

---

## v0.3.0 – [2025-09-28]
- Backend переписан с PostgreSQL на MongoDB.
- v0.3.1 : pymongo заменён на ODM Beanie.
  - Архитектура адаптирована под документо-ориентированные модели.  

---

## v0.2.x – [2025-09-19]
- v0.2.1 : Разделены backend и frontend сервера.
- v0.2.2 : UI переписан: Jinja2 + Vanilla JS → React + Vite.
  - v0.2.2.1 : Добавлены первые React-компоненты: `Tabber`, `Timer`, `Modal`.  

---

##  v0.1.0 – [2025-08-30]
- Инициализация проекта на FastAPI.
- Подключён PostgreSQL и pgAdmin.
- Первые CRUD-роуты.
- Интерфейс на Jinja2 + Vanilla JS.
