const { withAndroidManifest, AndroidConfig } = require("expo/config-plugins");

const FCM_COLOR_META = "com.google.firebase.messaging.default_notification_color";

/** @type {import('expo/config-plugins').ConfigPlugin} */
function withFcmNotificationManifest(config) {
  return withAndroidManifest(config, (manifestConfig) => {
    const manifest = manifestConfig.modResults;
    AndroidConfig.Manifest.ensureToolsAvailable(manifest);

    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);
    const metaDataList = application["meta-data"] ?? [];

    for (const entry of metaDataList) {
      if (entry.$?.["android:name"] === FCM_COLOR_META) {
        entry.$["tools:replace"] = "android:resource";
      }
    }

    application["meta-data"] = metaDataList;
    return manifestConfig;
  });
}

module.exports = withFcmNotificationManifest;
