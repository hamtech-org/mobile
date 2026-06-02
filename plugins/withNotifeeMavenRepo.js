const { withProjectBuildGradle } = require("expo/config-plugins");

const NOTIFEE_MAVEN_MARKER = "@notifee/react-native/android/libs";
const MAVEN_REPO_LINE =
  '    maven { url "$rootDir/../node_modules/@notifee/react-native/android/libs" }';

/** @type {import('expo/config-plugins').ConfigPlugin} */
function withNotifeeMavenRepo(config) {
  return withProjectBuildGradle(config, (gradleConfig) => {
    let contents = gradleConfig.modResults.contents;
    if (contents.includes(NOTIFEE_MAVEN_MARKER)) {
      return gradleConfig;
    }

    const needle = "allprojects {\n  repositories {";
    if (!contents.includes(needle)) {
      throw new Error(
        "withNotifeeMavenRepo: expected allprojects { repositories { in android/build.gradle",
      );
    }

    contents = contents.replace(needle, `${needle}\n${MAVEN_REPO_LINE}`);
    gradleConfig.modResults.contents = contents;
    return gradleConfig;
  });
}

module.exports = withNotifeeMavenRepo;
