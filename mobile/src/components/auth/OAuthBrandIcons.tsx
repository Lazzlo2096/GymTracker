import { Image } from "expo-image";
import React from "react";

type IconProps = {
  /** Вписать в квадрат стороной `size` (dp). */
  size?: number;
};

const googlePng = require("../../../assets/images/oauth/google.png");
const yandexPng = require("../../../assets/images/oauth/yandex.png");
const vkPng = require("../../../assets/images/oauth/vk.png");

/**
 * Иконки OAuth — **PNG из макета Figma** (`mobile/assets/images/oauth/`).
 * Для Google: если в файле **чёрный фон**, на белой кнопке будет виден квадрат — выгрузите из Figma **PNG с прозрачностью** и замените `google.png`.
 */
export function GoogleOAuthIcon({ size = 22 }: IconProps) {
  return (
    <Image
      source={googlePng}
      style={{ width: size, height: size }}
      contentFit="contain"
      accessibilityLabel="Google"
    />
  );
}

export function VkOAuthIcon({ size = 22 }: IconProps) {
  return (
    <Image
      source={vkPng}
      style={{ width: size, height: size }}
      contentFit="contain"
      accessibilityLabel="VK"
    />
  );
}

export function YandexOAuthIcon({ size = 22 }: IconProps) {
  return (
    <Image
      source={yandexPng}
      style={{ width: size, height: size }}
      contentFit="contain"
      accessibilityLabel="Яндекс"
    />
  );
}
