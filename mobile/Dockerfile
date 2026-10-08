# Сборка Expo Web (static) для псевдо-prod / prod.
# Контекст сборки: корень репозитория (см. docker-compose.prod.yml).
# EXPO_PUBLIC_API_URL задаётся при сборке (например https://habitpro.ru).

FROM node:22-alpine AS build

WORKDIR /app/mobile

COPY mobile/package.json mobile/package-lock.json ./
RUN npm ci

COPY mobile/ .

ARG EXPO_PUBLIC_API_URL=https://habitpro.ru
ENV EXPO_PUBLIC_API_URL=${EXPO_PUBLIC_API_URL}

RUN npx expo export -p web

FROM nginx:alpine

COPY deploy/prod/mobile-nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/mobile/dist /usr/share/nginx/html

EXPOSE 80
