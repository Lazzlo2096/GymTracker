# GymTracker — мобильное приложение (Expo / React Native)

Клиент API: авторизация AuthX (JWT из тела ответа `login`/`register`, дальше `Authorization: Bearer` + refresh), каталог упражнений, список тренировок, деталь тренировки, таймер и журнал подходов.

## Требования

- Node.js 20+
- [Expo CLI](https://docs.expo.dev/) / `npx expo`
- **Сборка Android (`expo run:android`):** JDK **17 или 21** (не Java 25). На Fedora:
  ```bash
  sudo dnf install -y java-21-openjdk-devel
  export JAVA_HOME=/usr/lib/jvm/java-21-openjdk
  ```

## Локальная разработка (на своём ПК)

1. Поднять backend (из корня репозитория):

```bash
docker compose -f docker-compose.dev.yml up --build -d
curl -s http://127.0.0.1:8000/docs | head -1   # 200; если 404 — API на :8001 (см. mobile/.env.local)
```

2. Mobile (по умолчанию API `http://127.0.0.1:8000` — см. `mobile/.env`):

```bash
cd mobile
npm install
npm start              # web / симулятор на этом ПК
npm run web            # только браузер
npm run start:lan      # телефон в Wi‑Fi (подставит IP компа)
npm run start:android-emulator   # Android-эмулятор → 10.0.2.2:8000
```

Переопределение: `mobile/.env.local` (в git не попадает) или `EXPO_PUBLIC_API_URL=…`.

| Сценарий | URL |
|----------|-----|
| Браузер / iOS-симулятор | `http://127.0.0.1:8000` |
| Android-эмулятор | `http://10.0.2.2:8000` |
| Телефон (Expo Go) | `http://<IP_ПК_в_LAN>:8000` |

**Прод (habitpro.ru)** — только EAS (`eas.json`) и Docker prod (`EXPO_PUBLIC_API_URL` при сборке), не `npm start`.

На бэкенде для мобильных клиентов включена выдача токена через заголовок `Authorization` (в дополнение к cookies для веба).

## Запуск (кратко)

```bash
cd mobile
npm install
npm start
```

Далее откройте проект в Expo Go или соберите dev client.

### Нативная сборка Android

```bash
npm run android
# или: npx expo run:android  (после export JAVA_HOME на JDK 21)
```

Команда `npm run android` подхватывает JDK 17/21 автоматически. Не используйте `npx run expo` — это другой пакет и ошибка `brace-expansion`.

## Черновой APK / AAB для habitpro.ru (TGL-7)

Бэкенд: **https://habitpro.ru** (вшивается через `EXPO_PUBLIC_API_URL` в EAS-профилях `habitpro-apk` / `habitpro-aab`).

```bash
cd mobile
npm install
npx eas-cli login    # один раз

# Облако (рекомендуется): APK + AAB
./scripts/build-habitpro-android.sh
# или по отдельности:
npm run build:habitpro:apk
npm run build:habitpro:aab

# Скачать последний билд
npx eas-cli build:download --latest --platform android --output builds/
```

Установка APK на телефон: скопировать `.apk` и открыть (разрешить установку из неизвестных источников) или `adb install -r builds/….apk`.

Проверка: регистрация/вход, список тренировок — запросы должны идти на `https://habitpro.ru/api/…`.

## Структура экранов

- Вход / регистрация
- Каталог упражнений → тренировки → карточка тренировки → упражнение (вкладки «Таймер» и «Подходы»)
- Профиль и выход

Нижняя панель повторяет веб: «Тренировки», «Таймер» (переход в каталог как старт потока), «Профиль».
