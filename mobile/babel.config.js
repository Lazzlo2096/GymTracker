/**
 * Babel для Expo. Алиас `@/` → каталог `src/` (должен совпадать с `tsconfig.json`).
 */
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [
      [
        "module-resolver",
        {
          root: ["."],
          alias: { "@": "./src" },
          extensions: [".js", ".jsx", ".ts", ".tsx", ".json"],
        },
      ],
    ],
  };
};
