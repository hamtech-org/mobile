import "@expo/metro-runtime";
import { App } from "expo-router/build/qualified-entry";
import { renderRootComponent } from "expo-router/build/renderRootComponent";

// 1. Register FCM background message handler at the absolute entry point
import { setupBackgroundCallHandler } from "./src/utils/callNotificationHandler";
setupBackgroundCallHandler();

// 2. Register and render the Expo Router root component
renderRootComponent(App);
