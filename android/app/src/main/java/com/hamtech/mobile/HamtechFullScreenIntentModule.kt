package com.hamtech.mobile

import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class HamtechFullScreenIntentModule(
    private val reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {
  override fun getName(): String = "HamtechFullScreenIntent"

  @ReactMethod
  fun canUseFullScreenIntent(promise: Promise) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      promise.resolve(true)
      return
    }

    val manager =
        reactContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    promise.resolve(manager.canUseFullScreenIntent())
  }

  @ReactMethod
  fun openSettings(promise: Promise) {
    try {
      val intent =
          if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT).apply {
              data = Uri.parse("package:${reactContext.packageName}")
            }
          } else {
            Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
              data = Uri.parse("package:${reactContext.packageName}")
            }
          }
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      reactContext.startActivity(intent)
      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("FULL_SCREEN_INTENT_SETTINGS_ERROR", error.message, error)
    }
  }
}
