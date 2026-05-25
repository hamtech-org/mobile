const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

const existingBlockList = config.resolver.blockList;
config.resolver.blockList = [
  ...(Array.isArray(existingBlockList)
    ? existingBlockList
    : existingBlockList
      ? [existingBlockList]
      : []),
  // Windows: Gradle temp under node_modules/.expo-xxx → Metro ENOENT
  /node_modules[\\/]\.expo-[^\\/]+[\\/].*/,
  /node_modules[\\/][^\\/]+[\\/]android[\\/]build[\\/].*/,
  /node_modules[\\/][^\\/]+[\\/]android[\\/]\.gradle[\\/].*/,
  /android[\\/]build[\\/].*/,
  /android[\\/]\.gradle[\\/].*/,
];

module.exports = withNativeWind(config, {
  input: "./src/theme/global.css",
});
