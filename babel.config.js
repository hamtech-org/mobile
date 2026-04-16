module.exports = function (api) {
  api.cache(true);
  return {
    presets: [["babel-preset-expo", { jsxImportSource: "nativewind" }]],
    plugins: [
      // reanimated BẮT BUỘC phải là plugin cuối cùng
      "react-native-reanimated/plugin",
    ],
  };
};
