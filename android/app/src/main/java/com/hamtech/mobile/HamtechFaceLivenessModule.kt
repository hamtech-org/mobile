package com.hamtech.mobile

import android.app.Activity
import android.content.Intent
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.BaseActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableNativeMap

class HamtechFaceLivenessModule(
    private val reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {
  private var pendingPromise: Promise? = null

  private val activityEventListener: ActivityEventListener =
      object : BaseActivityEventListener() {
        override fun onActivityResult(
            activity: Activity,
            requestCode: Int,
            resultCode: Int,
            data: Intent?
        ) {
          if (requestCode != REQUEST_CODE) return
          val promise = pendingPromise ?: return
          pendingPromise = null

          if (resultCode == Activity.RESULT_OK) {
            promise.resolve(WritableNativeMap().apply { putBoolean("success", true) })
            return
          }

          if (resultCode == HamtechFaceLivenessActivity.RESULT_CANCELLED) {
            promise.resolve(WritableNativeMap().apply { putBoolean("cancelled", true) })
            return
          }

          val message =
              data?.getStringExtra(HamtechFaceLivenessActivity.EXTRA_ERROR_MESSAGE)
                  ?: "Không xác thực được khuôn mặt."
          promise.reject("FACE_LIVENESS_ERROR", message)
        }
      }

  init {
    reactContext.addActivityEventListener(activityEventListener)
  }

  override fun getName(): String = "HamtechFaceLiveness"

  @ReactMethod
  fun start(options: ReadableMap, promise: Promise) {
    val activity = reactApplicationContext.currentActivity
    if (activity == null) {
      promise.reject("NO_ACTIVITY", "Không tìm thấy Android Activity hiện tại.")
      return
    }
    if (pendingPromise != null) {
      promise.reject("IN_PROGRESS", "Đang có phiên xác thực khuôn mặt khác.")
      return
    }

    val sessionId = options.getString("sessionId")?.trim().orEmpty()
    val region = options.getString("region")?.trim().orEmpty()
    if (sessionId.isEmpty() || region.isEmpty()) {
      promise.reject("INVALID_OPTIONS", "Thiếu sessionId hoặc region cho Face Liveness.")
      return
    }

    pendingPromise = promise
    val intent =
        Intent(reactApplicationContext, HamtechFaceLivenessActivity::class.java).apply {
          putExtra(HamtechFaceLivenessActivity.EXTRA_SESSION_ID, sessionId)
          putExtra(HamtechFaceLivenessActivity.EXTRA_REGION, region)
        }
    reactApplicationContext.startActivityForResult(intent, REQUEST_CODE, null)
  }

  companion object {
    private const val REQUEST_CODE = 7184
  }
}
